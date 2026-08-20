package com.catering.v2s.business.channel.application.operations;

import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.api.BusinessChannelReadback;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for a business channel template create. */
@Component
public class CreateOperationsBusinessChannelTemplateOperation {
    public static final String OPERATION_ID = "createOperationsBusinessChannelTemplate";
    private final BusinessChannelCommandApi channels;

    public CreateOperationsBusinessChannelTemplateOperation(BusinessChannelCommandApi channels) {
        this.channels = channels;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public BusinessChannelReadback.Template execute(BusinessChannelCommandApi.CreateTemplateCommand command) {
        return channels.createTemplate(command);
    }
}
