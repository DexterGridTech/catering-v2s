package com.catering.v2s.app.edge.operations.salesmenu;

import com.catering.v2s.app.edge.generated.backendperformancem1.BackendPerformanceM1CommandExecutionBindings;
import com.catering.v2s.app.edge.generated.wire.SalesMenuActivationRequest;
import com.catering.v2s.app.edge.generated.wire.SalesMenuArchiveRequest;
import com.catering.v2s.app.edge.generated.wire.SalesMenuCandidatePage;
import com.catering.v2s.app.edge.generated.wire.SalesMenuCommandReadback;
import com.catering.v2s.app.edge.generated.wire.SalesMenuCopyRequest;
import com.catering.v2s.app.edge.generated.wire.SalesMenuCreateRequest;
import com.catering.v2s.app.edge.generated.wire.SalesMenuDeleteRequest;
import com.catering.v2s.app.edge.generated.wire.SalesMenuDetail;
import com.catering.v2s.app.edge.generated.wire.SalesMenuDraftItemView;
import com.catering.v2s.app.edge.generated.wire.SalesMenuItemMoveRequest;
import com.catering.v2s.app.edge.generated.wire.SalesMenuItemPage;
import com.catering.v2s.app.edge.generated.wire.SalesMenuItemUpdateRequest;
import com.catering.v2s.app.edge.generated.wire.SalesMenuItemsAddRequest;
import com.catering.v2s.app.edge.generated.wire.SalesMenuManualRestoreRequest;
import com.catering.v2s.app.edge.generated.wire.SalesMenuManualSoldOutRequest;
import com.catering.v2s.app.edge.generated.wire.SalesMenuOperationRecordPage;
import com.catering.v2s.app.edge.generated.wire.SalesMenuPage;
import com.catering.v2s.app.edge.generated.wire.SalesMenuPublicationPreview;
import com.catering.v2s.app.edge.generated.wire.SalesMenuPublishRequest;
import com.catering.v2s.app.edge.generated.wire.SalesMenuPublishedItemPage;
import com.catering.v2s.app.edge.generated.wire.SalesMenuPublishedItemView;
import com.catering.v2s.app.edge.generated.wire.SalesMenuPublishedSectionList;
import com.catering.v2s.app.edge.generated.wire.SalesMenuRenameRequest;
import com.catering.v2s.app.edge.generated.wire.SalesMenuScheduleUpdateRequest;
import com.catering.v2s.app.edge.generated.wire.SalesMenuSectionCreateRequest;
import com.catering.v2s.app.edge.generated.wire.SalesMenuSectionList;
import com.catering.v2s.app.edge.generated.wire.SalesMenuSectionMoveRequest;
import com.catering.v2s.app.edge.generated.wire.SalesMenuSectionRenameRequest;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.salesmenu.api.SalesMenuCommandApi;
import com.catering.v2s.salesmenu.api.SalesMenuOwnerApi;
import com.catering.v2s.salesmenu.api.SalesMenuReadback;
import com.catering.v2s.salesmenu.domain.SalesMenuCandidateQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuItemPageQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuItemQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuListQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuOperationQuery;
import com.catering.v2s.salesmenu.domain.SalesMenuTarget;
import com.catering.v2s.salesmenu.domain.SalesMenuVersionKind;
import com.catering.v2s.salesmenu.domain.SalesMenuVersionQuery;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Operations-admin edge for store-scoped sales-menu reads and commands. */
@RestController
@RequestMapping("/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus")
public final class OperationsSalesMenuController {
    private static final String REQ_ADD_ITEMS = "REQ_ADD_OPERATIONS_SALES_MENU_ITEMS";
    private static final String REQ_ARCHIVE = "REQ_ARCHIVE_OPERATIONS_SALES_MENU";
    private static final String REQ_COPY = "REQ_COPY_OPERATIONS_SALES_MENU";
    private static final String REQ_CREATE = "REQ_CREATE_OPERATIONS_SALES_MENU";
    private static final String REQ_CREATE_SECTION = "REQ_CREATE_OPERATIONS_SALES_MENU_SECTION";
    private static final String REQ_DELETE_ITEM = "REQ_DELETE_OPERATIONS_SALES_MENU_ITEM";
    private static final String REQ_DELETE_SECTION = "REQ_DELETE_OPERATIONS_SALES_MENU_SECTION";
    private static final String REQ_MOVE_ITEM = "REQ_MOVE_OPERATIONS_SALES_MENU_ITEM";
    private static final String REQ_MOVE_SECTION = "REQ_MOVE_OPERATIONS_SALES_MENU_SECTION";
    private static final String REQ_PUBLISH = "REQ_PUBLISH_OPERATIONS_SALES_MENU";
    private static final String REQ_RENAME = "REQ_RENAME_OPERATIONS_SALES_MENU";
    private static final String REQ_RENAME_SECTION = "REQ_RENAME_OPERATIONS_SALES_MENU_SECTION";
    private static final String REQ_RESTORE = "REQ_RESTORE_OPERATIONS_SALES_MENU_ITEM_SALE";
    private static final String REQ_SET_ACTIVATION = "REQ_SET_OPERATIONS_SALES_MENU_ACTIVATION";
    private static final String REQ_SET_SOLD_OUT = "REQ_SET_OPERATIONS_SALES_MENU_ITEM_SOLD_OUT";
    private static final String REQ_UPDATE_ITEM = "REQ_UPDATE_OPERATIONS_SALES_MENU_ITEM";
    private static final String REQ_UPDATE_SCHEDULE = "REQ_UPDATE_OPERATIONS_SALES_MENU_SCHEDULE";

