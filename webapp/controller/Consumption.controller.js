sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], (Controller, JSONModel, MessageBox, Filter, FilterOperator) => {
    "use strict";

    return Controller.extend("srnumscanprdorder.controller.Consumption", {

        onInit: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteConsumption").attachPatternMatched(this.onRouteMatched, this);


            var oConsumptionModel = new JSONModel();
            this.getView().setModel(oConsumptionModel, "ConsumptionModel");

            var oLineItemModel = new JSONModel();
            this.getView().setModel(oLineItemModel, "LineItemModel");
        },

        onRouteMatched: function (oEvent) {
            const sOrderNo = oEvent.getParameter("arguments").orderNo;
            this.PSA = oEvent.getParameter("arguments").PSA;

            this.getView().byId("finishedProductInput").setValue("");
            this.getView().byId("idScanSerialNo").setValue("")
            this._loadConsumptionData(sOrderNo);
        },

        _loadConsumptionData: function (sOrderNo) {
            var oFilter = new Filter("ManufacturingOrder", FilterOperator.EQ, sOrderNo);


            this._fetchOrderHeader(oFilter)
                .then(this._fetchOrderItems.bind(this))
                .catch(this._handleError.bind(this));
        },

        _fetchOrderHeader: function (oFilter) {
            var oModel = this.getOwnerComponent().getModel("1");
            var ConsumptionModel = this.getView().getModel("ConsumptionModel");
            sap.ui.core.BusyIndicator.show();

            return new Promise(function (resolve, reject) {
                oModel.read("/ZC_MFGORDER_H", {
                    filters: [oFilter],
                    success: function (oData) {
                        if (oData.results && oData.results.length > 0) {
                            var oOrderData = oData.results[0];
                            ConsumptionModel.setProperty("/", oOrderData);
                            ConsumptionModel.updateBindings(true);
                            sap.ui.core.BusyIndicator.hide();
                            resolve(oFilter);
                        } else {
                            MessageBox.warning("No data found for order.");

                            sap.ui.core.BusyIndicator.hide();
                            reject(new Error("No header data found"));
                        }
                    }.bind(this),
                    error: reject
                });
            }.bind(this));
        },

        _fetchOrderItems: function (oFilter) {
            var oModel = this.getOwnerComponent().getModel("1");
            var LineItemModel = this.getView().getModel("LineItemModel");
            var oFilter1 = new sap.ui.model.Filter("DestinationStorageBin", sap.ui.model.FilterOperator.EQ, this.PSA);

            sap.ui.core.BusyIndicator.show();

            return new Promise(function (resolve, reject) {
                oModel.read("/ZC_MFGORDER_I", {
                    filters: [oFilter, oFilter1],
                    success: function (oData) {
                        var expandedItems = [];

                        if (oData && oData.results && oData.results.length > 0) {
                            // Add serial numbers
                            oData.results.forEach(function (item, index) {
                                item.SerialNumber = index + 1; // Add serial number property
                            });
                        }

                        // Bind expanded array to model
                        LineItemModel.setProperty("/", { results: oData.results });
                        LineItemModel.updateBindings(true);

                        sap.ui.core.BusyIndicator.hide();
                        resolve();
                    }.bind(this),
                    error: function (oError) {
                        sap.ui.core.BusyIndicator.hide();
                        reject(oError);
                    }
                });
            }.bind(this));
        },


        _handleError: function (oError) {
            this.getView().setBusy(false);
            MessageBox.error("Service call failed: " + (oError.message || oError));
        },

        onPressRow: function (oEvent) {

            if (!this.SerialDialog) {
                this.SerialDialog = sap.ui.xmlfragment("srnumscanprdorder.view.fragments.serialscanning", this);
                this.getView().addDependent(this.SerialDialog);
            }
            var oContext = oEvent.getSource().getBindingContext("LineItemModel");
            this._oSelectedContext = oContext; // store for later

            var selObj = oContext.getObject();
            var aExistingTokens = selObj.ScannedTokens || [];
            var expandedArray = [];
            for (var i = 1; i <= selObj.ActualQuantityInBaseUnit; i++) {
                expandedArray.push({
                    ProductName: selObj.ProductName,
                    ProductDescription: selObj.ProductDescription,
                    ActualQuantityInBaseUnit: 1, // split quantity into individual items
                    DestinationStorageBin: selObj.DestinationStorageBin,
                    SerialNo: i,
                    ScannedValue: aExistingTokens[i - 1] ? aExistingTokens[i - 1].text : ""
                });
            }
            var oPopupModel = new sap.ui.model.json.JSONModel({ results: expandedArray });
            this.getView().setModel(oPopupModel, "PopupModel");


            this.SerialDialog.open();
        },
        onNavBack: function () {
            let oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteHomeView")
        },
        onTableScanSuccess: function (oEvent) {
            var sScannedValue = oEvent.getParameter("text");
            var oInput = this.getView().byId("finishedProductInput").getValue();
            if (oInput == "") {
                sap.m.MessageToast.show("No value scanned in header section!");
                return;
            }

            if (!sScannedValue) {
                sap.m.MessageToast.show("No value scanned!");
                return;
            }

            var oTable = this.getView().byId("consumptionTable");
            if (!oTable) return;

            var oSelectedItem = oTable.getSelectedItem();

            if (!oSelectedItem) {
                sap.m.MessageToast.show("Please select a row first.");
                return;
            }

            var oContext = oSelectedItem.getBindingContext("LineItemModel");

            var aTokens = oContext.getModel().getProperty(oContext.getPath() + "/ScannedTokens") || [];

            //start 

            var actualQty = oContext.getModel().getProperty(oContext.getPath() + "/ActualQuantityInBaseUnit");

            if (aTokens.length >= actualQty) {
                MessageBox.error("Scanned serials exceeded the required quantity!");
                return;
            }

            //End 

            aTokens.push({ text: sScannedValue });

            oContext.getModel().setProperty(oContext.getPath() + "/ScannedTokens", aTokens);

            // var oContext = oSelectedItem.getBindingContext("LineItemModel");
            // oContext.getModel().setProperty(oContext.getPath() + "/ScanSerialNo", sScannedValue);

        },

        onPopUpScanSuccess: function (oEvent) {
            var sScannedValue = oEvent.getParameter("text");
            var oTable = sap.ui.getCore().byId("idScanPopupTable");
            if (!oTable) return;

            var oSelectedItem = oTable.getSelectedItem();

            if (!oSelectedItem) {
                sap.m.MessageToast.show("Please select a row first.");
                return;
            }
            if (!sScannedValue) {
                sap.m.MessageToast.show("No value scanned!");
                return;
            }

            var oContext = oSelectedItem.getBindingContext("PopupModel");
            oContext.getModel().setProperty(oContext.getPath() + "/ScannedValue", sScannedValue);
        },
        onScanSuccessConsumption: function (oEvent) {
            var sScannedValue = oEvent.getParameter("text");
            var oInput = this.getView().byId("finishedProductInput");
            if (oInput) {
                oInput.setValue(sScannedValue);
            }
        },
        onPressApply: function () {
            var oPopupModel = this.getView().getModel("PopupModel");
            var aItems = oPopupModel.getProperty("/results");
            var bValid = true;

            aItems.forEach(function (item) {
                if (!item.ScannedValue || item.ScannedValue.trim() === "") {
                    bValid = false;
                }
            });

            if (!bValid) {
                sap.m.MessageBox.error("Please enter all scanned values before applying.");
                return; // stop execution
            }
            var aTokens = aItems.map(function (item) {
                return { text: item.ScannedValue };
            });
            if (this._oSelectedContext) {
                this._oSelectedContext.getModel().setProperty(
                    this._oSelectedContext.getPath() + "/ScannedTokens",
                    aTokens
                );
            }

            this.SerialDialog.close();
        },
        onPressClose: function () {
            this.SerialDialog.close();
        },
        // onPressSave: function () {
        //     var oView = this.getView(),
        //         oModel1 = this.getOwnerComponent().getModel("1"),
        //         ConsumptionModel = oView.getModel("ConsumptionModel"),
        //         ConsumptionData = ConsumptionModel.getData(),
        //         LineItemModel = oView.getModel("LineItemModel"),
        //         aLineItems = LineItemModel.getData().results;

        //     let headerscanValue = oView.byId("finishedProductInput").getValue();

        //     // --- Header validation ---
        //     if (!headerscanValue) {
        //         MessageBox.warning("Header Scanned value is required");
        //         oView.byId("finishedProductInput").setValueState("Error");
        //         return;
        //     }
        //     oView.byId("finishedProductInput").setValueState("None");
        //     // --- Required field + token validation ---
        //     for (var i = 0; i < aLineItems.length; i++) {
        //         var item = aLineItems[i];
        //         if (!item.ScannedTokens || item.ScannedTokens.length === 0) {
        //             MessageBox.warning("Please scan serial numbers for all line items before saving.");
        //             // return;
        //         }
        //     }

        //     // --- ✅ Flatten all tokens for duplicate check ---
        //     var aAllSerials = [];
        //     aLineItems.forEach(function (item) {
        //         item.ScannedTokens.forEach(function (token) {
        //             aAllSerials.push(token.text.trim());
        //         });
        //     });
        //     // --- Check for duplicates ---
        //     var oDuplicates = aAllSerials.filter((val, idx, arr) => arr.indexOf(val) !== idx);
        //     if (oDuplicates.length > 0) {
        //         MessageBox.error("Duplicate scanned values found: " + [...new Set(oDuplicates)].join(", "));
        //         return;
        //     }
        //     // --- Build payload items ---
        //     var aItems = [];
        //     aLineItems.forEach(function (item) {
        //         item.ScannedTokens.forEach(function (token) {
        //             aItems.push({
        //                 "ManufacturingOrder": item.ManufacturingOrder,
        //                 "itemnoh": item.itemnoh,
        //                 "ProductName": item.ProductName,
        //                 "ProductDescription": item.ProductDescription,
        //                 "ActualQuantityInBaseUnit": "1", // each scanned serial = 1 qty
        //                 "serialnoc": token.text,
        //                 "DestinationStorageBin": item.DestinationStorageBin
        //             });
        //         });
        //     });

        //     var payload1 = {
        //         "ManufacturingOrder": ConsumptionData.ManufacturingOrder,
        //         "serialnoh": headerscanValue,
        //         "Product": ConsumptionData.Product,
        //         "ProductDescription": ConsumptionData.ProductDescription,
        //         "StorageLocation": ConsumptionData.StorageLocation,
        //         "ProductionPlant": ConsumptionData.ProductionPlant,
        //         "to_Item": aItems
        //     };

        //     // --- Send payload ---
        //     sap.ui.core.BusyIndicator.show();
        //     oModel1.create("/ZC_MFGORDER_H", payload1, {
        //         success: function (response) {
        //             sap.ui.core.BusyIndicator.hide();
        //             MessageBox.success("Record Saved Successfully", {
        //                 onClose: function (oAction) {
        //                     if (oAction === 'OK') {
        //                         this.onNavBack();
        //                     }
        //                 }.bind(this)
        //             });
        //         }.bind(this),
        //         error: function (error) {
        //             sap.ui.core.BusyIndicator.hide();
        //             MessageBox.error("Error Occurred");
        //             console.log(error);
        //         }
        //     });
        // }

        onPressSave: function () {
            var oView = this.getView(),
                oModel1 = this.getOwnerComponent().getModel("1"),
                ConsumptionModel = oView.getModel("ConsumptionModel"),
                ConsumptionData = ConsumptionModel.getData(),
                LineItemModel = oView.getModel("LineItemModel"),
                aLineItems = LineItemModel.getData().results;

            let headerscanValue = oView.byId("finishedProductInput").getValue();

            // --- Header validation ---
            if (!headerscanValue) {
                MessageBox.warning("Header Scanned value is required");
                oView.byId("finishedProductInput").setValueState("Error");
                return;
            }
            oView.byId("finishedProductInput").setValueState("None");

            // --- Required field + token validation ---
            let bMissingTokens = false;
            for (var i = 0; i < aLineItems.length; i++) {
                var item = aLineItems[i];
                if (!item.ScannedTokens || item.ScannedTokens.length === 0) {
                    bMissingTokens = true;
                    break;
                }
            }

            // If missing tokens → show warning & save only on OK
            if (bMissingTokens) {
                MessageBox.warning(
                    "Some line items do not have scanned serial numbers. Do you want to continue?",
                    {
                        actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                        onClose: function (oAction) {
                            if (oAction === MessageBox.Action.OK) {
                                this._continueSave(); // continue save
                            }
                        }.bind(this)
                    }
                );
                return;
            }

            // If everything is OK → direct save
            this._continueSave();
        },


        /* ============================================================================================
           Helper function: Continues Saving (called after warning or direct)
           ============================================================================================ */
        _continueSave: function () {
            var oView = this.getView(),
                oModel1 = this.getOwnerComponent().getModel("1"),
                ConsumptionModel = oView.getModel("ConsumptionModel"),
                ConsumptionData = ConsumptionModel.getData(),
                LineItemModel = oView.getModel("LineItemModel"),
                aLineItems = LineItemModel.getData().results;

            let headerscanValue = oView.byId("finishedProductInput").getValue();

            // --- Flatten all serial tokens for duplicate check ---
            var aAllSerials = [];
            aLineItems.forEach(function (item) {
                (item.ScannedTokens || []).forEach(function (token) {
                    aAllSerials.push(token.text.trim());
                });
            });

            // --- Duplicate check ---
            var oDuplicates = aAllSerials.filter((val, idx, arr) => arr.indexOf(val) !== idx);
            if (oDuplicates.length > 0) {
                MessageBox.error("Duplicate scanned values found: " + [...new Set(oDuplicates)].join(", "));
                return;
            }

            // --- Build payload items ---
            var aItems = [];
            aLineItems.forEach(function (item) {
                (item.ScannedTokens || []).forEach(function (token) {
                    aItems.push({
                        "ManufacturingOrder": item.ManufacturingOrder,
                        "itemnoh": item.itemnoh,
                        "ProductName": item.ProductName,
                        "ProductDescription": item.ProductDescription,
                        "ActualQuantityInBaseUnit": "1", // Each scanned serial = 1 qty
                        "serialnoc": token.text,
                        "DestinationStorageBin": item.DestinationStorageBin
                    });
                });
            });

            // --- Header payload ---
            var payload1 = {
                "ManufacturingOrder": ConsumptionData.ManufacturingOrder,
                "serialnoh": headerscanValue,
                "Product": ConsumptionData.Product,
                "ProductDescription": ConsumptionData.ProductDescription,
                "StorageLocation": ConsumptionData.StorageLocation,
                "ProductionPlant": ConsumptionData.ProductionPlant,
                "to_Item": aItems
            };

            // --- Submit data ---
            sap.ui.core.BusyIndicator.show();
            oModel1.create("/ZC_MFGORDER_H", payload1, {
                success: function () {
                    sap.ui.core.BusyIndicator.hide();
                    MessageBox.success("Record Saved Successfully", {
                        onClose: function (oAction) {
                            if (oAction === "OK") {
                                this.onNavBack();
                            }
                        }.bind(this)
                    });
                }.bind(this),

                error: function (error) {
                    sap.ui.core.BusyIndicator.hide();
                    MessageBox.error("Error Occurred");
                    console.log(error);
                }
            });
        },




    });
});