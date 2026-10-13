require('dotenv').config();
const { Resolver } = require('dns').promises;

const NAT64_DNS = process.env.NAT64_DNS || '2a01:4f9:c010:3f02::1';
const NAT64_DNS_BACKUP = process.env.NAT64_DNS_BACKUP || '2a00:1098:2c::1';
const NO_RECORD_CODES = ['ENODATA', 'ENOTFOUND'];

const hostOf = (url) => new URL(url).hostname;

function collectHosts(idp) {
    // only hosts Keycloak actually connects to; entity_id is an identifier, not an endpoint
    const urls = (idp.single_sign_on_service || []).map(s => s.Location)
        .concat((idp.single_logout_service || []).map(s => s.Location))
        .filter(Boolean);
    return [...new Set(urls.map(hostOf))];
}

async function resolve6(host, server) {
    const resolver = new Resolver({ timeout: 4000, tries: 2 });
    if (server) resolver.setServers([server]);
    const addresses = await resolver.resolve6(host);
    // CNAME chains without AAAA records resolve to an empty list
    if (addresses.length === 0) throw Object.assign(new Error('no AAAA'), { code: 'ENODATA' });
    // DNS64 answers are round-robin: sort so the chosen address is stable between runs
    return addresses.sort();
}

async function check(host) {
    const result = { host, native: 'no', status: 'NONE', ipv6: '', error: '' };
    try {
        result.ipv6 = (await resolve6(host))[0];
        return { ...result, native: 'yes', status: 'NATIVE' };
    } catch (e) {
        if (!NO_RECORD_CODES.includes(e.code)) result.error = `native: ${e.code || e.message}`;
    }
    for (const server of [NAT64_DNS, NAT64_DNS_BACKUP]) {
        try {
            result.ipv6 = (await resolve6(host, server))[0];
            return { ...result, status: 'NAT64' };
        } catch (e) {
            result.error += ` ${server}: ${e.code || e.message}`;
        }
    }
    result.error = result.error.trim();
    return result;
}

async function main() {
    const url = process.env.spidMetadataOfficialURL;
    if (!url) throw new Error('spidMetadataOfficialURL is not set in .env (see .env-example)');

    const response = await fetch(url);
    if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status}`);
    const idps = await response.json();
    if (!Array.isArray(idps)) throw new Error(`Expected a JSON array from ${url}`);

    // the registry itself is fetched by this client, so it needs IPv6 too; list it first
    const registryHost = hostOf(url);
    const entries = [{ idp: { organization_name: 'SPID Registry' }, host: registryHost }].concat(idps.flatMap(idp => collectHosts(idp).map(host => ({ idp, host }))));
    const uniqueHosts = [...new Set(entries.map(e => e.host))];
    const checks = new Map((await Promise.all(uniqueHosts.map(check))).map(r => [r.host, r]));

    const rows = entries.map(({ idp, host }) => {
        const r = checks.get(host);
        const flag = idp._deleted === 'Y' ? ' [deleted]' : idp._disabled === 'Y' ? ' [disabled]' : '';
        return {
            IdP: (idp.organization_name || idp.entity_id) + flag,
            Host: host,
            'Native AAAA': r.native,
            Status: r.status,
            IPv6: r.ipv6,
            Error: r.error,
        };
    });
    console.table(rows);

    const nat64 = [...checks.values()].filter(r => r.status === 'NAT64')
        .sort((a, b) => (b.host === registryHost) - (a.host === registryHost) || a.host.localeCompare(b.host));
    console.log('\n# docker-compose.yml');
    if (nat64.length) {
        console.log('extra_hosts:');
        nat64.forEach(r => console.log(`  - "${r.host}:${r.ipv6}"`));
    } else {
        console.log('# no extra_hosts needed');
    }

    const none = [...checks.values()].filter(r => r.status === 'NONE');
    if (none.length) {
        console.error(`\nNo IPv6 address (native or NAT64) for: ${none.map(r => r.host).join(', ')}`);
        process.exitCode = 1;
    }
}

main().catch(e => {
    console.error(e.message);
    process.exit(1);
});