    private final SalesMenuEdgeSupport support;
    private final SalesMenuOwnerApi salesMenus;
    private final BackendPerformanceM1CommandExecutionBindings commandBindings;
    private final SalesMenuCommandFailureRecorder failureRecorder;

    public OperationsSalesMenuController(
            SalesMenuEdgeSupport support,
            SalesMenuOwnerApi salesMenus,
            BackendPerformanceM1CommandExecutionBindings commandBindings,
            SalesMenuCommandFailureRecorder failureRecorder) {
        this.support = support;
        this.salesMenus = salesMenus;
        this.commandBindings = commandBindings;
        this.failureRecorder = failureRecorder;
    }

    @GetMapping
    SalesMenuPage salesMenus(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @RequestParam UUID channelRef,
            @RequestParam(name = "query", required = false) String query,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer pageSize) {
        var session = support.readSession(request, groupWorkspaceKey);
        var scope = support.scope(session, groupWorkspaceKey, storeRef);
        support.requireEligibleChannel(scope, channelRef);
        return SalesMenuWireMapper.menuPage(
                salesMenus.listMenus(new SalesMenuListQuery(scope, channelRef, query, support.page(cursor, pageSize))));
    }

    @GetMapping("/{salesMenuRef}")
    SalesMenuDetail salesMenu(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef,
            @RequestParam UUID channelRef) {
        var session = support.readSession(request, groupWorkspaceKey);
        var scope = support.scope(session, groupWorkspaceKey, storeRef);
        support.requireEligibleChannel(scope, channelRef);
        return SalesMenuWireMapper.menuDetail(salesMenus.readMenu(support.menuTarget(scope, salesMenuRef), channelRef));
    }

    @GetMapping("/{salesMenuRef}/draft/sections")
    SalesMenuSectionList draftSections(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef) {
        return SalesMenuWireMapper.draftSections(salesMenus.listDraftSections(new SalesMenuVersionQuery(
                target(request, groupWorkspaceKey, storeRef, salesMenuRef), SalesMenuVersionKind.DRAFT)));
    }

    @GetMapping("/{salesMenuRef}/draft/sections/{salesSectionRef}/items")
    SalesMenuItemPage draftItems(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef,
            @PathVariable UUID salesSectionRef,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer pageSize) {
        var scope = readScope(request, groupWorkspaceKey, storeRef);
        return SalesMenuWireMapper.draftItemPage(salesMenus.listDraftItems(new SalesMenuItemPageQuery(
                support.menuTarget(scope, salesMenuRef),
                SalesMenuVersionKind.DRAFT,
                salesSectionRef,
                null,
                support.page(cursor, pageSize))));
    }

