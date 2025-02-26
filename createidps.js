const {from, of, concat, EMPTY} = require('rxjs')
const {map, mergeMap, isEmpty} = require('rxjs/operators')
const {config, patchTemplate, enrichIdpWithConfigData} = require('./src/common')
const {
    httpGrabIdPsMetadata,
    httpCallKeycloakImportConfig,
    httpCallKeycloakCreateIdP,
    httpCallKeycloakDeleteIdP,
    httpCallKeycloakCreateAllMappers,
    httpGrabKeycloaktokenOnce
} = require('./src/http')


const idPTemplate = JSON.parse(patchTemplate('./template/idpmodel.json'))

var getOfficialSpididPsMetadata$;

if(typeof(config.spidMetadataOfficialURL) !== 'undefined' && config.spidMetadataOfficialURL !== "") { 
    //recupero url metadati
    getOfficialSpididPsMetadata$ = from(httpGrabIdPsMetadata())
        .pipe(mergeMap(httpResponse => from(httpResponse.data.filter(idp => !config.singleIdp || idp.entity_id == config.singleIdp).map(idp => enrichIdpWithConfigData(idp)))));
    
}
else 
    getOfficialSpididPsMetadata$ = EMPTY;


if (config.createSpidTestIdP === 'true') {
    let spidTestIdPOfficialMetadata = {
        code: config.spidTestIdPAlias,
        organization_name: config.spidTestIdPAlias,
        organization_display_name: config.spidTestIdPAlias,
        registry_link: config.spidTestIdPMetadataURL
    }
    getOfficialSpididPsMetadata$ = concat(getOfficialSpididPsMetadata$, of(enrichIdpWithConfigData(spidTestIdPOfficialMetadata)));    
}

if (config.createSpidValidatorIdP === 'true') {
    let spidValidatorIdPOfficialMetadata = {
        code: config.spidValidatorIdPAlias,
        organization_name: config.spidValidatorIdPAlias,
        organization_display_name: config.spidValidatorIdPDisplayName,
        registry_link: config.spidValidatorIdPMetadataURL
    }
    getOfficialSpididPsMetadata$ = concat(getOfficialSpididPsMetadata$, of(enrichIdpWithConfigData(spidValidatorIdPOfficialMetadata)))
}

if (config.createSpidDemoIdP === 'true') {
    let spidDemoIdPOfficialMetadata = {
        code: config.spidDemoIdPAlias,
        organization_name: config.spidDemoIdPAlias,
        organization_display_name: config.spidDemoIdPAlias,
        registry_link: config.spidDemoIdPMetadataURL
    }
    getOfficialSpididPsMetadata$ = concat(getOfficialSpididPsMetadata$, of(enrichIdpWithConfigData(spidDemoIdPOfficialMetadata)))
}


var noIdpToSetUp; 
getOfficialSpididPsMetadata$.pipe(isEmpty()).subscribe(r => {
    noIdpToSetUp = r;
});

if(noIdpToSetUp){
    console.error("No idp configured to be set up, exiting");
    return;
}

//getOfficialSpididPsMetadata$.subscribe(console.log);

//richiesta cancellazione degli idPs da keycloak
var deleteKeycloakSpidIdPs$ = getOfficialSpididPsMetadata$
    .pipe(mergeMap(spidIdPOfficialMetadata => from(httpCallKeycloakDeleteIdP(spidIdPOfficialMetadata.alias).then(httpResponse => spidIdPOfficialMetadata))))


//richiesta conversione in import-config model [idP,import-config-response]
var getKeycloakImportConfigModels$ = deleteKeycloakSpidIdPs$
    .pipe(mergeMap(spidIdPOfficialMetadata => from(httpCallKeycloakImportConfig(spidIdPOfficialMetadata.metadata_url).
    then(httpResponse => {
        return [spidIdPOfficialMetadata, httpResponse.data]
    }))))

//trasformazione ed arricchimento => modello per creare l'idP su keycloak
var enrichedModels$ = getKeycloakImportConfigModels$
    .pipe(map(spidIdPOfficialMetadataWithImportConfigModel => {
        let [idPOfficialMetadata, importConfigModel] = spidIdPOfficialMetadataWithImportConfigModel
        let configIdp = {...idPTemplate.config, ...importConfigModel, ...idPOfficialMetadata.config}
        let firstLevel = {
            alias: idPOfficialMetadata.alias,
            displayName: idPOfficialMetadata.displayName
        }
        let merged = {...idPTemplate, ...firstLevel}
        merged.config = configIdp
        merged.config.metadataDescriptorUrl=idPOfficialMetadata.metadata_url;
        return merged
    }))

//creazione dello spid idP su keycloak
var createSpidIdPsOnKeycloak$ = enrichedModels$
    .pipe(mergeMap(idPToCreateModel => from(httpCallKeycloakCreateIdP(idPToCreateModel).then(httpResponse => [idPToCreateModel.alias, httpResponse]))))

//creazione dei mappers per lo spid id
var createKeycloackSpidIdPsMappers$ = createSpidIdPsOnKeycloak$.pipe(mergeMap(idPAliasWithHttpCreateResponse => {
    let [alias, createResponse] = idPAliasWithHttpCreateResponse
    return from(httpCallKeycloakCreateAllMappers(alias).then(response => {
        return {alias, create_response: createResponse.status, mapper_response: response}
    }))
}))

// retrieve a single keycloak token before starting
httpGrabKeycloaktokenOnce().then(token => {
    console.log('Successfully retrieved Keycloak token');
    config.token = token;
    createKeycloackSpidIdPsMappers$.subscribe(console.log);
});