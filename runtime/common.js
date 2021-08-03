class ChangeSetManager {
    async getCsv() {
        let resultCsv = "Name,Parent Object,Type,API Name\n";
        resultCsv += this.getCsvStringsFromChangeSetCollection(await this.getChangeSetCollection());
        return resultCsv;
    }

    async getJson() {
        return JSON.stringify(await this.getChangeSetCollection(), null, '\t');
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

    async getChangeSetCollection(collectionFormat) {
        collectionFormat = collectionFormat || "changeSetCollection";
        let componentsTableSelector = this.getComponentsTableSelector();
        let changeSetCollection = {};
        let changeSetDuplicationChecker = [];
        await this.goToFirstPage();
        let navigationToNextStatus = null;
        while (navigationToNextStatus !== "noButton") {
            let rows = document.querySelector(componentsTableSelector).querySelectorAll("tr");
            for (let i = 0; i < rows.length; i++) {
                let changeSetItem = this.getChangeSetItemFromTr(rows[i]);
                this.addChangeSetItemToChangeSetCollection(changeSetCollection, changeSetDuplicationChecker, changeSetItem);
            }
            navigationToNextStatus = await this.goToNextPage();
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
        fileChooser.accept = ".csv,.json";

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

                        if (/^.*\.csv$/.test(f.name)) {
                            this.importFromCsv(contents);
                        } else if (/^.*\.json$/.test(f.name)) {
                            this.importFromJson(contents);
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
        let internalChangeSetId = await this.getQueryParameterFromButtonPage('input[id$="component_list_form_buttons:outboundCs_add"]', "id");
        let orgMetadata = await this.getOrgMetadata(changeSetCollection);
        await this.importByTypes(internalChangeSetId, changeSetCollection, orgMetadata);
    }

    async importByTypes(internalChangeSetId, changeSetCollection, orgMetadata) {
        let existsChangeSetCollection = await this.getChangeSetCollection();
        //console.log(existsChangeSetCollection);
        let childWindow = await this.openChildWindow("https://" + location.hostname + "/p/mfpkg/AddToPackageFromChangeMgmtUi?id=" + internalChangeSetId);
        let targetForm = childWindow.document.querySelector("form#editPage");

        let atLeastOne = false;
        Object.keys(changeSetCollection).forEach(changeSetItemsType => {
            changeSetCollection[changeSetItemsType].forEach(changeSetItem => {
                if ( !this.checkDuplicationInChangeSetCollection(existsChangeSetCollection, changeSetItem) ) {
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
                window.location.reload();
            }, 500);
        });
    }

    checkDuplicationInChangeSetCollection(changeSetCollection, changeSetItem) {
        let result = false;
        let typeResolver = ChangeSetManager.TypeResolver[changeSetItem.type];
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
        let typeResolver = this.getTypeResolver(changeSetItemsType);
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

    async getQueryParameterFromButtonPage(buttonSelector, queryParamKey) {
        let childWindow = await this.openChildWindow(window.location.href);
        childWindow.document.querySelector(buttonSelector).click();
        return new Promise((resolve, reject) => {
            let tmpInterval = setInterval(() => {
                if (window.location.href !== childWindow.location.href) {
                    clearInterval(tmpInterval);
                    let urlParams = new URLSearchParams(childWindow.location.search);
                    let queryParamValue = urlParams.get(queryParamKey);
                    childWindow.close();
                    resolve(queryParamValue);
                }
            }, 1000);
        });
    }

    async getOrgMetadata(changeSetCollection) {
        let orgMetadata = {};
        Object.keys(changeSetCollection).forEach(async (changeSetItemsType) => {
            await this.pushToolingAPIItemsToOrgMetadataVariable(changeSetItemsType, changeSetCollection, orgMetadata);
        });
        console.log(orgMetadata);
        return orgMetadata;
    }

    async pushToolingAPIItemsToOrgMetadataVariable(changeSetItemsType, changeSetCollection, orgMetadata) {
        let result = null;
        let typeResolver = this.getTypeResolver(changeSetItemsType);
        if (typeResolver) {
            if (!orgMetadata[typeResolver.toolingApiTypeName]) {
                if (typeResolver["prerequisiteTypes"] && typeResolver["prerequisiteTypes"].length > 0) {
                    for (let i = 0; i < typeResolver["prerequisiteTypes"].length; i++) {
                        await this.pushToolingAPIItemsToOrgMetadataVariable(typeResolver["prerequisiteTypes"][i], changeSetCollection, orgMetadata);
                    }
                }
                let soql = typeof typeResolver.toolingApiSoql === "function" ? typeResolver.toolingApiSoql(changeSetCollection, orgMetadata) : typeResolver.toolingApiSoql;
                let rawData = await this.getToolingAPIResults(soql);
                let parsedData = typeResolver.toolingApiTransformation(rawData);
                orgMetadata[typeResolver.toolingApiTypeName] = parsedData;
                result = parsedData;
            } else if (orgMetadata[typeResolver.toolingApiTypeName]) {
                result = orgMetadata[typeResolver.toolingApiTypeName];
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
            let url = "https://" + location.hostname + "/services/data/v51.0/tooling/query/?q=" + soql.replaceAll(/\s+/gi,"+");
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

    getTypeResolver(changeSetItemsType) {
        let result = null
        if (ChangeSetManager.TypeResolver[changeSetItemsType]) {
            result = ChangeSetManager.TypeResolver[changeSetItemsType];
            if (result["sameAs"]) {
                result = this.getTypeResolver(result["sameAs"]);
            }
        }
        return result;
    }

    //--------------------------------------------

    static TypeResolver = {
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
        "Custom Field" : {
            toolingApiTypeName : "FieldDefinition",
            prerequisiteTypes : ["Custom Object"],
            toolingApiSoql : (changeSetCollection, orgMetadata) => {
                let soql = "SELECT DurableId,EntityDefinitionId,EntityDefinition.QualifiedApiName,QualifiedApiName FROM FieldDefinition WHERE ";
                let whereClauses = [];
                changeSetCollection["Custom Field"].forEach(customFieldItem => {
                    let whereClause = "EntityDefinitionId = '" + orgMetadata["EntityDefinition"][customFieldItem.apiName.split(".")[0]].DurableId + "'";
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
            toolingApiSoql : "SELECT DurableId,QualifiedApiName FROM EntityDefinition",
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
    }
}