    @GetMapping("/{salesMenuRef}/draft/items/{salesItemRef}")
    SalesMenuDraftItemView draftItem(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef,
            @PathVariable UUID salesItemRef) {
        var scope = readScope(request, groupWorkspaceKey, storeRef);
        return SalesMenuWireMapper.draftItem(salesMenus.readDraftItem(new SalesMenuItemQuery(
                support.itemTarget(scope, salesMenuRef, salesItemRef), SalesMenuVersionKind.DRAFT, null)));
    }

    @GetMapping("/{salesMenuRef}/published/sections")
    SalesMenuPublishedSectionList publishedSections(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef) {
        return SalesMenuWireMapper.publishedSections(salesMenus.listPublishedSections(new SalesMenuVersionQuery(
                target(request, groupWorkspaceKey, storeRef, salesMenuRef), SalesMenuVersionKind.PUBLISHED)));
    }

    @GetMapping("/{salesMenuRef}/published/sections/{salesSectionRef}/items")
    SalesMenuPublishedItemPage publishedItems(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef,
            @PathVariable UUID salesSectionRef,
            @RequestParam UUID channelRef,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer pageSize) {
        var scope = readScope(request, groupWorkspaceKey, storeRef);
        support.requireEligibleChannel(scope, channelRef);
        return SalesMenuWireMapper.publishedItemPage(salesMenus.listPublishedItems(new SalesMenuItemPageQuery(
                support.menuTarget(scope, salesMenuRef),
                SalesMenuVersionKind.PUBLISHED,
                salesSectionRef,
                channelRef,
                support.page(cursor, pageSize))));
    }

    @GetMapping("/{salesMenuRef}/published/items/{salesItemRef}")
    SalesMenuPublishedItemView publishedItem(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef,
            @PathVariable UUID salesItemRef,
            @RequestParam UUID channelRef) {
        var scope = readScope(request, groupWorkspaceKey, storeRef);
        support.requireEligibleChannel(scope, channelRef);
        return SalesMenuWireMapper.publishedItem(salesMenus.readPublishedItem(new SalesMenuItemQuery(
                support.itemTarget(scope, salesMenuRef, salesItemRef), SalesMenuVersionKind.PUBLISHED, channelRef)));
    }

    @GetMapping("/{salesMenuRef}/draft/item-candidates")
    SalesMenuCandidatePage candidates(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef,
            @RequestParam(required = false) UUID categoryRef,
            @RequestParam(name = "query", required = false) String query,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer pageSize) {
        var scope = readScope(request, groupWorkspaceKey, storeRef);
        return SalesMenuWireMapper.candidatePage(salesMenus.listItemCandidates(new SalesMenuCandidateQuery(
                support.menuTarget(scope, salesMenuRef), categoryRef, query, support.page(cursor, pageSize))));
    }

    @GetMapping("/{salesMenuRef}/draft/publication-preview")
    SalesMenuPublicationPreview publicationPreview(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef,
            @RequestParam UUID channelRef) {
        var scope = readScope(request, groupWorkspaceKey, storeRef);
        support.requireEligibleChannel(scope, channelRef);
        return SalesMenuWireMapper.publicationPreview(
                salesMenus.publicationPreview(support.menuTarget(scope, salesMenuRef), channelRef));
    }

    @GetMapping("/{salesMenuRef}/sales-menu-operation-records")
    SalesMenuOperationRecordPage operationRecords(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef,
            @RequestParam UUID channelRef,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer pageSize) {
        var scope = readScope(request, groupWorkspaceKey, storeRef);
        support.requireEligibleChannel(scope, channelRef);
        return SalesMenuWireMapper.operationRecordPage(salesMenus.listOperationRecords(new SalesMenuOperationQuery(
                support.menuTarget(scope, salesMenuRef), channelRef, support.page(cursor, pageSize))));
    }

