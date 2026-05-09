/**
 * controllers/ModalController.js - Legacy Bridge to PropertyController
 * v2.3.16 Refactoring
 */

window.ModalController = {
    // Aliases for compatibility
    openPropertyModal: function(hit) {
        if (window.PropertyController) window.PropertyController.openGeneralModal(hit);
    },
    updateModalFields: function(type) {
        if (window.PropertyController) window.PropertyController.updateWallFields(type, null);
    },
    applyPropertyChanges: function() {
        if (window.PropertyController) window.PropertyController.applyGeneralChanges();
    }
};
