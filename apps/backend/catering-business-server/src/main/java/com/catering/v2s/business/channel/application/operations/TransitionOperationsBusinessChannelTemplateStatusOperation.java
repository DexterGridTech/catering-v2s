package com.catering.v2s.business.channel.application.operations;

import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.api.BusinessChannelReadback;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for a business channel template status transition. */
@Component
public class TransitionOperationsBusinessChannelTemplateStatusOperation {
    public static final String OPERATION_ID = "transitionOperationsBusinessChannelTemplateStatus";
    private final BusinessChannelCommandApi channels;

    public TransitionOperationsBusinessChannelTemplateStatusOperation(BusinessChannelCommandApi channels) {
        this.channels = channels;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public BusinessChannelReadback.Template execute(BusinessChannelCommandApi.TransitionTemplateStatusCommand command) {
        return channels.transitionTemplateStatus(command);
    }
}