    @PostMapping
    ResponseEntity<SalesMenuCommandReadback> create(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody SalesMenuCreateRequest body) {
        if (body == null) throw new InvalidEdgeRequestException("request body is required");
        var session = support.commandSession(request, groupWorkspaceKey);
        var scope = support.scope(session, groupWorkspaceKey, storeRef);
        var context = support.commandContext(session, scope, null, REQ_CREATE, idempotencyKey);
        return created(SalesMenuWireMapper.command(
                runCommand("createOperationsSalesMenu", context, null, body.channelRef(), () -> {
                    support.requireEligibleChannel(scope, body.channelRef());
                    return commandBindings.bindCreateOperationsSalesMenu(new SalesMenuCommandApi.CreateCommand(
                            context, body.channelRef(), support.requiredText(body.name(), "name")));
                })));
    }

    @PostMapping("/{salesMenuRef}/copies")
    ResponseEntity<SalesMenuCommandReadback> copy(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody SalesMenuCopyRequest body) {
        var command = command(request, groupWorkspaceKey, storeRef, salesMenuRef, REQ_COPY, idempotencyKey);
        return created(SalesMenuWireMapper.command(runCommand(
                "copyOperationsSalesMenu",
                command,
                salesMenuRef,
                null,
                () -> commandBindings.bindCopyOperationsSalesMenu(new SalesMenuCommandApi.CopyCommand(
                        command, support.expected(body == null ? null : body.expectedVersion(), "expectedVersion"))))));
    }

    @PatchMapping("/{salesMenuRef}/name")
    SalesMenuCommandReadback rename(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody SalesMenuRenameRequest body) {
        var context = command(request, groupWorkspaceKey, storeRef, salesMenuRef, REQ_RENAME, idempotencyKey);
        return SalesMenuWireMapper.command(runCommand(
                "renameOperationsSalesMenu",
                context,
                salesMenuRef,
                null,
                () -> commandBindings.bindRenameOperationsSalesMenu(new SalesMenuCommandApi.RenameCommand(
                        context,
                        support.expected(body == null ? null : body.expectedVersion(), "expectedVersion"),
                        support.requiredText(body == null ? null : body.name(), "name")))));
    }

    @PostMapping("/{salesMenuRef}/archive")
    SalesMenuCommandReadback archive(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody SalesMenuArchiveRequest body) {
        var context = command(request, groupWorkspaceKey, storeRef, salesMenuRef, REQ_ARCHIVE, idempotencyKey);
        return SalesMenuWireMapper.command(runCommand(
                "archiveOperationsSalesMenu",
                context,
                salesMenuRef,
                null,
                () -> commandBindings.bindArchiveOperationsSalesMenu(new SalesMenuCommandApi.ArchiveCommand(
                        context, support.expected(body == null ? null : body.expectedVersion(), "expectedVersion")))));
    }

    @PutMapping("/{salesMenuRef}/channels/{channelRef}/activation")
    SalesMenuCommandReadback activation(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef,
            @PathVariable UUID channelRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody SalesMenuActivationRequest body) {
        var session = support.commandSession(request, groupWorkspaceKey);
        var scope = support.scope(session, groupWorkspaceKey, storeRef);
        var context = support.commandContext(session, scope, salesMenuRef, REQ_SET_ACTIVATION, idempotencyKey);
        return SalesMenuWireMapper.command(
                runCommand("setOperationsSalesMenuActivation", context, salesMenuRef, channelRef, () -> {
                    support.requireEligibleChannel(scope, channelRef);
                    return commandBindings.bindSetOperationsSalesMenuActivation(
                            new SalesMenuCommandApi.ActivationCommand(
                                    context,
                                    channelRef,
                                    support.activationStatus(body == null ? null : body.status()),
                                    support.expected(body == null ? null : body.expectedVersion(), "expectedVersion")));
                }));
    }

    @PutMapping("/{salesMenuRef}/draft/schedule")
    SalesMenuCommandReadback schedule(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody SalesMenuScheduleUpdateRequest body) {
        var context = command(request, groupWorkspaceKey, storeRef, salesMenuRef, REQ_UPDATE_SCHEDULE, idempotencyKey);
        return SalesMenuWireMapper.command(runCommand(
                "updateOperationsSalesMenuSchedule",
                context,
                salesMenuRef,
                null,
                () -> commandBindings.bindUpdateOperationsSalesMenuSchedule(new SalesMenuCommandApi.ScheduleCommand(
                        context,
                        support.schedule(body == null ? null : body.schedule()),
                        support.expected(body == null ? null : body.expectedVersion(), "expectedVersion")))));
    }

