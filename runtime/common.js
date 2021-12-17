class ChangeSetManager {
    getChangeSetType() {
        let result;
        if (window.location.href.includes("inboundChangeSetDetailPage")) {
            result = "inbound";
        } else if (window.location.href.includes("outboundChangeSetDetailPage")) {
            result = "outbound";
        }
        if (result === "outbound") {
            result += "-" + window.document.querySelector('span[id$="status_section:outboundCs__status"]').innerText.toLowerCase();
        }
        return result;
    }

    async getCsv() {
        let resultCsv = "Name,Parent Object,Type,API Name\n";
        resultCsv += this.getCsvStringsFromChangeSetCollection(await this.getChangeSetCollection());
        return resultCsv;
    }

    async getJson() {
        return JSON.stringify(await this.getChangeSetCollection(), null, '\t');
    }

    getChangeSetNameForFile() {
        return this.getChangeSetName().replaceAll(/[\s\-\.\/\\\+\=\$\%\&\*\@\!\(\)]+/gi, '_');
    }

    getChangeSetName() {
        return document.querySelector("h2.pageDescription").innerText;
    }

    getComponentsTableSelector() {
        let componentsTableSelector = null;
        if (window.location.href.includes("inboundChangeSetDetailPage")) {
            componentsTableSelector = 'tbody[id$="ics_component_list_table:tb"]';
        } else {
            componentsTableSelector = 'tbody[id$="ComponentList:tb"]';
        }
        return componentsTableSelector;
    }

    getProfilesTableSelector() {
        let profileTableSelector = null;
        if (window.location.href.includes("inboundChangeSetDetailPage")) {
            profileTableSelector = 'tbody[id$="ics_profile_list_table:tb"]';
        } else {
            profileTableSelector = 'tbody[id$="ProfileList:tb"]';
        }
        return profileTableSelector;
    }

    async getChangeSetCollection(collectionFormat) {
        collectionFormat = collectionFormat || "changeSetCollection";
        let componentsTableSelector = this.getComponentsTableSelector();
        let profilesTableSelector = this.getProfilesTableSelector();
        let changeSetCollection = {};
        let changeSetDuplicationChecker = [];

        //ChangeSet Components
        await this.goToFirstPage();
        let navigationToNextStatus = null;
        while (navigationToNextStatus !== "noButton") {
            if (document.querySelector(componentsTableSelector)) {
                let rows = document.querySelector(componentsTableSelector).querySelectorAll("tr");
                for (let i = 0; i < rows.length; i++) {
                    let changeSetItem = this.getChangeSetItemFromTr(rows[i]);
                    this.addChangeSetItemToChangeSetCollection(changeSetCollection, changeSetDuplicationChecker, changeSetItem);
                }
                navigationToNextStatus = await this.goToNextPage();
            } else {
                navigationToNextStatus = "noButton"
            }
        }

        //ChangeSet Profiles
        if (document.querySelector(profilesTableSelector)) {
            let rows = document.querySelector(profilesTableSelector).querySelectorAll("tr");
            for (let i = 0; i < rows.length; i++) {
                let changeSetItem = this.getProfileChangeSetItemFromTr(rows[i]);
                this.addChangeSetItemToChangeSetCollection(changeSetCollection, changeSetDuplicationChecker, changeSetItem);
            }
        }

        this.sortChangeSetCollection(changeSetCollection);

        let result;
        if (collectionFormat === "changeSetCollection") {
            result = changeSetCollection;
        } else if (collectionFormat === "changeSetDuplicationChecker") {
            result = changeSetDuplicationChecker;
        }
        return result;
    }

    sortChangeSetCollection(changeSetCollection) {
        Object
            .keys(changeSetCollection)
            .forEach((changeSetItemType) => {
                changeSetCollection[changeSetItemType].sort((a, b) => {
                    if (a.name < b.name) return -1;
                    if (a.name > b.name) return 1;
                    return 0;
                })
            });
    }

    addChangeSetItemToChangeSetCollection(changeSetCollection, changeSetDuplicationChecker, changeSetItem) {
        let changeSetItemId = this.getChangeSetItemId(changeSetItem);
        if (!changeSetDuplicationChecker.includes(changeSetItemId)) {
            changeSetDuplicationChecker.push(changeSetItemId);
            if (!changeSetCollection[changeSetItem.type]) {
                changeSetCollection[changeSetItem.type] = [];
            }
            changeSetCollection[changeSetItem.type].push(changeSetItem);
        }
    }

    getChangeSetItemId(changeSetItem, withoutParentObject) {
        return this.getCsvStringFromChangeSetItem(changeSetItem, withoutParentObject);
    }

    getProfileChangeSetItemFromTr(trElement) {
        let thisDatas = trElement.querySelectorAll("td");
        let result = {
            "name" : thisDatas[1].innerText,
            "parentObject" : "",
            "type" : "Profile",
            "apiName" : thisDatas[2].innerText
        };
        return result;
    }

    getChangeSetItemFromTr(trElement) {
        let thisDatas = trElement.querySelectorAll("td");
        let result = {
            "name" : thisDatas[1].innerText,
            "parentObject" : thisDatas[2].innerText,
            "type" : thisDatas[3].innerText,
            "apiName" : thisDatas[4].innerText
        };
        //Post-processing
        if (result.type === "Custom Metadata Type" || result.type === "Custom Setting") {
            result.type = "Custom Object";
        }
        if (result.type === "Flow Version") {
            result.type = "Flow Definition";
        }
        if (result.type === "Classic Email Template") {
            result.type = "Email Template";
        }
        return result;
    }

    getChangeSetItemFromCsvLine(csvLineElement) {
        let thisDatas = csvLineElement.split(',');
        return {
            "name" : thisDatas[0],
            "parentObject" : thisDatas[1],
            "type" : thisDatas[2],
            "apiName" : thisDatas[3]
        };
    }

    getCsvStringsFromChangeSetCollection(changeSetCollection) {
        let csvStrings = "";
        Object
            .keys(changeSetCollection)
            .forEach((changeSetItemType) => {
                changeSetCollection[changeSetItemType].forEach((changeSetItem) => {
                    csvStrings += this.getCsvStringFromChangeSetItem(changeSetItem);
                })
            });
        return csvStrings;
    }

    getCsvStringFromChangeSetItem(changeSetItem, withoutParentObject) {
        return [changeSetItem.name, withoutParentObject ? "" : changeSetItem.parentObject, changeSetItem.type, changeSetItem.apiName].join(",") + "\n";
    }

    async goToFirstPage() {
        if ((await this.navigateClickComponentList('a[id$="pageNavigatorComponent:firstPageLink"]')) === "noButton") {
            let previousResult = null;
            do {
                previousResult = await this.navigateClickComponentList('a[id$="pageNavigatorComponent:previousPageLink"]');
            } while (previousResult !== "noButton");
        }
        return true;
    }

    async goToNextPage() {
        return await this.navigateClickComponentList('a[id$="pageNavigatorComponent:nextPageLink"]');
    }

    navigateClickComponentList(btnSelector) {
        //console.log("ChangeSetManager Action", btnSelector);
        return new Promise((resolve, reject) => {
            let btnElement = document.querySelector(btnSelector);
            if (btnElement) {
                let originalMarker = this.getMarkerElement();
                btnElement.click();
                let intervalHandler = setInterval(() => {
                    if (originalMarker != this.getMarkerElement()) {
                        clearInterval(intervalHandler);
                        //console.log("ChangeSetManager Action", "Resolved " + btnSelector);
                        resolve("done");
                    }
                }, 500);
            } else {
                //console.log("ChangeSetManager Action", "Not exists action " + btnSelector);
                resolve("noButton");
            }
        });
    }

    getMarkerElement() {
        let componentsTableSelector = this.getComponentsTableSelector();
        let compTBody = document.querySelector(componentsTableSelector);
        let rows = compTBody.querySelectorAll("tr");
        let originalMarker = rows[0];
        return originalMarker.outerHTML;
    }

    //-------------------------

    importFromFile() {
        let fileChooser = document.createElement("input");
        fileChooser.style.display = "none";
        fileChooser.type = 'file';
        //fileChooser.accept = ".csv,.json";
        fileChooser.accept = ".json";

        fileChooser.addEventListener('change', (evt) => {
            if (evt.target.value.length == 0) {
                document.body.removeChild(fileChooser);
            } else {
                let f = evt.target.files[0];
                if(f) {
                    let reader = new FileReader();
                    reader.onload = (e) => {
                        let contents = e.target.result;
                        document.body.removeChild(fileChooser);

                        /*if (/^.*\.csv$/.test(f.name)) {
                            this.importFromCsv(contents);
                        } else */if (/^.*\.json$/.test(f.name)) {
                            this.importFromJson(contents);
                        } else {
                            alert("Not appropriate file format. \nUse JSON that you got from Export operation.");
                        }
                    }
                    reader.readAsText(f);
                }
            }
        });

        fileChooser.addEventListener("blur", (evt) => {
            document.body.removeChild(fileChooser);
        })

        document.body.appendChild(fileChooser);
        fileChooser.click();
    }

    importFromJson(contents) {
        let changeSetCollection = JSON.parse(contents);
        this.importFromChangeSetCollection(changeSetCollection);
    }

    importFromCsv(contents) {
        let changeSetCollection = {};
        let changeSetDuplicationChecker = [];
        let contentLines = contents.split('\n');
        contentLines.shift();
        contentLines.forEach((changeSetItemCsvLine) => {
            if (changeSetItemCsvLine) {
                let changeSetItem = this.getChangeSetItemFromCsvLine(changeSetItemCsvLine);
                this.addChangeSetItemToChangeSetCollection(changeSetCollection, changeSetDuplicationChecker, changeSetItem);
            }
        });
        this.sortChangeSetCollection(changeSetCollection);
        this.importFromChangeSetCollection(changeSetCollection);
    }

    async importFromChangeSetCollection(changeSetCollection) {
        let childWindow = await this.openChildWindow(window.location.href);
        await this.redirectWithButton(childWindow, 'input[id$="component_list_form_buttons:outboundCs_add"]');
        let internalChangeSetId = this.getQueryParameter(childWindow, "id");
        let customMetadataCheckList = await this.getCustomMetadataCheckListFromAddPage(childWindow);
        let orgMetadata = await this.getOrgMetadata(changeSetCollection, customMetadataCheckList);
        await this.importByTypes(childWindow, internalChangeSetId, changeSetCollection, orgMetadata);
    }

    async getCustomMetadataCheckListFromAddPage(childWindow) {
        let customMetadataList = {};
        /*childWindow.document.querySelectorAll("select#entityType option").forEach(optionElement => {
            if (optionElement.value.endsWith("__mdt")) {
                customMetadataList[optionElement.innerText] = {
                    "label" : optionElement.innerText,
                    "value" : optionElement.value
                };
            }
        });*/
        let apiResults = await this.getToolingAPIResults("SELECT DurableId,Label,QualifiedApiName FROM EntityDefinition WHERE QualifiedApiName LIKE '%__mdt'");
        for (let i = 0; i < apiResults.records.length; i++) {
            customMetadataList[apiResults.records[i].Label] = {
                "label" : apiResults.records[i].Label,
                "value" : apiResults.records[i].QualifiedApiName
            };
        }
        return customMetadataList;
    }

    async importByTypes(childWindow, internalChangeSetId, changeSetCollection, orgMetadata) {
        let existsChangeSetCollection = await this.getChangeSetCollection();
        //console.log(existsChangeSetCollection);
        let targetForm = childWindow.document.querySelector("form#editPage");

        let atLeastOne = false;
        Object.keys(changeSetCollection).forEach(changeSetItemsType => {
            changeSetCollection[changeSetItemsType].forEach(changeSetItem => {
                if ( !this.checkDuplicationInChangeSetCollection(existsChangeSetCollection, changeSetItem, orgMetadata) ) {
                    let addingResult = this.addChangeSetItemCheckboxToForm(childWindow, changeSetItemsType, changeSetItem, targetForm, orgMetadata);
                    atLeastOne = atLeastOne || addingResult;
                }
            });
        });

        if (atLeastOne === true) {
            await this.clickAddToChangeSetAndWait(childWindow);
        }
        childWindow.close();
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                alert("Done!");
                resolve("done");
                //window.location.reload();
            }, 500);
        });
    }

    checkDuplicationInChangeSetCollection(changeSetCollection, changeSetItem, orgMetadata) {
        let result = false;
        let typeResolver = this.getTypeResolver(changeSetItem.type, orgMetadata);
        if (typeResolver && changeSetCollection[changeSetItem.type]) {
            for (let i = 0; i < changeSetCollection[changeSetItem.type].length; i++) {
                let anotherChangeSetItem = changeSetCollection[changeSetItem.type][i];
                if (typeResolver.duplicateChecking(changeSetItem, anotherChangeSetItem)) {
                    result = true;
                    break;
                }
            }
        }
        return result;
    }

    addChangeSetItemCheckboxToForm(childWindow, changeSetItemsType, changeSetItem, targetForm, orgMetadata) {
        let result = false;
        let typeResolver = this.getTypeResolver(changeSetItemsType, orgMetadata);
        if (typeResolver) {
            let componentId = typeResolver.getId(changeSetItem, orgMetadata);
            if (componentId) {
                let tmpCheckbox = childWindow.document.createElement("input");
                tmpCheckbox.type = "checkbox";
                tmpCheckbox.name = "ids";
                tmpCheckbox.value = componentId;
                targetForm.appendChild(tmpCheckbox);
                tmpCheckbox.checked = true;
                //console.log(this.getChangeSetItemId(changeSetItem));
                result = true;
                console.info("Metadata Item Added", changeSetItem);
            } else {
                console.info("Can't get metadata - Skip", changeSetItem);
            }
        } else {
            console.info("Can't get type resolver - Skip", changeSetItem);
        }
        return result;
    }

    async clickAddToChangeSetAndWait(childWindow) {
        let currentLocationHref = childWindow.location.href;
        childWindow.document.querySelector('#topButtonRow input.btn[name="save"]').click();
        return new Promise((resolve, reject) => {
            let tmpInterval = setInterval(() => {
                if (currentLocationHref !== childWindow.location.href) {
                    clearInterval(tmpInterval);
                    resolve("done");
                }
            }, 1000);
        });
    }

    getQueryParameter(childWindow, queryParamKey) {
        let urlParams = new URLSearchParams(childWindow.location.search);
        let queryParamValue = urlParams.get(queryParamKey);
        return queryParamValue;
    }

    async redirectWithButton(childWindow, buttonSelector) {
        let oldChildWindowHref = childWindow.location.href;
        childWindow.document.querySelector(buttonSelector).click();
        return new Promise((resolve, reject) => {
            let tmpInterval = setInterval(() => {
                if (oldChildWindowHref !== childWindow.location.href) {
                    clearInterval(tmpInterval);
                    resolve(childWindow);
                }
            }, 1000);
        });
    }

    async getOrgMetadata(changeSetCollection, customMetadataCheckList) {
        let orgMetadata = {};
        let changeSetCollectionKeys = Object.keys(changeSetCollection);
        for (let i = 0; i < changeSetCollectionKeys.length; i++) {
            let changeSetItemsType = changeSetCollectionKeys[i];
            await this.pushToolingAPIItemsToOrgMetadataVariable(changeSetItemsType, changeSetCollection, orgMetadata, customMetadataCheckList);
        }
        console.log(customMetadataCheckList);
        console.log(orgMetadata);
        return orgMetadata;
    }

    async pushToolingAPIItemsToOrgMetadataVariable(changeSetItemsType, changeSetCollection, orgMetadata, customMetadataCheckList) {
        let result = null;
        let typeResolver = this.getTypeResolver(changeSetItemsType);
        if (typeResolver) {
            if (!orgMetadata[typeResolver.toolingApiTypeName]) {
                if (typeResolver["prerequisiteTypes"] && typeResolver["prerequisiteTypes"].length > 0) {
                    for (let i = 0; i < typeResolver["prerequisiteTypes"].length; i++) {
                        await this.pushToolingAPIItemsToOrgMetadataVariable(typeResolver["prerequisiteTypes"][i], changeSetCollection, orgMetadata);
                    }
                }
                if (typeResolver["toolingApiSoql"]) {
                    let soql = typeof typeResolver.toolingApiSoql === "function" ? typeResolver.toolingApiSoql(changeSetCollection, orgMetadata) : typeResolver.toolingApiSoql;
                    let rawData = await this.getToolingAPIResults(soql);
                    let parsedData = typeResolver.toolingApiTransformation(rawData);
                    orgMetadata[typeResolver.toolingApiTypeName] = parsedData;
                    result = parsedData;
                } else if (typeResolver["apiInfoHandler"]) {
                    let parsedData = await typeResolver.apiInfoHandler(this, changeSetCollection);
                    orgMetadata[typeResolver.toolingApiTypeName] = parsedData;
                    result = parsedData;
                }
            } else if (orgMetadata[typeResolver.toolingApiTypeName]) {
                result = orgMetadata[typeResolver.toolingApiTypeName];
            }
        } else if (customMetadataCheckList[changeSetItemsType]) {
            typeResolver = this.getTypeResolver("Custom Metadata Type Records");
            if (typeResolver && typeResolver["apiInfoHandler"]) {
                let parsedData = await typeResolver.apiInfoHandler(this, changeSetCollection, customMetadataCheckList[changeSetItemsType]);
                if (!orgMetadata[typeResolver.toolingApiTypeName]) {
                    orgMetadata[typeResolver.toolingApiTypeName] = {};
                }
                orgMetadata[typeResolver.toolingApiTypeName][changeSetItemsType] = parsedData;
                result = parsedData;
            }
        }
        return result;
    }

    openChildWindow(url) {
        return new Promise((resolve, reject) => {
            let childWindow = window.open(url, "ChangeSetManager Child Window", "width=800,height=600,menubar=no,toolbar=no,location=no,status=no,resizable=no,scrollbars=no");
            childWindow.onload = (event) => {
                resolve(childWindow);
            };
        });
    }

    getToolingAPIResults(soql) {
        return new Promise((resolve, reject) => {
            let url = "https://" + location.hostname + "/services/data/v51.0/tooling/query/?q=" + soql.replaceAll(/\s+/gi,"+").replaceAll(/\%/gi,"%25").replaceAll(/\&/gi,"%26");
            let sid = document.cookie.match(/(^|;\s*)sid=(.+?);/)[2];

            let xhr = new XMLHttpRequest();
            xhr.open('GET', url);
            xhr.setRequestHeader('Authorization', 'Bearer ' + sid);
            xhr.responseType = "json";
            xhr.send();
            xhr.onload = (event) => {
                let result = xhr.response;
                resolve(result);
            }
        });
    }

    getRestAPIResults(target) {
        return new Promise((resolve, reject) => {
            let url = "https://" + location.hostname + "/services/data/v51.0" + target.replaceAll(/\s+/gi,"+");
            let sid = document.cookie.match(/(^|;\s*)sid=(.+?);/)[2];

            let xhr = new XMLHttpRequest();
            xhr.open('GET', url);
            xhr.setRequestHeader('Authorization', 'Bearer ' + sid);
            xhr.responseType = "json";
            xhr.send();
            xhr.onload = (event) => {
                let result = xhr.response;
                resolve(result);
            }
        });
    }

    getTypeResolver(changeSetItemsType, orgMetadata) {
        let result = null
        if (ChangeSetManager.TypeResolver[changeSetItemsType]) {
            result = ChangeSetManager.TypeResolver[changeSetItemsType];
            if (result["sameAs"]) {
                result = this.getTypeResolver(result["sameAs"], orgMetadata);
            }
        } else if (orgMetadata && orgMetadata["CustomMetadataTypeRecords"] && orgMetadata["CustomMetadataTypeRecords"][changeSetItemsType]) {
            result = ChangeSetManager.TypeResolver["Custom Metadata Type Records"];
        }
        return result;
    }

    //--------------------------------------------

    static TypeResolver = {
        "Aura Component Bundle" : {
            toolingApiTypeName : "AuraDefinitionBundle",
            prerequisiteTypes : null,
            toolingApiSoql : "SELECT Id,DeveloperName FROM AuraDefinitionBundle WHERE NameSpacePrefix = null",
            toolingApiTransformation : (rawData) => {
                let result = {};
                rawData.records.forEach(rawDataRecord => {
                    result[rawDataRecord.DeveloperName] = rawDataRecord;
                });
                return result;
            },
            getId : (changeSetItem, orgMetadata) => {
                return orgMetadata["AuraDefinitionBundle"][changeSetItem.apiName].Id;
            },
            duplicateChecking : (changeSetItem, anotherChageSetItem) => {
                return (
                    changeSetItem.apiName === anotherChageSetItem.apiName
                );
            }
        },
        "Lightning Web Component Bundle" : {
            toolingApiTypeName : "LightningComponentBundle",
            prerequisiteTypes : null,
            toolingApiSoql : "SELECT Id,DeveloperName FROM LightningComponentBundle WHERE NameSpacePrefix = null",
            toolingApiTransformation : (rawData) => {
                let result = {};
                rawData.records.forEach(rawDataRecord => {
                    result[rawDataRecord.DeveloperName] = rawDataRecord;
                });
                return result;
            },
            getId : (changeSetItem, orgMetadata) => {
                return orgMetadata["LightningComponentBundle"][changeSetItem.apiName].Id;
            },
            duplicateChecking : (changeSetItem, anotherChageSetItem) => {
                return (
                    changeSetItem.apiName === anotherChageSetItem.apiName
                );
            }
        },
        "Action" : {
            toolingApiTypeName : "QuickActionDefinition",
            prerequisiteTypes : null,
            toolingApiSoql : "SELECT Id,DeveloperName,SobjectType FROM QuickActionDefinition WHERE NameSpacePrefix = null",
            toolingApiTransformation : (rawData) => {
                let result = {};
                rawData.records.forEach(rawDataRecord => {
                    if (rawDataRecord.SobjectType === "Global") {
                        result[rawDataRecord.DeveloperName] = rawDataRecord;
                    } else {
                        result[rawDataRecord.SobjectType + "." + rawDataRecord.DeveloperName] = rawDataRecord;
                    }
                });
                return result;
            },
            getId : (changeSetItem, orgMetadata) => {
                return orgMetadata["QuickActionDefinition"][changeSetItem.apiName].Id;
            },
            duplicateChecking : (changeSetItem, anotherChageSetItem) => {
                let changeSetItemApiName = changeSetItem.apiName.split(".");
                changeSetItemApiName = changeSetItemApiName[changeSetItemApiName.length - 1];
                let anotherChageSetItemApiName = anotherChageSetItem.apiName.split(".");
                anotherChageSetItemApiName = anotherChageSetItemApiName[anotherChageSetItemApiName.length - 1];
                return (
                    changeSetItemApiName === anotherChageSetItemApiName
                    && changeSetItem.parentObject === anotherChageSetItem.parentObject
                );
            }
        },
        "Apex Class" : {
            toolingApiTypeName : "ApexClass",
            prerequisiteTypes : null,
            toolingApiSoql : "SELECT Id,Name,NamespacePrefix FROM ApexClass WHERE NamespacePrefix = null",
            toolingApiTransformation : (rawData) => {
                let result = {};
                rawData.records.forEach(rawDataRecord => {
                    result[rawDataRecord.Name] = rawDataRecord;
                });
                return result;
            },
            getId : (changeSetItem, orgMetadata) => {
                return orgMetadata["ApexClass"][changeSetItem.apiName].Id;
            },
            duplicateChecking : (changeSetItem, anotherChageSetItem) => {
                return (
                    changeSetItem.apiName === anotherChageSetItem.apiName
                );
            }
        },
        "Apex Trigger" : {
            toolingApiTypeName : "ApexTrigger",
            prerequisiteTypes : null,
            toolingApiSoql : "SELECT Id,Name,NamespacePrefix FROM ApexTrigger WHERE NamespacePrefix = null",
            toolingApiTransformation : (rawData) => {
                let result = {};
                rawData.records.forEach(rawDataRecord => {
                    result[rawDataRecord.Name] = rawDataRecord;
                });
                return result;
            },
            getId : (changeSetItem, orgMetadata) => {
                return orgMetadata["ApexTrigger"][changeSetItem.apiName].Id;
            },
            duplicateChecking : (changeSetItem, anotherChageSetItem) => {
                return (
                    changeSetItem.apiName === anotherChageSetItem.apiName
                );
            }
        },
        "Profile" : {
            toolingApiTypeName : "Profile",
            prerequisiteTypes : null,
            toolingApiSoql : "SELECT Id,Name FROM Profile",
            toolingApiTransformation : (rawData) => {
                let result = {};
                rawData.records.forEach(rawDataRecord => {
                    result[rawDataRecord.Name] = rawDataRecord;
                });
                return result;
            },
            getId : (changeSetItem, orgMetadata) => {
                return orgMetadata["Profile"][changeSetItem.name].Id;
            },
            duplicateChecking : (changeSetItem, anotherChageSetItem) => {
                return (
                    changeSetItem.name === anotherChageSetItem.name
                );
            }
        },
        "Flow Definition" : {
            toolingApiTypeName : "FlowDefinition",
            prerequisiteTypes : null,
            toolingApiSoql : "SELECT Id,DeveloperName FROM FlowDefinition WHERE NamespacePrefix = null",
            toolingApiTransformation : (rawData) => {
                let result = {};
                rawData.records.forEach(rawDataRecord => {
                    result[rawDataRecord.DeveloperName] = rawDataRecord;
                });
                return result;
            },
            getId : (changeSetItem, orgMetadata) => {
                return orgMetadata["FlowDefinition"][changeSetItem.apiName].Id;
            },
            duplicateChecking : (changeSetItem, anotherChageSetItem) => {
                return (
                    changeSetItem.apiName === anotherChageSetItem.apiName
                );
            }
        },
        "Field Set" : {
            toolingApiTypeName : "FieldSet",
            prerequisiteTypes : null,
            toolingApiSoql : "SELECT Id,DeveloperName,EntityDefinition.QualifiedApiName FROM FieldSet WHERE NamespacePrefix = null",
            toolingApiTransformation : (rawData) => {
                let result = {};
                rawData.records.forEach(rawDataRecord => {
                    result[rawDataRecord.EntityDefinition.QualifiedApiName + "." + rawDataRecord.DeveloperName] = rawDataRecord;
                });
                return result;
            },
            getId : (changeSetItem, orgMetadata) => {
                return orgMetadata["FieldSet"][changeSetItem.apiName].Id;
            },
            duplicateChecking : (changeSetItem, anotherChageSetItem) => {
                return (
                    changeSetItem.name === anotherChageSetItem.name
                    && changeSetItem.parentObject === anotherChageSetItem.parentObject
                );
            }
        },
        "Custom Field" : {
            toolingApiTypeName : "FieldDefinition",
            prerequisiteTypes : null,
            toolingApiSoql : (changeSetCollection, orgMetadata) => {
                let soql = "SELECT DurableId,EntityDefinition.QualifiedApiName,QualifiedApiName FROM FieldDefinition WHERE ";
                let whereClauses = [];
                changeSetCollection["Custom Field"].forEach(customFieldItem => {
                    let whereClause = "EntityDefinition.QualifiedApiName = '" + customFieldItem.apiName.split(".")[0] + "'";
                    if (!whereClauses.includes(whereClause)) {
                        whereClauses.push(whereClause);
                    }
                });
                soql += whereClauses.join(" OR ");
                return soql;
            },
            toolingApiTransformation : (rawData) => {
                let result = {};
                rawData.records.forEach(rawDataRecord => {
                    result[rawDataRecord.EntityDefinition.QualifiedApiName + "." + rawDataRecord.QualifiedApiName] = rawDataRecord;
                });
                return result;
            },
            getId : (changeSetItem, orgMetadata) => {
                return orgMetadata["FieldDefinition"][changeSetItem.apiName].DurableId.split(".")[1];
            },
            duplicateChecking : (changeSetItem, anotherChageSetItem) => {
                function getClearAPIName(apiName) {
                    let result = apiName;
                    if (result.includes(".")) {
                        result = result.split(".")[1];
                    }
                    if (result.endsWith("__c")) {
                        result = result.substr(0, result.length - 3);
                    }
                    return result;
                }
                return (
                    changeSetItem.name === anotherChageSetItem.name
                    && getClearAPIName(changeSetItem.apiName) === getClearAPIName(anotherChageSetItem.apiName)
                    && changeSetItem.parentObject === anotherChageSetItem.parentObject
                );
            }
        },
        "Custom Object" : {
            toolingApiTypeName : "EntityDefinition",
            prerequisiteTypes : null,
            toolingApiSoql : (changeSetCollection, orgMetadata) => {
                let soql = "SELECT DurableId,QualifiedApiName FROM EntityDefinition WHERE ";
                let whereClauses = [];
                changeSetCollection["Custom Object"].forEach(customFieldItem => {
                    let whereClause = "QualifiedApiName = '" + customFieldItem.apiName + "'";
                    if (!whereClauses.includes(whereClause)) {
                        whereClauses.push(whereClause);
                    }
                });
                soql += whereClauses.join(" OR ");
                return soql;
            },
            toolingApiTransformation : (rawData) => {
                let result = {};
                rawData.records.forEach(rawDataRecord => {
                    result[rawDataRecord.QualifiedApiName] = rawDataRecord;
                });
                return result;
            },
            getId : (changeSetItem, orgMetadata) => {
                return orgMetadata["EntityDefinition"][changeSetItem.apiName].DurableId;
            },
            duplicateChecking : (changeSetItem, anotherChageSetItem) => {
                function getClearAPIName(apiName) {
                    let result = apiName;
                    if (result.includes(".")) {
                        result = result.split(".")[1];
                    }
                    if (result.endsWith("__c")) {
                        result = result.substr(0, result.length - 3);
                    }
                    if (result.endsWith("__mdt")) {
                        result = result.substr(0, result.length - 5);
                    }
                    return result;
                }
                return (
                    changeSetItem.name === anotherChageSetItem.name
                    && getClearAPIName(changeSetItem.apiName) === getClearAPIName(anotherChageSetItem.apiName)
                );
            }
        },
        "Custom Setting" : {
            sameAs : "Custom Object"
        },
        "Custom Metadata Type" : {
            sameAs : "Custom Object"
        },
        "Flow Version" : {
            sameAs : "Flow Definition"
        },
        "Classic Email Template" : {
            sameAs : "Email Template"
        },
        "Page Layout": {
            toolingApiTypeName : "Layout",
            prerequisiteTypes : null,
            toolingApiSoql : "SELECT Id,EntityDefinition.QualifiedApiName,Name FROM Layout",
            toolingApiTransformation : (rawData) => {
                let result = {};
                rawData.records.forEach(rawDataRecord => {
                    if (rawDataRecord.EntityDefinition && rawDataRecord.EntityDefinition.QualifiedApiName) {
                        result[rawDataRecord.EntityDefinition.QualifiedApiName + "-" + rawDataRecord.Name] = rawDataRecord;
                    }
                });
                return result;
            },
            getId : (changeSetItem, orgMetadata) => {
                let result = null;
                if (orgMetadata["Layout"][changeSetItem.apiName]) {
                    result = orgMetadata["Layout"][changeSetItem.apiName].Id;
                }
                return result;
            },
            duplicateChecking : (changeSetItem, anotherChageSetItem) => {
                return (
                    changeSetItem.name === anotherChageSetItem.name
                    && changeSetItem.parentObject === anotherChageSetItem.parentObject
                );
            }
        },
        "Visualforce Page" : {
            toolingApiTypeName : "ApexPage",
            prerequisiteTypes : null,
            toolingApiSoql : "SELECT Id,Name,NamespacePrefix FROM ApexPage WHERE NamespacePrefix = null",
            toolingApiTransformation : (rawData) => {
                let result = {};
                rawData.records.forEach(rawDataRecord => {
                    result[rawDataRecord.Name] = rawDataRecord;
                });
                return result;
            },
            getId : (changeSetItem, orgMetadata) => {
                return orgMetadata["ApexPage"][changeSetItem.apiName].Id;
            },
            duplicateChecking : (changeSetItem, anotherChageSetItem) => {
                return (
                    changeSetItem.apiName === anotherChageSetItem.apiName
                );
            }
        },
        "List View" : {
            toolingApiTypeName : "ListView",
            prerequisiteTypes : null,
            apiInfoHandler : async (changeSetManager, changeSetCollection) => {
                let result = {};
                let targetSObjects = [];
                for (let i = 0; i < changeSetCollection["List View"].length; i++) {
                    let changeSetItem = changeSetCollection["List View"][i];
                    let parentSObject = changeSetItem.apiName.split(".")[0];
                    if (!targetSObjects.includes(parentSObject)) {
                        targetSObjects.push(parentSObject);
                        let apiResults = await changeSetManager.getRestAPIResults("/sobjects/" + parentSObject + "/listviews");
                        for (let j = 0; j < apiResults.listviews.length; j++) {
                            result[apiResults.sobjectType + "." + apiResults.listviews[j].developerName] = apiResults.listviews[j];
                        }
                    }
                }
                return result;
            },
            getId : (changeSetItem, orgMetadata) => {
                return orgMetadata["ListView"][changeSetItem.apiName].id;
            },
            duplicateChecking : (changeSetItem, anotherChageSetItem) => {
                return (
                    changeSetItem.name === anotherChageSetItem.name
                    && changeSetItem.parentObject === anotherChageSetItem.parentObject
                );
            }
        },
        "Record Type" : {
            toolingApiTypeName : "RecordType",
            prerequisiteTypes : null,
            apiInfoHandler : async (changeSetManager, changeSetCollection) => {
                let result = {};
                let targetSObjects = [];
                for (let i = 0; i < changeSetCollection["Record Type"].length; i++) {
                    let changeSetItem = changeSetCollection["Record Type"][i];
                    let parentSObject = changeSetItem.apiName.split(".")[0];
                    if (!targetSObjects.includes(parentSObject)) {
                        targetSObjects.push(parentSObject);
                        let apiListResults = await changeSetManager.getToolingAPIResults("SELECT Id FROM RecordType WHERE EntityDefinition.QualifiedApiName = '" + parentSObject + "'");
                        for (let j = 0; j < apiListResults.records.length; j++) {
                            let apiResults = await changeSetManager.getToolingAPIResults("SELECT Id,FullName,EntityDefinition.QualifiedApiName FROM RecordType WHERE Id = '" + apiListResults.records[j].Id + "' LIMIT 1");
                            apiResults = apiResults.records[0];
                            result[apiResults.FullName] = apiResults;
                        }
                    }
                }
                return result;
            },
            getId : (changeSetItem, orgMetadata) => {
                return orgMetadata["RecordType"][changeSetItem.apiName].Id;
            },
            duplicateChecking : (changeSetItem, anotherChageSetItem) => {
                return (
                    changeSetItem.name === anotherChageSetItem.name
                    && changeSetItem.parentObject === anotherChageSetItem.parentObject
                );
            }
        },
        "Static Resource" : {
            toolingApiTypeName : "StaticResource",
            prerequisiteTypes : null,
            toolingApiSoql : "SELECT Id,Name,NamespacePrefix FROM StaticResource WHERE NamespacePrefix = null",
            toolingApiTransformation : (rawData) => {
                let result = {};
                rawData.records.forEach(rawDataRecord => {
                    result[rawDataRecord.Name] = rawDataRecord;
                });
                return result;
            },
            getId : (changeSetItem, orgMetadata) => {
                return orgMetadata["StaticResource"][changeSetItem.apiName].Id;
            },
            duplicateChecking : (changeSetItem, anotherChageSetItem) => {
                return (
                    changeSetItem.apiName === anotherChageSetItem.apiName
                );
            }
        },
        "Lightning Page" : {
            toolingApiTypeName : "FlexiPage",
            prerequisiteTypes : null,
            toolingApiSoql : "SELECT Id,DeveloperName,NamespacePrefix FROM FlexiPage WHERE NamespacePrefix = null",
            toolingApiTransformation : (rawData) => {
                let result = {};
                rawData.records.forEach(rawDataRecord => {
                    result[rawDataRecord.DeveloperName] = rawDataRecord;
                });
                return result;
            },
            getId : (changeSetItem, orgMetadata) => {
                return orgMetadata["FlexiPage"][changeSetItem.apiName].Id;
            },
            duplicateChecking : (changeSetItem, anotherChageSetItem) => {
                return (
                    changeSetItem.apiName === anotherChageSetItem.apiName
                );
            }
        },
        "Custom Label" : {
            toolingApiTypeName : "ExternalString",
            prerequisiteTypes : null,
            toolingApiSoql : "SELECT Id,Name,NamespacePrefix FROM ExternalString WHERE NamespacePrefix = null",
            toolingApiTransformation : (rawData) => {
                let result = {};
                rawData.records.forEach(rawDataRecord => {
                    result[rawDataRecord.Name] = rawDataRecord;
                });
                return result;
            },
            getId : (changeSetItem, orgMetadata) => {
                return orgMetadata["ExternalString"][changeSetItem.apiName].Id;
            },
            duplicateChecking : (changeSetItem, anotherChageSetItem) => {
                return (
                    changeSetItem.apiName === anotherChageSetItem.apiName
                );
            }
        },
        "Custom Notification Type" : {
            toolingApiTypeName : "CustomNotificationType",
            prerequisiteTypes : null,
            toolingApiSoql : "SELECT Id,CustomNotifTypeName,DeveloperName FROM CustomNotificationType WHERE NamespacePrefix = null",
            toolingApiTransformation : (rawData) => {
                let result = {};
                rawData.records.forEach(rawDataRecord => {
                    result[rawDataRecord.DeveloperName] = rawDataRecord;
                });
                return result;
            },
            getId : (changeSetItem, orgMetadata) => {
                return orgMetadata["CustomNotificationType"][changeSetItem.apiName].Id;
            },
            duplicateChecking : (changeSetItem, anotherChageSetItem) => {
                return (
                    changeSetItem.apiName === anotherChageSetItem.apiName
                );
            }
        },
        "Email Template" : {
            toolingApiTypeName : "EmailTemplate",
            prerequisiteTypes : null,
            apiInfoHandler : async (changeSetManager, changeSetCollection) => {
                let result = {};
                for (let i = 0; i < changeSetCollection["Email Template"].length; i++) {
                    let changeSetItem = changeSetCollection["Email Template"][i];
                    let parentSObject = changeSetItem.apiName.split(".")[0];

                    let apiListResults = await changeSetManager.getToolingAPIResults("SELECT Id FROM EmailTemplate WHERE Name = '" + changeSetItem.name + "'");
                    for (let j = 0; j < apiListResults.records.length; j++) {
                        let apiResults = await changeSetManager.getToolingAPIResults("SELECT Id,Name,FullName FROM EmailTemplate WHERE Id = '" + apiListResults.records[j].Id + "' LIMIT 1");
                        apiResults = apiResults.records[0];
                        result[apiResults.FullName] = apiResults;
                    }
                }
                return result;
            },
            getId : (changeSetItem, orgMetadata) => {
                return orgMetadata["EmailTemplate"][changeSetItem.apiName].Id;
            },
            duplicateChecking : (changeSetItem, anotherChageSetItem) => {
                let changeSetItemApiName = changeSetItem.apiName.split("/");
                changeSetItemApiName = changeSetItemApiName[changeSetItemApiName.length - 1];
                let anotherChageSetItemApiName = anotherChageSetItem.apiName.split("/");
                anotherChageSetItemApiName = anotherChageSetItemApiName[anotherChageSetItemApiName.length - 1];
                return (
                    changeSetItem.name === anotherChageSetItem.name
                    && changeSetItemApiName === anotherChageSetItemApiName
                );
            }
        },
        "Button or Link" : {
            toolingApiTypeName : "WebLink",
            prerequisiteTypes : null,
            apiInfoHandler : async (changeSetManager, changeSetCollection) => {
                let result = {};
                let targetSObjects = [];
                for (let i = 0; i < changeSetCollection["Button or Link"].length; i++) {
                    let changeSetItem = changeSetCollection["Button or Link"][i];
                    let parentSObject = changeSetItem.apiName.split(".")[0];
                    if (!targetSObjects.includes(parentSObject)) {
                        targetSObjects.push(parentSObject);
                        let apiListResults = await changeSetManager.getToolingAPIResults("SELECT Id FROM WebLink WHERE EntityDefinition.QualifiedApiName = '" + parentSObject + "'");
                        for (let j = 0; j < apiListResults.records.length; j++) {
                            let apiResults = await changeSetManager.getToolingAPIResults("SELECT Id,FullName,EntityDefinition.QualifiedApiName FROM WebLink WHERE Id = '" + apiListResults.records[j].Id + "' LIMIT 1");
                            apiResults = apiResults.records[0];
                            result[apiResults.FullName] = apiResults;
                        }
                    }
                }
                return result;
            },
            getId : (changeSetItem, orgMetadata) => {
                return orgMetadata["WebLink"][changeSetItem.apiName].Id;
            },
            duplicateChecking : (changeSetItem, anotherChageSetItem) => {
                let changeSetItemApiName = changeSetItem.apiName.split(".");
                changeSetItemApiName = changeSetItemApiName[changeSetItemApiName.length - 1];
                let anotherChageSetItemApiName = anotherChageSetItem.apiName.split(".");
                anotherChageSetItemApiName = anotherChageSetItemApiName[anotherChageSetItemApiName.length - 1];
                return (
                    changeSetItemApiName === anotherChageSetItemApiName
                    && changeSetItem.parentObject === anotherChageSetItem.parentObject
                );
            }
        },
        "Validation Rule" : {
            toolingApiTypeName : "ValidationRule",
            prerequisiteTypes : null,
            apiInfoHandler : async (changeSetManager, changeSetCollection) => {
                let result = {};
                let targetSObjects = [];
                for (let i = 0; i < changeSetCollection["Validation Rule"].length; i++) {
                    let changeSetItem = changeSetCollection["Validation Rule"][i];
                    let parentSObject = changeSetItem.apiName.split(".")[0];
                    if (!targetSObjects.includes(parentSObject)) {
                        targetSObjects.push(parentSObject);
                        let apiListResults = await changeSetManager.getToolingAPIResults("SELECT Id FROM ValidationRule WHERE EntityDefinition.QualifiedApiName = '" + parentSObject + "'");
                        for (let j = 0; j < apiListResults.records.length; j++) {
                            let apiResults = await changeSetManager.getToolingAPIResults("SELECT Id,FullName,EntityDefinition.QualifiedApiName FROM ValidationRule WHERE Id = '" + apiListResults.records[j].Id + "' LIMIT 1");
                            apiResults = apiResults.records[0];
                            result[apiResults.FullName] = apiResults;
                        }
                    }
                }
                return result;
            },
            getId : (changeSetItem, orgMetadata) => {
                return orgMetadata["ValidationRule"][changeSetItem.apiName].Id;
            },
            duplicateChecking : (changeSetItem, anotherChageSetItem) => {
                return (
                    changeSetItem.name === anotherChageSetItem.name
                    && changeSetItem.parentObject === anotherChageSetItem.parentObject
                );
            }
        },
        "Workflow Field Update" : {
            toolingApiTypeName : "WorkflowFieldUpdate",
            prerequisiteTypes : null,
            apiInfoHandler : async (changeSetManager, changeSetCollection) => {
                let result = {};
                let targetSObjects = [];
                for (let i = 0; i < changeSetCollection["Workflow Field Update"].length; i++) {
                    let changeSetItem = changeSetCollection["Workflow Field Update"][i];
                    let parentSObject = changeSetItem.apiName.split(".")[0];
                    if (!targetSObjects.includes(parentSObject)) {
                        targetSObjects.push(parentSObject);
                        let apiListResults = await changeSetManager.getToolingAPIResults("SELECT Id FROM WorkflowFieldUpdate WHERE EntityDefinition.QualifiedApiName = '" + parentSObject + "'");
                        for (let j = 0; j < apiListResults.records.length; j++) {
                            let apiResults = await changeSetManager.getToolingAPIResults("SELECT Id,FullName,EntityDefinition.QualifiedApiName FROM WorkflowFieldUpdate WHERE Id = '" + apiListResults.records[j].Id + "' LIMIT 1");
                            apiResults = apiResults.records[0];
                            result[apiResults.FullName] = apiResults;
                        }
                    }
                }
                return result;
            },
            getId : (changeSetItem, orgMetadata) => {
                return orgMetadata["WorkflowFieldUpdate"][changeSetItem.apiName].Id;
            },
            duplicateChecking : (changeSetItem, anotherChageSetItem) => {
                return (
                    changeSetItem.name === anotherChageSetItem.name
                    && changeSetItem.parentObject === anotherChageSetItem.parentObject
                );
            }
        },
        "Workflow Email Alert" : {
            toolingApiTypeName : "WorkflowAlert",
            prerequisiteTypes : null,
            apiInfoHandler : async (changeSetManager, changeSetCollection) => {
                let result = {};
                let targetSObjects = [];
                for (let i = 0; i < changeSetCollection["Workflow Email Alert"].length; i++) {
                    let changeSetItem = changeSetCollection["Workflow Email Alert"][i];
                    let parentSObject = changeSetItem.apiName.split(".")[0];
                    if (!targetSObjects.includes(parentSObject)) {
                        targetSObjects.push(parentSObject);
                        let apiListResults = await changeSetManager.getToolingAPIResults("SELECT Id FROM WorkflowAlert WHERE EntityDefinition.QualifiedApiName = '" + parentSObject + "'");
                        for (let j = 0; j < apiListResults.records.length; j++) {
                            let apiResults = await changeSetManager.getToolingAPIResults("SELECT Id,FullName,EntityDefinition.QualifiedApiName FROM WorkflowAlert WHERE Id = '" + apiListResults.records[j].Id + "' LIMIT 1");
                            apiResults = apiResults.records[0];
                            result[apiResults.FullName] = apiResults;
                        }
                    }
                }
                return result;
            },
            getId : (changeSetItem, orgMetadata) => {
                return orgMetadata["WorkflowAlert"][changeSetItem.apiName].Id;
            },
            duplicateChecking : (changeSetItem, anotherChageSetItem) => {
                return (
                    changeSetItem.name === anotherChageSetItem.name
                    && changeSetItem.parentObject === anotherChageSetItem.parentObject
                );
            }
        },
        "Workflow Rule" : {
            toolingApiTypeName : "WorkflowRule",
            prerequisiteTypes : null,
            apiInfoHandler : async (changeSetManager, changeSetCollection) => {
                let result = {};
                let apiListResults = await changeSetManager.getToolingAPIResults("SELECT Id FROM WorkflowRule WHERE NamespacePrefix = null");
                for (let j = 0; j < apiListResults.records.length; j++) {
                    let apiResults = await changeSetManager.getToolingAPIResults("SELECT Id,FullName FROM WorkflowRule WHERE Id = '" + apiListResults.records[j].Id + "' LIMIT 1");
                    apiResults = apiResults.records[0];
                    result[apiResults.FullName] = apiResults;
                }
                return result;
            },
            getId : (changeSetItem, orgMetadata) => {
                return orgMetadata["WorkflowRule"][changeSetItem.apiName].Id;
            },
            duplicateChecking : (changeSetItem, anotherChageSetItem) => {
                return (
                    changeSetItem.name === anotherChageSetItem.name
                    && changeSetItem.parentObject === anotherChageSetItem.parentObject
                );
            }
        },
        "Approval Process" : {
            toolingApiTypeName : "ApprovalProcesses",
            prerequisiteTypes : null,
            apiInfoHandler : async (changeSetManager, changeSetCollection) => {
                let result = {};
                let apiListResults = await changeSetManager.getRestAPIResults("/process/approvals/");
                for (let sObjApiName in apiListResults.approvals) {
                    let apiResultSObjItem = apiListResults.approvals[sObjApiName];
                    for (let apiResultItem of apiResultSObjItem) {
                        result[apiResultItem.object + "." + apiResultItem.name] = apiResultItem;
                    }
                }
                return result;
            },
            getId : (changeSetItem, orgMetadata) => {
                let sObjApiName = changeSetItem.apiName.split(".");
                sObjApiName = sObjApiName[0];
                return orgMetadata["ApprovalProcesses"][sObjApiName + "." +changeSetItem.name].id;
            },
            duplicateChecking : (changeSetItem, anotherChageSetItem) => {
                return (
                    changeSetItem.name === anotherChageSetItem.name
                    && changeSetItem.parentObject === anotherChageSetItem.parentObject
                );
            }
        },
        "Queue" : {
            toolingApiTypeName : "Queue",
            prerequisiteTypes : null,
            apiInfoHandler : async (changeSetManager, changeSetCollection) => {
                let result = {};
                let apiListResults = await changeSetManager.getRestAPIResults("/query/?q=SELECT Id,DeveloperName,Name FROM Group WHERE Type = 'Queue'");
                for (let i = 0; i < apiListResults.records.length; i++) {
                    let apiResultItem = apiListResults.records[i];
                    result[apiResultItem.DeveloperName] = apiResultItem;
                }
                return result;
            },
            getId : (changeSetItem, orgMetadata) => {
                return orgMetadata[changeSetItem.type][changeSetItem.apiName].Id;
            },
            duplicateChecking : (changeSetItem, anotherChageSetItem) => {
                return (
                    changeSetItem.type === anotherChageSetItem.type
                    && changeSetItem.apiName === anotherChageSetItem.apiName
                );
            }
        },
        "Custom Metadata Type Records" : {
            toolingApiTypeName : "CustomMetadataTypeRecords",
            prerequisiteTypes : null,
            apiInfoHandler : async (changeSetManager, changeSetCollection, customMetadataCheckListItem) => {
                let result = {};
                let customMetadataTypeLabel = customMetadataCheckListItem.label;
                let customMetadataTypeApiName = customMetadataCheckListItem.value;
                let apiListResults = await changeSetManager.getRestAPIResults("/query/?q=SELECT Id,QualifiedApiName FROM " + customMetadataTypeApiName);
                for (let i = 0; i < apiListResults.records.length; i++) {
                    let apiResultItem = apiListResults.records[i];
                    result[customMetadataTypeApiName.substr(0, customMetadataTypeApiName.length - 5) + "." + apiResultItem.QualifiedApiName] = apiResultItem;
                }
                return result;
            },
            getId : (changeSetItem, orgMetadata) => {
                return orgMetadata["CustomMetadataTypeRecords"][changeSetItem.type][changeSetItem.apiName].Id;
            },
            duplicateChecking : (changeSetItem, anotherChageSetItem) => {
                let changeSetItemApiName = changeSetItem.apiName.split(".");
                changeSetItemApiName = changeSetItemApiName[changeSetItemApiName.length - 1];
                let anotherChageSetItemApiName = anotherChageSetItem.apiName.split(".");
                anotherChageSetItemApiName = anotherChageSetItemApiName[anotherChageSetItemApiName.length - 1];
                return (
                    changeSetItem.type === anotherChageSetItem.type
                    && changeSetItemApiName === anotherChageSetItemApiName
                );
            }
        }
    }
}