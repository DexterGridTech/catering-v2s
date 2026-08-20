package com.catering.v2s.business.channel.application.operations;

import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.api.BusinessChannelReadback;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for a business channel status transition. */
@Component
public class TransitionOperationsBusinessChannelStatusOperation {
    public static final String OPERATION_ID = "transitionOperationsBusinessChannelStatus";
    private final BusinessChannelCommandApi channels;

    public TransitionOperationsBusinessChannelStatusOperation(BusinessChannelCommandApi channels) {
        this.channels = channels;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public BusinessChannelReadback.Channel execute(BusinessChannelCommandApi.TransitionChannelStatusCommand command) {
        return channels.transitionChannelStatus(command);
    }
}