    @PostMapping("/{salesMenuRef}/draft/sections")
    ResponseEntity<SalesMenuCommandReadback> createSection(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody SalesMenuSectionCreateRequest body) {
        var context = command(request, groupWorkspaceKey, storeRef, salesMenuRef, REQ_CREATE_SECTION, idempotencyKey);
        return created(SalesMenuWireMapper.command(runCommand(
                "createOperationsSalesMenuSection",
                context,
                salesMenuRef,
                null,
                () -> commandBindings.bindCreateOperationsSalesMenuSection(new SalesMenuCommandApi.SectionCreateCommand(
                        context,
                        support.requiredText(body == null ? null : body.name(), "name"),
                        support.expected(body == null ? null : body.expectedVersion(), "expectedVersion"))))));
    }

    @PatchMapping("/{salesMenuRef}/draft/sections/{salesSectionRef}/name")
    SalesMenuCommandReadback renameSection(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef,
            @PathVariable UUID salesSectionRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody SalesMenuSectionRenameRequest body) {
        var context = command(request, groupWorkspaceKey, storeRef, salesMenuRef, REQ_RENAME_SECTION, idempotencyKey);
        return SalesMenuWireMapper.command(runCommand(
                "renameOperationsSalesMenuSection",
                context,
                salesMenuRef,
                null,
                () -> commandBindings.bindRenameOperationsSalesMenuSection(new SalesMenuCommandApi.SectionRenameCommand(
                        context,
                        salesSectionRef,
                        support.requiredText(body == null ? null : body.name(), "name"),
                        support.expected(body == null ? null : body.expectedVersion(), "expectedVersion")))));
    }

    @DeleteMapping("/{salesMenuRef}/draft/sections/{salesSectionRef}")
    SalesMenuCommandReadback deleteSection(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef,
            @PathVariable UUID salesSectionRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody SalesMenuDeleteRequest body) {
        var context = command(request, groupWorkspaceKey, storeRef, salesMenuRef, REQ_DELETE_SECTION, idempotencyKey);
        return SalesMenuWireMapper.command(runCommand(
                "deleteOperationsSalesMenuSection",
                context,
                salesMenuRef,
                null,
                () -> commandBindings.bindDeleteOperationsSalesMenuSection(new SalesMenuCommandApi.SectionDeleteCommand(
                        context,
                        salesSectionRef,
                        support.expected(body == null ? null : body.expectedVersion(), "expectedVersion")))));
    }

    @PostMapping("/{salesMenuRef}/draft/sections/{salesSectionRef}/move")
    SalesMenuCommandReadback moveSection(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef,
            @PathVariable UUID salesSectionRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody SalesMenuSectionMoveRequest body) {
        var context = command(request, groupWorkspaceKey, storeRef, salesMenuRef, REQ_MOVE_SECTION, idempotencyKey);
        return SalesMenuWireMapper.command(runCommand(
                "moveOperationsSalesMenuSection",
                context,
                salesMenuRef,
                null,
                () -> commandBindings.bindMoveOperationsSalesMenuSection(new SalesMenuCommandApi.SectionMoveCommand(
                        context,
                        salesSectionRef,
                        support.moveDirection(body == null ? null : body.direction()),
                        support.expected(body == null ? null : body.expectedVersion(), "expectedVersion")))));
    }

