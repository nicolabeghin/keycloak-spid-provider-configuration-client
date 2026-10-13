# Keycloak SPID providers configuration client
A NodeJS client to automatically configure a Keycloak instance already setup with [keycloak-spid-provider plugin](https://github.com/italia/keycloak-spid-provider)

* downloads metadata for [all 10 official SPID IdPs](https://registry.spid.gov.it/assets/data/idp.json) and creates related Keycloak configuration along with [mappers](https://github.com/italia/spid-keycloak-provider/wiki/Mapping-SPID-attributes)
* creates Keycloak configuration for AgID SPID Demo Validator (https://demo.spid.gov.it/validator)
* creates Keycloak configuration for AgID SPID Validator (for accreditamento) (https://validator.spid.gov.it)
* creates Keycloak configuration for a local [spid-saml-check](https://github.com/italia/spid-saml-check) instance
<img width="1179" alt="image" src="https://user-images.githubusercontent.com/2743637/212466689-d32dd3a6-7374-46c3-9bf5-ac5e33fe467c.png">

<img width="1169" alt="image" src="https://user-images.githubusercontent.com/2743637/212466914-c59f9ba1-bf89-4cd6-86d1-809b45b76f53.png">

## Requirements
Docker or `node` and `npm`

## Configuration
Copy `.env-example` to `.env`, configure it and wipe out the comments
If you want to have official AgID SPID Demo Validator (https://demo.spid.gov.it/validator) enabled, set the following `.env` file properties

```
createSpidDemoIdP = true 
```

If you want to have official AgID SPID Validator (https://validator.spid.gov.it) enabled, set the following `.env` file properties

```
createSpidValidatorIdP = true 
``` 

If you have a local [spid-saml-check](https://github.com/italia/spid-saml-check) instance, set the following `.env` file properties

```
createSpidTestIdP = true 
spidTestIdPAlias = spid-saml-check
spidTestIdPMetadataURL = https://localhost:8443/metadata.xml
```

If you have a local [spid-saml-check](https://github.com/italia/spid-saml-check) demo instance, set the following `.env` file properties

```
createSpidTestDemoIdP = true
spidTestDemoIdPMetadataURL = https://localhost:8443/demo/metadata.xml
```

In both cases, make sure that Keycloak can reach the `spidTestIdPMetadataURL` and `spidTestDemoIdPMetadataURL` URLs and [trusts the `spid-saml-check` certificate](https://www.keycloak.org/server/keycloak-truststore#_configuring_the_system_truststore) (found in `spid-saml-check/spid-validator/config/spid-saml-check.crt`). You can create a new certificate based on your domain (if different from `localhost:8443`) with the following command:

    openssl req -x509 -newkey rsa:4096 -sha256 -days 3650 -nodes \
        -keyout spid-saml-check/spid-validator/config/spid-saml-check.key \
        -out spid-saml-check/spid-validator/config/spid-saml-check.pem \
        -subj "/C=IT/ST=MI/L=Milan/O=AgID/OU=Servizio Accreditamento/CN=yourdomain.com:8443" \
        -addext "subjectAltName = DNS:yourdomain.com, DNS:localhost:8443"

If you want to use [spid-sp-test](https://github.com/italia/spid-sp-test), set the following `.env` file properties

```
createSpidSpTestIdP = true
spidSpTestIdPMetadataURL = https://yourdomain.com/spid-sp-test.xml
```

Make sure you can uploaded the spid-sp-test metadata.xml to a Keycloak-reachable URL as above. The XML file can be generated with 

    docker run --rm -it italia/spid-sp-test --idp-metadata > spid-sp-test.xml


## Running the tool
### Docker
Easiest way by leveraging Docker:

    make

### Without Docker
If you have NodeJS installed 
```
npm install
npm run create-idps
```

## Authentication flow
By default, the new IdPs are created with a SPID-specific Authentication Flow, as per https://github.com/italia/spid-keycloak-provider/wiki/Configuring-the-Authentication-Flow - this is named `first broker login SPID` (ref. [idpmodel.json#L11](https://github.com/nicolabeghin/keycloak-spid-provider-configuration-client/blob/master/template/idpmodel.json#L11)) and must be created before running the client.

<img width="1455" alt="image" src="https://user-images.githubusercontent.com/2743637/212534098-d6add32d-db1b-4c63-b203-f37f78fee8f9.png">

## Customizing requested SPID attributes
By default the tool requests the standard SPID attribute set (`spidCode`, `name`, `familyName`, `fiscalNumber`, `email`, `gender`, `dateOfBirth`, `placeOfBirth`, `countyOfBirth`, `mobilePhone`, `address`, `digitalAddress`, plus the metadata-only `idCard`, `registeredOffice`, `expirationDate`).

You can override the list via `.env`:

```
requestedAttributes = spidCode,name,familyName,fiscalNumber,email
```

Only the attributes you list will be (a) declared in the SP metadata `<md:RequestedAttribute>` block and (b) created as Keycloak attribute mappers on each IdP. The `username` (principal) mapper is always created.

Opt-in attributes not in the default list: `companyName`, `companyAddress`, `ivaCode`.

Set `requestedAttributesStrict = false` to tolerate unknown attribute names with a warning. Default is `true` (fail fast on typos).

## IPv6 readiness check
Most SPID IdPs (and `registry.spid.gov.it`) have no AAAA record, so an IPv6-only Docker host can't reach them directly. `spid-idp-ipv6-readiness.js` checks this and, for hosts without IPv6, resolves a NAT64 address through a DNS64 resolver.

    make ipv6-readiness

It reads the IdP list from `spidMetadataOfficialURL` in `.env` and runs inside the `spidclient` Docker image (the current `.env` is mounted read-only). For the registry host and every host in the IdPs' `single_sign_on_service` / `single_logout_service` endpoints it prints a table (native AAAA, status `NATIVE` / `NAT64` / `NONE`, IPv6 address) followed by a ready-to-paste `extra_hosts` block for `docker-compose.yml`:

```
extra_hosts:
  - "registry.spid.gov.it:2a00:1098:2b::1:1266:90c"
  - "id.eht.eu:2a00:1098:2b::1:1266:4988"
  - "id.lepida.it:2a00:1098:2b::1:c33e:a2db"
  - "identity.infocert.it:2a00:1098:2b::1:22fc:8e00"
  - "identity.sieltecloud.it:2a00:1098:2b::1:b96b:b934"
  - "idp.namirialtsp.com:2a00:1098:2b::1:b9d9:1d0d"
  - "login.id.tim.it:2a00:1098:2b::1:3e4d:3c63"
  - "loginspid.aruba.it:2a00:1098:2b::1:d93d:803"
  - "loginspid.infocamere.it:2a00:1098:2b::1:5052:23"
  - "posteid.poste.it:2a00:1098:2b::1:4e8:810"
  - "spid.intesigroup.com:2a00:1098:2b::1:c20f:2c70"
  - "spid.register.it:2a00:1098:2b::1:5158:3b13"
  - "spid.teamsystem.com:2a00:1098:2b::1:b064:ad2b"
```

The block above is a reference snapshot of one run; regenerate it for current addresses.

Notes:
- The registry is listed first, the other hosts alphabetically. DNS64 answers are round-robin, so the lowest address is picked to keep the output stable between runs.
- The command exits with code 1 if some host has no IPv6 address at all (neither native nor via NAT64).
- NAT64 addresses embed the IdP's IPv4 address: re-run periodically, as the pinned entries go stale if an IdP changes IP.
- DNS64 servers default to `2a01:4f9:c010:3f02::1` (backup `2a00:1098:2c::1`); override with the `NAT64_DNS` / `NAT64_DNS_BACKUP` environment variables.

## SPID access button integrated in Keycloak theme
https://github.com/nicolabeghin/keycloak-spid-provider-configuration-client/wiki/SPID-access-button-integrated-in-Keycloak-theme
<img width="285" alt="image" src="https://user-images.githubusercontent.com/2743637/212535193-aae9e8ce-b4f1-4411-9811-def46419bacf.png">

## Credits
* forked from https://github.com/GermanoGiudici/keycloak-spid-provider-configuration-client (kudos to @GermanoGiudici)
* this project is released under the Apache License 2.0, same as the main Keycloak package.
