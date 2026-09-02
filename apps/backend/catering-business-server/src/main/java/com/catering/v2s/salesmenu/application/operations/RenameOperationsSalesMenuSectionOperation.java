package com.catering.v2s.salesmenu.application.operations;

import com.catering.v2s.salesmenu.api.SalesMenuCommandApi;
import com.catering.v2s.salesmenu.api.SalesMenuReadback;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
public class RenameOperationsSalesMenuSectionOperation {
    public static final String OPERATION_ID = "renameOperationsSalesMenuSection";
    private final SalesMenuCommandApi owner;

    public RenameOperationsSalesMenuSectionOperation(SalesMenuCommandApi owner) {
        this.owner = owner;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public SalesMenuReadback.Command execute(SalesMenuCommandApi.SectionRenameCommand command) {
        return owner.renameSection(command);
    }
}