    @PostMapping("/{salesMenuRef}/draft/sections/{salesSectionRef}/items")
    ResponseEntity<SalesMenuCommandReadback> addItems(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef,
            @PathVariable UUID salesSectionRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody SalesMenuItemsAddRequest body) {
        var context = command(request, groupWorkspaceKey, storeRef, salesMenuRef, REQ_ADD_ITEMS, idempotencyKey);
        return created(SalesMenuWireMapper.command(runCommand(
                "addOperationsSalesMenuItems",
                context,
                salesMenuRef,
                null,
                () -> commandBindings.bindAddOperationsSalesMenuItems(new SalesMenuCommandApi.ItemsAddCommand(
                        context,
                        salesSectionRef,
                        support.requiredRefs(body == null ? null : body.catalogItemRefs(), "catalogItemRefs"),
                        support.expected(body == null ? null : body.expectedVersion(), "expectedVersion"))))));
    }

    @PutMapping("/{salesMenuRef}/draft/items/{salesItemRef}")
    SalesMenuCommandReadback updateItem(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef,
            @PathVariable UUID salesItemRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody SalesMenuItemUpdateRequest body) {
        var context = command(request, groupWorkspaceKey, storeRef, salesMenuRef, REQ_UPDATE_ITEM, idempotencyKey);
        if (body == null) throw new InvalidEdgeRequestException("request body is required");
        return SalesMenuWireMapper.command(runCommand(
                "updateOperationsSalesMenuItem",
                context,
                salesItemRef,
                null,
                () -> commandBindings.bindUpdateOperationsSalesMenuItem(new SalesMenuCommandApi.ItemUpdateCommand(
                        context,
                        salesItemRef,
                        body.displayNameOverride(),
                        support.saleContent(body.saleContent()),
                        support.ordering(body.orderingConstraints()),
                        support.displayMedia(body.displayMedia()),
                        support.assetBindings(request.salesMenuAssetBindGrants()),
                        support.expected(body.expectedVersion(), "expectedVersion")))));
    }

    @DeleteMapping("/{salesMenuRef}/draft/items/{salesItemRef}")
    SalesMenuCommandReadback deleteItem(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef,
            @PathVariable UUID salesItemRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody SalesMenuDeleteRequest body) {
        var context = command(request, groupWorkspaceKey, storeRef, salesMenuRef, REQ_DELETE_ITEM, idempotencyKey);
        return SalesMenuWireMapper.command(runCommand(
                "deleteOperationsSalesMenuItem",
                context,
                salesItemRef,
                null,
                () -> commandBindings.bindDeleteOperationsSalesMenuItem(new SalesMenuCommandApi.ItemDeleteCommand(
                        context,
                        salesItemRef,
                        support.expected(body == null ? null : body.expectedVersion(), "expectedVersion")))));
    }

    @PostMapping("/{salesMenuRef}/draft/items/{salesItemRef}/move")
    SalesMenuCommandReadback moveItem(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef,
            @PathVariable UUID salesItemRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody SalesMenuItemMoveRequest body) {
        var context = command(request, groupWorkspaceKey, storeRef, salesMenuRef, REQ_MOVE_ITEM, idempotencyKey);
        return SalesMenuWireMapper.command(runCommand(
                "moveOperationsSalesMenuItem",
                context,
                salesItemRef,
                null,
                () -> commandBindings.bindMoveOperationsSalesMenuItem(new SalesMenuCommandApi.ItemMoveCommand(
                        context,
                        salesItemRef,
                        support.moveDirection(body == null ? null : body.direction()),
                        support.expected(body == null ? null : body.expectedVersion(), "expectedVersion")))));
    }

    @PostMapping("/{salesMenuRef}/publications")
    ResponseEntity<SalesMenuCommandReadback> publish(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody SalesMenuPublishRequest body) {
        var context = command(request, groupWorkspaceKey, storeRef, salesMenuRef, REQ_PUBLISH, idempotencyKey, true);
        return created(SalesMenuWireMapper.command(runCommand(
                "publishOperationsSalesMenu",
                context,
                salesMenuRef,
                null,
                () -> commandBindings.bindPublishOperationsSalesMenu(new SalesMenuCommandApi.PublishCommand(
                        context, support.expected(body == null ? null : body.expectedVersion(), "expectedVersion"))))));
    }

