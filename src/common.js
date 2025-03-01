require('dotenv').config()
const slugify = require('slugify')
const fs = require('fs')

const config = {
    ...process.env
}

const SPID_PREFIX = 'SPID ';
const SPID_ALIAS_PREFIX = 'spid-';
exports.config = config

exports.usernameMapperTemplate = require('../template/username_mm.json')
exports.lastnameMapperTemplate = require('../template/lastname_mm.json')
exports.firstnameMapperTemplate = require('../template/firstname_mm.json')

exports.spidCodeMapperTemplate = require('../template/spidcode_mm.json');
exports.emailMapperTemplate = require('../template/email_mm.json');
exports.taxIdMapperTemplate = require('../template/taxid_mm.json');
exports.genderMapperTemplate = require('../template/gender_mm.json');
exports.dateOfBirthMapperTemplate = require('../template/dateofbirth_mm.json');
exports.placeOfBirthMapperTemplate = require('../template/placeofbirth_mm.json');
exports.countyOfBirthMapperTemplate = require('../template/countyofbirth_mm.json');
exports.mobilePhoneMapperTemplate = require('../template/mobilephone_mm.json');
exports.addressMapperTemplate = require('../template/address_mm.json');
exports.digitalAddressMapperTemplate = require('../template/digitaladdress_mm.json');
exports.companyNameMapperTemplate = require('../template/companyname_mm.json');
exports.companyAddressMapperTemplate = require('../template/companyaddress_mm.json');
exports.vatNumberapperTemplate = require('../template/vatnumber_mm.json');


exports.patchTemplate = function (templateFilePath) {
    let templateString = fs.readFileSync(templateFilePath).toString();
    return templateString.replace(/%REALM%/g, config.realm)
        .replace(/%KEYCLOAKSERVERBASEURL%/g, config.keycloakServerBaseURL)
}

exports.enrichIdpWithConfigData = function (idpOriginal) {
    let idp = {
        ipa_entity_code: idpOriginal.code,
        entity_name: idpOriginal.organization_name,
        displayName: idpOriginal.organization_display_name,
        registry_link: idpOriginal.registry_link.replace('?output=json', ''),
        metadata_url: idpOriginal.registry_link.replace('?output=json', '')
    };
    if (config.spidMetadataAlternativeURLEnabled === 'true' && idpOriginal.file_name) {
        idp['metadata_url']=config.spidMetadataAlternativeURLPrefix + idpOriginal.file_name;
    }
    let cleanedupSpidName = idp.entity_name.replace('TI Trust Technologies', 'Tim').replace(/ ID|SPIDItalia | S\.C\.p\.A\.| S\.p\.A\.| srl| spa| italiane|PEC/ig, '');
    idp.alias = slugify(SPID_ALIAS_PREFIX + cleanedupSpidName).toLowerCase();
    if (idp.metadata_url != config.spidValidatorIdPMetadataURL) { // do not tamper official name as per AgID guidelines
        idp.displayName = SPID_PREFIX + cleanedupSpidName;
    } 
    idp.config = {
        otherContactPhone: config.otherContactPhone,
        otherContactEmail: config.otherContactEmail,
        otherContactIpaCode: config.otherContactIpaCode,
        organizationNames: config.organizationNames,
        organizationDisplayNames: config.organizationDisplayNames,
        organizationUrls: config.organizationUrls,
        attributeConsumingServiceName: config.attributeConsumingServiceName,
        metadataDescriptorUrl: idp.metadata_url,
        useMetadataDescriptorUrl: true
    };
    return idp;
}