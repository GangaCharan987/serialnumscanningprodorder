sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox"
], (Controller, MessageToast, Filter, FilterOperator, MessageBox) => {
    "use strict";

    return Controller.extend("srnumscanprdorder.controller.HomeView", {
        onInit: function () {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("RouteHomeView").attachMatched(this.onRouteMatched, this);
        },
        onRouteMatched: function (oEvent) {
            this.byId("manufacturingOrderInput").setValue("");
            this.byId("productionSupplyAreaInput").setValue("");
        },

        onPressConsumption: function () {
            var oView = this.getView();
            var oModel = this.getOwnerComponent().getModel("1");
            var sOrderNo = oView.byId("manufacturingOrderInput").getValue();
            var sProdArea = oView.byId("productionSupplyAreaInput").getValue();
            if (!sOrderNo) {
                MessageToast.show("Please enter Manufacturing Order Number");
                return;
            }

            if (!sProdArea) {
                MessageToast.show("Please enter Production Supply Area");
                return;
            }
            var oFilter = new Filter("ManufacturingOrder", FilterOperator.EQ, sOrderNo);

            oModel.read("/ZC_MFGORDER_H", {
                filters: [oFilter],
                success: function (response) {
                    console.log(response);

                    // Extract statuses from all records
                    var aStatuses = response.results.map(function (item) {
                        return item.status;
                    });

                    // Check conditions
                    var allClosed = aStatuses.every(function (status) {
                        return status === 'C';
                    });

                    var anyOpen = aStatuses.some(function (status) {
                        return status === 'O';
                    });

                    if (allClosed) {
                        MessageBox.error("Production order has been closed for scanning");
                        return;
                    }

                    var oRouter = this.getOwnerComponent().getRouter();
                    oRouter.navTo("RouteConsumption", {
                        orderNo: sOrderNo,
                        PSA: sProdArea
                    });

                }.bind(this),
                error: function (error) {
                    console.log(error);
                }
            });

        },
        onScanSuccess: function (oEvent) {
            var sScannedValue = oEvent.getParameter("text");
            var oInput = this.getView().byId("manufacturingOrderInput");
            if (oInput) {
                oInput.setValue(sScannedValue);
            }
        },
    });
});
