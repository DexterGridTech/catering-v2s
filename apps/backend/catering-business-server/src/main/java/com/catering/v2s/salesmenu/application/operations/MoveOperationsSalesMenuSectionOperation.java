package com.catering.v2s.salesmenu.application.operations;

import com.catering.v2s.salesmenu.api.SalesMenuCommandApi;
import com.catering.v2s.salesmenu.api.SalesMenuReadback;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
public class MoveOperationsSalesMenuSectionOperation {
    public static final String OPERATION_ID = "moveOperationsSalesMenuSection";
    private final SalesMenuCommandApi owner;

    public MoveOperationsSalesMenuSectionOperation(SalesMenuCommandApi owner) {
        this.owner = owner;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public SalesMenuReadback.Command execute(SalesMenuCommandApi.SectionMoveCommand command) {
        return owner.moveSection(command);
    }
}
