package com.catering.v2s.salesmenu.application.operations;

import com.catering.v2s.salesmenu.api.SalesMenuCommandApi;
import com.catering.v2s.salesmenu.api.SalesMenuReadback;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
public class SetOperationsSalesMenuActivationOperation {
    public static final String OPERATION_ID = "setOperationsSalesMenuActivation";
    private final SalesMenuCommandApi owner;

    public SetOperationsSalesMenuActivationOperation(SalesMenuCommandApi owner) {
        this.owner = owner;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public SalesMenuReadback.Command execute(SalesMenuCommandApi.ActivationCommand command) {
        return owner.setActivation(command);
    }
}
