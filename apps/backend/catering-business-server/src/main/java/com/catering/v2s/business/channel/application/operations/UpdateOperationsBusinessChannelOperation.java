package com.catering.v2s.business.channel.application.operations;

import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.api.BusinessChannelReadback;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for a business channel update. */
@Component
public class UpdateOperationsBusinessChannelOperation {
    public static final String OPERATION_ID = "updateOperationsBusinessChannel";
    private final BusinessChannelCommandApi channels;

    public UpdateOperationsBusinessChannelOperation(BusinessChannelCommandApi channels) {
        this.channels = channels;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public BusinessChannelReadback.Channel execute(BusinessChannelCommandApi.UpdateChannelCommand command) {
        return channels.updateChannel(command);
    }
}
