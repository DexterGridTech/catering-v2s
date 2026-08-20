package com.catering.v2s.business.channel.application.operations;

import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.api.BusinessChannelReadback;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for a business channel create. */
@Component
public class CreateOperationsBusinessChannelOperation {
    public static final String OPERATION_ID = "createOperationsBusinessChannel";
    private final BusinessChannelCommandApi channels;

    public CreateOperationsBusinessChannelOperation(BusinessChannelCommandApi channels) {
        this.channels = channels;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public BusinessChannelReadback.Channel execute(BusinessChannelCommandApi.CreateChannelCommand command) {
        return channels.createChannel(command);
    }
}