    @PostMapping("/{salesMenuRef}/published/items/{salesItemRef}/channels/{channelRef}/manual-sold-out")
    SalesMenuCommandReadback manualSoldOut(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef,
            @PathVariable UUID salesItemRef,
            @PathVariable UUID channelRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody SalesMenuManualSoldOutRequest body) {
        var session = support.commandSession(request, groupWorkspaceKey);
        var scope = support.scope(session, groupWorkspaceKey, storeRef);
        var context = support.commandContext(session, scope, salesMenuRef, REQ_SET_SOLD_OUT, idempotencyKey);
        return SalesMenuWireMapper.command(
                runCommand("setOperationsSalesMenuItemSoldOut", context, salesItemRef, channelRef, () -> {
                    support.requireEligibleChannel(scope, channelRef);
                    return commandBindings.bindSetOperationsSalesMenuItemSoldOut(
                            new SalesMenuCommandApi.ManualSoldOutCommand(
                                    context,
                                    channelRef,
                                    salesItemRef,
                                    support.requiredText(body == null ? null : body.reason(), "reason"),
                                    support.expected(body == null ? null : body.expectedVersion(), "expectedVersion")));
                }));
    }

    @PostMapping("/{salesMenuRef}/published/items/{salesItemRef}/channels/{channelRef}/manual-restore")
    SalesMenuCommandReadback manualRestore(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef,
            @PathVariable UUID salesItemRef,
            @PathVariable UUID channelRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody SalesMenuManualRestoreRequest body) {
        var session = support.commandSession(request, groupWorkspaceKey);
        var scope = support.scope(session, groupWorkspaceKey, storeRef);
        if (body == null || body.confirm() == null) {
            throw new InvalidEdgeRequestException("confirm is required");
        }
        var context = support.commandContext(session, scope, salesMenuRef, REQ_RESTORE, idempotencyKey);
        return SalesMenuWireMapper.command(
                runCommand("restoreOperationsSalesMenuItemSale", context, salesItemRef, channelRef, () -> {
                    support.requireEligibleChannel(scope, channelRef);
                    return commandBindings.bindRestoreOperationsSalesMenuItemSale(
                            new SalesMenuCommandApi.ManualRestoreCommand(
                                    context,
                                    channelRef,
                                    salesItemRef,
                                    body.confirm(),
                                    support.expected(body.expectedVersion(), "expectedVersion")));
                }));
    }

    private SalesMenuTarget target(
            EdgeRequestContext request, String groupWorkspaceKey, UUID storeRef, UUID salesMenuRef) {
        return support.menuTarget(readScope(request, groupWorkspaceKey, storeRef), salesMenuRef);
    }

    private com.catering.v2s.salesmenu.domain.SalesMenuScope readScope(
            EdgeRequestContext request, String groupWorkspaceKey, UUID storeRef) {
        return support.scope(support.readSession(request, groupWorkspaceKey), groupWorkspaceKey, storeRef);
    }

    private SalesMenuCommandApi.CommandContext command(
            EdgeRequestContext request,
            String groupWorkspaceKey,
            UUID storeRef,
            UUID salesMenuRef,
            String requirementId,
            String idempotencyKey) {
        return command(request, groupWorkspaceKey, storeRef, salesMenuRef, requirementId, idempotencyKey, false);
    }

    private SalesMenuCommandApi.CommandContext command(
            EdgeRequestContext request,
            String groupWorkspaceKey,
            UUID storeRef,
            UUID salesMenuRef,
            String requirementId,
            String idempotencyKey,
            boolean allowDisabledStoreTarget) {
        var session = support.commandSession(request, groupWorkspaceKey);
        var scope = support.scope(session, groupWorkspaceKey, storeRef);
        return support.commandContext(
                session, scope, salesMenuRef, requirementId, idempotencyKey, allowDisabledStoreTarget);
    }

    private SalesMenuReadback.Command runCommand(
            String operationKind,
            SalesMenuCommandApi.CommandContext context,
            UUID targetRef,
            UUID channelRef,
            java.util.function.Supplier<SalesMenuReadback.Command> command) {
        return failureRecorder.execute(operationKind, context, targetRef, channelRef, command);
    }

    private static <T> ResponseEntity<T> created(T value) {
        return ResponseEntity.status(HttpStatus.CREATED).body(value);
    }
}
