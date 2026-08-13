/**
 * controllers/ModalController.js - Legacy Bridge to PropertyController
 * v2.3.16 Refactoring
 */

window.ModalController = {

    openDxfLayerToggleModal: function() {
        if (typeof window.renderLayerPanel === 'function') {
            window.renderLayerPanel();
        }
        const modal = document.getElementById('modal-dxf-layer-toggle') || document.getElementById('modal-dxf-layer') || document.getElementById('modal-dxf-layer-visibility');
        if (modal) modal.style.display = 'flex';
    },

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
