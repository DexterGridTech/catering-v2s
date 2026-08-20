package com.catering.v2s.business.channel.application.operations;

import com.catering.v2s.businesschannel.api.BusinessChannelCommandApi;
import com.catering.v2s.businesschannel.api.BusinessChannelReadback;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation transaction boundary for a business channel template update. */
@Component
public class UpdateOperationsBusinessChannelTemplateOperation {
    public static final String OPERATION_ID = "updateOperationsBusinessChannelTemplate";
    private final BusinessChannelCommandApi channels;

    public UpdateOperationsBusinessChannelTemplateOperation(BusinessChannelCommandApi channels) {
        this.channels = channels;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public BusinessChannelReadback.Template execute(BusinessChannelCommandApi.UpdateTemplateCommand command) {
        return channels.updateTemplate(command);
    }
}
