const {config} = require('./common')
const qs = require('qs')
const axios = require('axios')
const https = require('https')
const {
  usernameMapperTemplate,
  lastnameMapperTemplate,
  firstnameMapperTemplate,
  spidCodeMapperTemplate,
  emailMapperTemplate,
  taxIdMapperTemplate,
  genderMapperTemplate,
  dateOfBirthMapperTemplate,
  placeOfBirthMapperTemplate,
  countyOfBirthMapperTemplate,
  mobilePhoneMapperTemplate,
  addressMapperTemplate,
  digitalAddressMapperTemplate,
  companyNameMapperTemplate,
  companyAddressMapperTemplate,
  vatNumberapperTemplate,
  patchTemplate
} = require('./common')

const agent = new https.Agent({
    rejectUnauthorized: false
});

const tokenConfig = {
    httpsAgent : agent,
    method: 'post',
    url: config.keycloakServerBaseURL + '/realms/' + config.adminRealm + '/protocol/openid-connect/token',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: qs.stringify({
        'client_id': config.adminClientId,
        'username': config.adminUsername,
        'password': config.adminPwd,
        'grant_type': 'password'
    })
};

exports.httpGrabIdPsMetadata = function () {
    return axios({
        httpsAgent: agent,
        method: 'get',
        url: config.spidMetadataOfficialURL,
        headers: {}
    })
        .catch(function (error) {
            handleHttpError(error);
        });

}

const httpGrabKeycloaktoken = function() {
    return new Promise(function(resolve) {
        resolve(config.token)
      });
}

exports.httpGrabKeycloaktoken = httpGrabKeycloaktoken

const httpGrabKeycloaktokenOnce = function () {
    return axios(tokenConfig)
        .then(response => response.data.access_token)
        .catch(function (error) {
            console.error('Error retrieving Keycloak token');
            handleHttpError(error);
        });
}

exports.httpGrabKeycloaktokenOnce = httpGrabKeycloaktokenOnce

exports.httpCallKeycloakImportConfig = function (idPsMetadataUrl) {
    return httpGrabKeycloaktoken().then(token => {
        let data = JSON.stringify({"providerId": "spid-saml", "fromUrl": idPsMetadataUrl});
        let axiosConfig = {
            httpsAgent : agent,
            method: 'post',
            url: config.keycloakServerBaseURL + '/admin/realms/' + config.realm + '/identity-provider/import-config',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            data: data
        };
        return axios(axiosConfig)
            .catch(function (error) {
                console.error('Error importing IdP configuration from metadata - error ' + error.response.status + ' - ' + idPsMetadataUrl);
                handleHttpError(error);
            });
    })

}


exports.httpCallKeycloakCreateIdP = function (idPModel) {
    return httpGrabKeycloaktoken().then(token => {
        let data = JSON.stringify(idPModel);
        let axiosConfig = {
            httpsAgent : agent,
            method: 'post',
            url: config.keycloakServerBaseURL + '/admin/realms/' + config.realm + '/identity-provider/instances',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            data: data
        };
        return axios(axiosConfig)
            .catch(function (error) {
                console.error('Error creating IdP '+idPModel.alias);
                handleHttpError(error);
            });
    })
}


exports.httpCallKeycloakDeleteIdP = function (idPAlias) {
    return httpGrabKeycloaktoken().then(token => {
        let axiosConfig = {
            httpsAgent : agent,
            method: 'delete',
            url: config.keycloakServerBaseURL + '/admin/realms/' + config.realm + '/identity-provider/instances/' + idPAlias,
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        };
        return axios(axiosConfig)
            .catch(function (error) {
                if (error.response.status == 404)
                    console.error('No IdP '+idPAlias+' found in keycloak to delete');
                else
                    handleHttpError('keycloak error: '+error);
            });
    })
}

exports.httpCallKeycloakGetIpds = function () {
    return httpGrabKeycloaktoken().then(token => {
        let axiosConfig = {
            httpsAgent : agent,
            method: 'get',
            url: config.keycloakServerBaseURL + '/admin/realms/' + config.realm + '/identity-provider/instances',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        };
        return axios(axiosConfig)
            .catch(function (error) {
                handleHttpError(error);
            });
    })
}


exports.httpCallKeycloakGetIpdDescription = function (idpAlias) {
    let axiosConfig = {
        httpsAgent : agent,
        method: 'get',
        url: config.keycloakServerBaseURL + '/realms/' + config.realm + '/broker/' + encodeURIComponent(idpAlias) + '/endpoint/descriptor',
    };
    return axios(axiosConfig)
        .catch(function (error) {
            handleHttpError(error);
        });

}


exports.httpCallKeycloakCreateAllMappers = function (idPAlias) {
    return Promise.all([
        httpCallKeycloakCreateMapper(idPAlias, usernameMapperTemplate),
        httpCallKeycloakCreateMapper(idPAlias, lastnameMapperTemplate),
        httpCallKeycloakCreateMapper(idPAlias, firstnameMapperTemplate),
        httpCallKeycloakCreateMapper(idPAlias, spidCodeMapperTemplate),
        httpCallKeycloakCreateMapper(idPAlias, emailMapperTemplate),
        httpCallKeycloakCreateMapper(idPAlias, taxIdMapperTemplate),
        httpCallKeycloakCreateMapper(idPAlias, genderMapperTemplate),
        httpCallKeycloakCreateMapper(idPAlias, dateOfBirthMapperTemplate),
        httpCallKeycloakCreateMapper(idPAlias, placeOfBirthMapperTemplate),
        httpCallKeycloakCreateMapper(idPAlias, countyOfBirthMapperTemplate),
        httpCallKeycloakCreateMapper(idPAlias, mobilePhoneMapperTemplate),
        httpCallKeycloakCreateMapper(idPAlias, addressMapperTemplate),
        httpCallKeycloakCreateMapper(idPAlias, digitalAddressMapperTemplate)
        // httpCallKeycloakCreateMapper(idPAlias, companyNameMapperTemplate),
        // httpCallKeycloakCreateMapper(idPAlias, companyAddressMapperTemplate),
        // httpCallKeycloakCreateMapper(idPAlias, vatNumberapperTemplate),
    ])
}

exports.httpCallKeycloakImportRealm = function () {
    return httpGrabKeycloaktoken().then(token => {
        let data = patchTemplate('./template/realm-template.json');
        let axiosConfig = {
            httpsAgent : agent,
            method: 'post',
            url: config.keycloakServerBaseURL + '/admin/realms/',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            data: data
        };
        return axios(axiosConfig)
            .catch(function (error) {
                handleHttpError(error);
            });
    })
}


const httpCallKeycloakCreateMapper = function (idPAlias, mapperModel) {
    return httpGrabKeycloaktoken().then(token => {
        mapperModel.identityProviderAlias = idPAlias
        let data = JSON.stringify(mapperModel);
        let axiosConfig = {
            httpsAgent : agent,
            method: 'post',
            url: config.keycloakServerBaseURL + '/admin/realms/' + config.realm + '/identity-provider/instances/' + idPAlias + '/mappers',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            data: data
        };
        return axios(axiosConfig)
            .catch(function (error) {
                handleHttpError(error);
            });
    })
}

const handleHttpError = function(error) {
    if (undefined !== error.response && undefined !== error.response.data) {
        if (undefined !== error.response.data.errorMessage) {
            console.error(error.response.data.errorMessage);
            return;
        }
        if (undefined !== error.response.data.error) {
            console.error(error.response.data.error);
            return;
        }
    }
    else
        console.error(error);
}