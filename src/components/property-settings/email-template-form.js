'use client';
"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailTemplateForm = void 0;
var react_1 = require("react");
var button_1 = require("@/components/ui/button");
var icons_1 = require("@/components/icons");
var input_1 = require("@/components/ui/input");
var label_1 = require("@/components/ui/label");
var switch_1 = require("@/components/ui/switch");
var select_1 = require("@/components/ui/select");
var firestore_1 = require("firebase/firestore");
var firebase_1 = require("@/lib/firebase");
var auth_context_1 = require("@/contexts/auth-context");
var defaults_1 = require("@/lib/email-templates/defaults");
var MERGE_TAGS = [
    {
        category: 'Guest',
        tags: [
            { tag: '{{guest_name}}', label: 'Guest Name' },
            { tag: '{{guest_phone}}', label: 'Guest Phone' },
            { tag: '{{guest_email}}', label: 'Guest Email' }
        ]
    },
    {
        category: 'Reservation',
        tags: [
            { tag: '{{reservation_code}}', label: 'Reservation Code' },
            { tag: '{{reservation_number}}', label: 'Reservation Number' },
            { tag: '{{check_in_date}}', label: 'Check-in Date' },
            { tag: '{{check_out_date}}', label: 'Check-out Date' },
            { tag: '{{number_of_nights}}', label: 'Number of Nights' },
            { tag: '{{number_of_guests}}', label: 'Number of Guests' }
        ]
    },
    {
        category: 'Room',
        tags: [
            { tag: '{{room_type}}', label: 'Room Type' },
            { tag: '{{room_number}}', label: 'Room Number' },
            { tag: '{{check_in_time}}', label: 'Check-in Time' },
            { tag: '{{check_out_time}}', label: 'Check-out Time' }
        ]
    },
    {
        category: 'Property',
        tags: [
            { tag: '{{property_name}}', label: 'Property Name' },
            { tag: '{{property_address}}', label: 'Property Address' },
            { tag: '{{property_phone}}', label: 'Property Phone' },
            { tag: '{{property_email}}', label: 'Property Email' },
            { tag: '{{property_website}}', label: 'Property Website' }
        ]
    },
    {
        category: 'Pricing',
        tags: [
            { tag: '{{total_price}}', label: 'Total Price' },
            { tag: '{{total_taxes}}', label: 'Total Taxes' },
            { tag: '{{price_breakdown}}', label: 'Price Breakdown' },
            { tag: '{{currency}}', label: 'Currency' }
        ]
    },
    {
        category: 'Invoice',
        tags: [
            { tag: '{{invoice_number}}', label: 'Invoice Number' },
            { tag: '{{invoice_amount}}', label: 'Invoice Amount' },
            { tag: '{{invoice_due_date}}', label: 'Invoice Due Date' }
        ]
    },
    {
        category: 'Extras',
        tags: [
            { tag: '{{extras}}', label: 'Additional Extras/Services' }
        ]
    }
];
exports.EmailTemplateForm = (0, react_1.forwardRef)(function EmailTemplateForm(_a, ref) {
    var _this = this;
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
    var template = _a.template, onSubmit = _a.onSubmit, _r = _a.isLoading, isLoading = _r === void 0 ? false : _r;
    var _s = (0, auth_context_1.useAuth)() || {}, user = _s.user, property = _s.property;
    var currentProperty = property;
    var _t = (0, react_1.useState)('content'), activeTab = _t[0], setActiveTab = _t[1];
    var _u = (0, react_1.useState)('rich'), editorMode = _u[0], setEditorMode = _u[1];
    var _v = (0, react_1.useState)('desktop'), previewMode = _v[0], setPreviewMode = _v[1];
    var _w = (0, react_1.useState)([]), availableEmails = _w[0], setAvailableEmails = _w[1];
    var _x = (0, react_1.useState)(null), propertyData = _x[0], setPropertyData = _x[1];
    var _y = (0, react_1.useState)(function () {
        if (!template) {
            return {
                id: '',
                name: '',
                category: 'manual',
                enabled: true,
                fromName: '',
                fromEmail: '',
                replyTo: '',
                ccList: '',
                bccList: '',
                emailType: 'transactional',
                subject: '',
                preheaderText: '',
                description: '',
                signatureTemplateId: '',
                signatureName: '',
                signaturePropertyName: '',
                signaturePhone: '',
                signatureEmail: '',
                signatureAddress: '',
                signatureWebsite: '',
                signatureLogo: '',
                signatureSocialMedia: {},
            };
        }
        // Get default content if available
        var defaultContent = defaults_1.defaultEmailTemplateContents[template.id];
        return {
            id: template.id,
            name: template.name || '',
            category: template.category || 'manual',
            enabled: template.enabled !== undefined ? template.enabled : true,
            fromName: template.fromName || '',
            fromEmail: template.fromEmail || '',
            replyTo: template.replyTo || '',
            ccList: template.ccList || '',
            bccList: template.bccList || '',
            emailType: template.emailType || 'transactional',
            subject: template.subject || (defaultContent === null || defaultContent === void 0 ? void 0 : defaultContent.subject) || '',
            preheaderText: template.preheaderText || (defaultContent === null || defaultContent === void 0 ? void 0 : defaultContent.preheaderText) || '',
            description: template.description || '',
            signatureTemplateId: template.signatureTemplateId || '',
            signatureName: template.signatureName || '',
            signaturePropertyName: template.signaturePropertyName || '',
            signaturePhone: template.signaturePhone || '',
            signatureEmail: template.signatureEmail || '',
            signatureAddress: template.signatureAddress || '',
            signatureWebsite: template.signatureWebsite || '',
            signatureLogo: template.signatureLogo || '',
            signatureSocialMedia: template.signatureSocialMedia || {},
        };
    }), formData = _y[0], setFormData = _y[1];
    var _z = (0, react_1.useState)(function () {
        if (!(template === null || template === void 0 ? void 0 : template.id))
            return '';
        var defaultContent = defaults_1.defaultEmailTemplateContents[template.id];
        return template.htmlContent || (defaultContent === null || defaultContent === void 0 ? void 0 : defaultContent.htmlContent) || '';
    }), htmlContent = _z[0], setHtmlContent = _z[1];
    var richEditorRef = (0, react_1.useRef)(null);
    var selectedRangeRef = (0, react_1.useRef)(null);
    var _0 = (0, react_1.useState)([]), blocks = _0[0], setBlocks = _0[1];
    var _1 = (0, react_1.useState)(null), selectedBlockId = _1[0], setSelectedBlockId = _1[1];
    var _2 = (0, react_1.useState)(false), showBlockEditor = _2[0], setShowBlockEditor = _2[1];
    var _3 = (0, react_1.useState)(false), showLinkForm = _3[0], setShowLinkForm = _3[1];
    var _4 = (0, react_1.useState)(false), hasSelectedText = _4[0], setHasSelectedText = _4[1];
    var _5 = (0, react_1.useState)(''), linkText = _5[0], setLinkText = _5[1];
    var _6 = (0, react_1.useState)(''), linkUrl = _6[0], setLinkUrl = _6[1];
    var _7 = (0, react_1.useState)(false), showLinkEdit = _7[0], setShowLinkEdit = _7[1];
    var _8 = (0, react_1.useState)(null), editingLinkElement = _8[0], setEditingLinkElement = _8[1];
    var _9 = (0, react_1.useState)(''), editingLinkUrl = _9[0], setEditingLinkUrl = _9[1];
    var _10 = (0, react_1.useState)('#000000'), textColor = _10[0], setTextColor = _10[1];
    var _11 = (0, react_1.useState)('#FFFF00'), highlightColor = _11[0], setHighlightColor = _11[1];
    // Drag and drop state
    var _12 = (0, react_1.useState)(null), draggedBlockId = _12[0], setDraggedBlockId = _12[1];
    // Merge tag autocomplete state
    var _13 = (0, react_1.useState)(''), mergeTagSearch = _13[0], setMergeTagSearch = _13[1];
    var _14 = (0, react_1.useState)(false), showMergeTagSuggestions = _14[0], setShowMergeTagSuggestions = _14[1];
    // Fetch property data including contact info
    (0, react_1.useEffect)(function () {
        var fetchPropertyData = function () { return __awaiter(_this, void 0, void 0, function () {
            var contactDoc, infosDoc, emails_1, contactData, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(currentProperty === null || currentProperty === void 0 ? void 0 : currentProperty.id))
                            return [2 /*return*/];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, (0, firestore_1.getDoc)((0, firestore_1.doc)(firebase_1.db, 'properties', currentProperty.id, 'settings', 'contact'))];
                    case 2:
                        contactDoc = _a.sent();
                        return [4 /*yield*/, (0, firestore_1.getDoc)((0, firestore_1.doc)(firebase_1.db, 'properties', currentProperty.id, 'settings', 'infos'))];
                    case 3:
                        infosDoc = _a.sent();
                        if (contactDoc.exists() || infosDoc.exists()) {
                            setPropertyData({
                                contact: contactDoc.data() || {},
                                infos: infosDoc.data() || {},
                            });
                            emails_1 = [];
                            contactData = contactDoc.data() || {};
                            if (contactData.primaryEmail) {
                                emails_1.push({ email: contactData.primaryEmail, type: 'Primary Property Email' });
                            }
                            if (contactData.departmentContacts && Array.isArray(contactData.departmentContacts)) {
                                contactData.departmentContacts.forEach(function (dept) {
                                    if (dept.type === 'email') {
                                        emails_1.push({ email: dept.value, type: "".concat(dept.departmentName, " - Email") });
                                    }
                                });
                            }
                            setAvailableEmails(emails_1);
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _a.sent();
                        console.error('Error fetching property data:', error_1);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        }); };
        fetchPropertyData();
    }, [currentProperty === null || currentProperty === void 0 ? void 0 : currentProperty.id]);
    (0, react_1.useEffect)(function () {
        if (template) {
            setFormData({
                id: template.id || '',
                name: template.name || '',
                category: template.category || 'manual',
                enabled: template.enabled !== undefined ? template.enabled : true,
                fromName: template.fromName || '',
                fromEmail: template.fromEmail || '',
                replyTo: template.replyTo || '',
                subject: template.subject || '',
                preheaderText: template.preheaderText || '',
                description: template.description || '',
                signatureTemplateId: template.signatureTemplateId || '',
                signatureName: template.signatureName || '',
                signaturePropertyName: template.signaturePropertyName || '',
                signaturePhone: template.signaturePhone || '',
                signatureEmail: template.signatureEmail || '',
                signatureAddress: template.signatureAddress || '',
                signatureWebsite: template.signatureWebsite || '',
                signatureLogo: template.signatureLogo || '',
                signatureSocialMedia: template.signatureSocialMedia || {},
            });
            // Load HTML content from the template, with fallback to defaults
            var defaultContent = defaults_1.defaultEmailTemplateContents[template.id];
            var contentToLoad = template.htmlContent || (defaultContent === null || defaultContent === void 0 ? void 0 : defaultContent.htmlContent) || '';
            setHtmlContent(contentToLoad);
            console.log('Template loaded - htmlContent:', contentToLoad);
        }
    }, [template]);
    (0, react_1.useEffect)(function () {
        if (richEditorRef.current && editorMode === 'rich') {
            richEditorRef.current.innerHTML = htmlContent;
        }
    }, [editorMode, htmlContent]);
    var handleChange = function (field, value) {
        setFormData(function (prev) {
            var _a;
            return (__assign(__assign({}, prev), (_a = {}, _a[field] = value, _a)));
        });
    };
    var handleSubmit = function () {
        // Include htmlContent and richEditorRef content in the submission
        var submissionData = __assign(__assign({}, formData), { id: formData.id || '', htmlContent: editorMode === 'rich' && richEditorRef.current ? richEditorRef.current.innerHTML : htmlContent });
        console.log('Form submitting with data:', submissionData);
        onSubmit(submissionData);
    };
    // Expose submit method through ref
    (0, react_1.useImperativeHandle)(ref, function () { return ({
        submitForm: handleSubmit,
    }); }, [formData, htmlContent, editorMode, onSubmit]);
    // Block management functions
    var addTextBlock = function () {
        var newBlock = {
            id: "text-".concat(Date.now()),
            type: 'text',
            content: 'Enter your text here',
            fontSize: 14,
            color: '#1f2937',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'normal',
            alignment: 'left',
            padding: 10,
            marginTop: 8,
            marginBottom: 8,
        };
        setBlocks(__spreadArray(__spreadArray([], blocks, true), [newBlock], false));
        setSelectedBlockId(newBlock.id);
        setShowBlockEditor(true);
    };
    var addImageBlock = function () {
        var newBlock = {
            id: "image-".concat(Date.now()),
            type: 'image',
            src: '',
            width: 300,
            height: 200,
            alignment: 'center',
            borderRadius: 4,
            padding: 10,
            marginTop: 8,
            marginBottom: 8,
            altText: 'Image',
        };
        setBlocks(__spreadArray(__spreadArray([], blocks, true), [newBlock], false));
        setSelectedBlockId(newBlock.id);
        setShowBlockEditor(true);
    };
    var addButtonBlock = function () {
        var newBlock = {
            id: "button-".concat(Date.now()),
            type: 'button',
            text: 'Click Me',
            url: '',
            backgroundColor: '#3b82f6',
            textColor: '#ffffff',
            padding: 12,
            borderRadius: 6,
            fontSize: 14,
            alignment: 'center',
            width: 150,
            marginTop: 8,
            marginBottom: 8,
        };
        setBlocks(__spreadArray(__spreadArray([], blocks, true), [newBlock], false));
        setSelectedBlockId(newBlock.id);
        setShowBlockEditor(true);
    };
    var addDividerBlock = function () {
        var newBlock = {
            id: "divider-".concat(Date.now()),
            type: 'divider',
            color: '#e5e7eb',
            height: 1,
            marginTop: 16,
            marginBottom: 16,
            width: 100,
        };
        setBlocks(__spreadArray(__spreadArray([], blocks, true), [newBlock], false));
        setSelectedBlockId(newBlock.id);
    };
    var addSpacerBlock = function () {
        var newBlock = {
            id: "spacer-".concat(Date.now()),
            type: 'spacer',
            height: 20,
        };
        setBlocks(__spreadArray(__spreadArray([], blocks, true), [newBlock], false));
        setSelectedBlockId(newBlock.id);
    };
    // Drag and drop handlers
    var handleDragStart = function (blockId) {
        setDraggedBlockId(blockId);
    };
    var handleDragOver = function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };
    var handleDrop = function (blockId) {
        if (!draggedBlockId || draggedBlockId === blockId)
            return;
        var draggedIndex = blocks.findIndex(function (b) { return b.id === draggedBlockId; });
        var targetIndex = blocks.findIndex(function (b) { return b.id === blockId; });
        if (draggedIndex === -1 || targetIndex === -1)
            return;
        var newBlocks = __spreadArray([], blocks, true);
        var draggedBlock = newBlocks.splice(draggedIndex, 1)[0];
        newBlocks.splice(targetIndex, 0, draggedBlock);
        setBlocks(newBlocks);
        setDraggedBlockId(null);
    };
    var deleteBlock = function (id) {
        setBlocks(blocks.filter(function (b) { return b.id !== id; }));
        if (selectedBlockId === id) {
            setSelectedBlockId(null);
            setShowBlockEditor(false);
        }
    };
    var updateBlock = function (id, updates) {
        setBlocks(blocks.map(function (b) { return b.id === id ? __assign(__assign({}, b), updates) : b; }));
    };
    var getSelectedBlock = function () {
        return blocks.find(function (b) { return b.id === selectedBlockId; });
    };
    var handleImageUpload = function (event) {
        var _a;
        var file = (_a = event.target.files) === null || _a === void 0 ? void 0 : _a[0];
        if (!file)
            return;
        // Check file type
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file');
            return;
        }
        // Check file size (max 5MB for base64)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image size should be less than 5MB');
            return;
        }
        var reader = new FileReader();
        reader.onload = function (e) {
            var _a;
            var dataUrl = (_a = e.target) === null || _a === void 0 ? void 0 : _a.result;
            if (selectedBlockId) {
                updateBlock(selectedBlockId, { src: dataUrl });
            }
        };
        reader.readAsDataURL(file);
    };
    var autoFillSignature = function () {
        if (!propertyData && !currentProperty)
            return;
        var contactData = (propertyData === null || propertyData === void 0 ? void 0 : propertyData.contact) || {};
        // Build address: Street address, zip code, city from property object
        var addressParts = [];
        if (currentProperty === null || currentProperty === void 0 ? void 0 : currentProperty.address)
            addressParts.push(currentProperty.address);
        if (currentProperty === null || currentProperty === void 0 ? void 0 : currentProperty.phone)
            addressParts.push(currentProperty.phone);
        if (currentProperty === null || currentProperty === void 0 ? void 0 : currentProperty.city)
            addressParts.push(currentProperty.city);
        var fullAddress = addressParts.join(', ');
        setFormData(function (prev) { return (__assign(__assign({}, prev), { signatureName: (user === null || user === void 0 ? void 0 : user.name) || '', signaturePropertyName: (currentProperty === null || currentProperty === void 0 ? void 0 : currentProperty.name) || '', signaturePhone: contactData.primaryPhone || (currentProperty === null || currentProperty === void 0 ? void 0 : currentProperty.phone) || '', signatureEmail: contactData.primaryEmail || (currentProperty === null || currentProperty === void 0 ? void 0 : currentProperty.email) || '', signatureAddress: fullAddress || ((currentProperty === null || currentProperty === void 0 ? void 0 : currentProperty.address) ? currentProperty.address : ''), signatureWebsite: contactData.websiteUrl || (currentProperty === null || currentProperty === void 0 ? void 0 : currentProperty.website) || '', signatureLogo: (currentProperty === null || currentProperty === void 0 ? void 0 : currentProperty.logoUrl) || '' })); });
    };
    var insertMergeTag = function (tag) {
        var _a;
        if (editorMode === 'rich') {
            // Insert at cursor position in rich text editor
            (_a = richEditorRef.current) === null || _a === void 0 ? void 0 : _a.focus();
            setTimeout(function () {
                var _a;
                document.execCommand('insertHTML', false, "<span class=\"bg-blue-100 text-blue-700 px-1 rounded font-mono text-xs font-semibold\">".concat(tag, "</span> "));
                (_a = richEditorRef.current) === null || _a === void 0 ? void 0 : _a.focus();
            }, 0);
        }
        else {
            // Append to end for visual/code modes
            setHtmlContent(function (prev) { return prev + tag; });
        }
    };
    var handleRichEditorChange = function (e) {
        var newContent = e.currentTarget.innerHTML;
        setHtmlContent(newContent);
    };
    var execCommand = function (command, value) {
        var _a;
        (_a = richEditorRef.current) === null || _a === void 0 ? void 0 : _a.focus();
        setTimeout(function () {
            var _a;
            document.execCommand(command, false, value);
            (_a = richEditorRef.current) === null || _a === void 0 ? void 0 : _a.focus();
        }, 0);
    };
    var handleInsertLink = function () {
        var selection = window.getSelection();
        var selectedText = selection === null || selection === void 0 ? void 0 : selection.toString().trim();
        // Store the selection range if text is selected
        if (selectedText && selection && selection.rangeCount > 0) {
            selectedRangeRef.current = selection.getRangeAt(0);
            setHasSelectedText(true);
            setLinkText(selectedText);
            setLinkUrl('');
        }
        else {
            // No text selected
            selectedRangeRef.current = null;
            setHasSelectedText(false);
            setLinkText('');
            setLinkUrl('');
        }
        setShowLinkForm(true);
    };
    var handleCreateLink = function () {
        var _a, _b;
        if (!linkUrl.trim())
            return;
        // Ensure URL has protocol
        var url = linkUrl.trim();
        if (!url.match(/^https?:\/\//)) {
            url = 'https://' + url;
        }
        if (hasSelectedText && selectedRangeRef.current) {
            // Restore the selection range before applying the link
            var selection = window.getSelection();
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(selectedRangeRef.current);
            }
            // Apply link to selected text
            document.execCommand('createLink', false, url);
        }
        else if (linkText.trim()) {
            // Create link with custom text
            (_a = richEditorRef.current) === null || _a === void 0 ? void 0 : _a.focus();
            setTimeout(function () {
                document.execCommand('insertHTML', false, "<a href=\"".concat(url, "\">").concat(linkText, "</a>"));
            }, 0);
        }
        (_b = richEditorRef.current) === null || _b === void 0 ? void 0 : _b.focus();
        setLinkUrl('');
        setLinkText('');
        setShowLinkForm(false);
        selectedRangeRef.current = null;
    };
    var handleLinkClick = function (e) {
        var target = e.target;
        if (target.tagName === 'A') {
            e.preventDefault();
            var linkElement = target;
            var href = linkElement.getAttribute('href') || '';
            setEditingLinkElement(linkElement);
            setEditingLinkUrl(href);
            setShowLinkEdit(true);
        }
    };
    var handleUpdateLink = function () {
        var _a;
        if (editingLinkElement && editingLinkUrl.trim()) {
            var url = editingLinkUrl.trim();
            if (!url.match(/^https?:\/\//)) {
                url = 'https://' + url;
            }
            editingLinkElement.setAttribute('href', url);
            setShowLinkEdit(false);
            setEditingLinkElement(null);
            setEditingLinkUrl('');
            (_a = richEditorRef.current) === null || _a === void 0 ? void 0 : _a.focus();
        }
    };
    var handleDeleteLink = function () {
        var _a;
        if (editingLinkElement) {
            var text = editingLinkElement.textContent || '';
            (_a = richEditorRef.current) === null || _a === void 0 ? void 0 : _a.focus();
            var selection = window.getSelection();
            var range = document.createRange();
            range.selectNodeContents(editingLinkElement);
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(range);
            }
            document.execCommand('unlink', false);
            setShowLinkEdit(false);
            setEditingLinkElement(null);
            setEditingLinkUrl('');
        }
    };
    var generateSignatureHtml = function () {
        var signatureName = formData.signatureName, signaturePropertyName = formData.signaturePropertyName, signaturePhone = formData.signaturePhone, signatureEmail = formData.signatureEmail, signatureAddress = formData.signatureAddress, signatureWebsite = formData.signatureWebsite, signatureLogo = formData.signatureLogo, signatureSocialMedia = formData.signatureSocialMedia;
        // Return empty signature if no data is provided
        var hasSignatureData = signatureName || signaturePropertyName || signaturePhone || signatureEmail || signatureAddress || signatureWebsite || signatureLogo;
        if (!hasSignatureData) {
            return '';
        }
        return "\n      <div style=\"margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-family: Arial, sans-serif; max-width: 100%; color: #1f2937; line-height: 1.6; font-size: 13px;\">\n        <div style=\"display: flex; align-items: center; gap: 16px; margin-bottom: 14px; flex-wrap: wrap;\">\n          ".concat(signatureLogo ? "<img src=\"".concat(signatureLogo, "\" style=\"max-width: 70px; max-height: 70px; border-radius: 4px; display: block;\" alt=\"Logo\" />") : '', "\n          <div style=\"display: flex; flex-direction: column; justify-content: center; min-height: 0; text-align: left;\">\n            ").concat(signaturePropertyName ? "<span style=\"font-size: 18px; font-weight: bold; color: #0f172a; line-height: 1.2;\">".concat(signaturePropertyName, "</span>") : '', "\n            ").concat(signatureAddress ? "<span style=\"color: #6b7280; font-size: 13px; margin-top: 2px;\">".concat(signatureAddress, "</span>") : '', "\n          </div>\n        </div>\n        ").concat(signaturePhone ? "<div style=\"margin-bottom: 6px; display: flex; align-items: center; gap: 6px;\"><span style=\"display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#1f2937\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z\"></path></svg></span><a href=\"tel:".concat(signaturePhone, "\" style=\"color: #1f2937; text-decoration: none;\">").concat(signaturePhone, "</a></div>") : '', "\n        ").concat(signatureEmail ? "<div style=\"margin-bottom: 6px; display: flex; align-items: center; gap: 6px;\"><span style=\"display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#1f2937\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"2\" y=\"4\" width=\"20\" height=\"16\" rx=\"2\"></rect><path d=\"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7\"></path></svg></span><a href=\"mailto:".concat(signatureEmail, "\" style=\"color: #1f2937; text-decoration: none; word-break: break-all;\">").concat(signatureEmail, "</a></div>") : '', "\n        ").concat(signatureWebsite ? "<div style=\"margin-bottom: 6px; display: flex; align-items: center; gap: 6px;\"><span style=\"display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#1f2937\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"></circle><line x1=\"2\" y1=\"12\" x2=\"22\" y2=\"12\"></line><path d=\"M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z\"></path></svg></span><a href=\"".concat(signatureWebsite, "\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"color: #1f2937; text-decoration: none;\">").concat(signatureWebsite, "</a></div>") : '', "\n        ").concat(signatureSocialMedia && (signatureSocialMedia.linkedin || signatureSocialMedia.instagram || signatureSocialMedia.facebook) ? "\n          <div style=\"margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;\">\n            ".concat(signatureSocialMedia.linkedin ? "<a href=\"".concat(signatureSocialMedia.linkedin, "\" style=\"display: inline-block; margin-right: 8px; color: #0f172a; text-decoration: none; font-size: 12px;\">LinkedIn</a>") : '', "\n            ").concat(signatureSocialMedia.instagram ? "<a href=\"".concat(signatureSocialMedia.instagram, "\" style=\"display: inline-block; margin-right: 8px; color: #0f172a; text-decoration: none; font-size: 12px;\">Instagram</a>") : '', "\n            ").concat(signatureSocialMedia.facebook ? "<a href=\"".concat(signatureSocialMedia.facebook, "\" style=\"display: inline-block; margin-right: 8px; color: #0f172a; text-decoration: none; font-size: 12px;\">Facebook</a>") : '', "\n          </div>\n        ") : '', "\n      </div>\n    ");
    };
    return (<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-0 h-full">
      {/* Left Sidebar: Form Controls */}
      <div className="lg:col-span-1 flex flex-col h-full overflow-hidden">
        
        {/* Navigation Tabs - Fixed at top */}
        <div className="bg-slate-100 p-1 rounded-xl flex gap-1 flex-shrink-0">
          {['content', 'settings', 'advanced'].map(function (tab) {
            var tabLabels = {
                content: 'Content',
                settings: 'Dynamic Tags',
                advanced: 'Signature'
            };
            return (<button key={tab} onClick={function () { return setActiveTab(tab); }} className={"flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ".concat(activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                {tabLabels[tab]}
              </button>);
        })}
        </div>

        {/* Tab Content Wrapper - Scrollable */}
        <div className="flex-1 overflow-y-auto space-y-4 py-4">

        {/* CONTENT TAB */}
        {activeTab === 'content' && (<div className="space-y-4">
            {/* Sender Details */}
            <div className="bg-white border rounded-lg p-4 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-slate-600 uppercase border-b pb-2">Sender Details</h3>
              
              <div>
                <div className="flex justify-between items-end mb-2">
                  <label_1.Label className="text-xs font-bold text-slate-600 uppercase">Template Name</label_1.Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">Enabled</span>
                    <switch_1.Switch checked={formData.enabled} onCheckedChange={function (checked) { return handleChange('enabled', checked); }} className="h-4 w-8"/>
                  </div>
                </div>
                <input_1.Input value={formData.name} onChange={function (e) { return handleChange('name', e.target.value); }} className="h-8 text-sm" placeholder="e.g., Welcome Email"/>
              </div>

              <div>
                <label_1.Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Language</label_1.Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="overrideLanguages" className="rounded border-slate-300"/>
                    <label htmlFor="overrideLanguages" className="text-xs text-slate-600">Override all languages</label>
                  </div>
                  <div className="flex gap-2">
                    <select_1.Select defaultValue="en">
                      <select_1.SelectTrigger className="h-8 text-sm flex-1">
                        <select_1.SelectValue />
                      </select_1.SelectTrigger>
                      <select_1.SelectContent>
                        <select_1.SelectItem value="en">English</select_1.SelectItem>
                        <select_1.SelectItem value="fr">Français</select_1.SelectItem>
                        <select_1.SelectItem value="es">Español</select_1.SelectItem>
                        <select_1.SelectItem value="de">Deutsch</select_1.SelectItem>
                      </select_1.SelectContent>
                    </select_1.Select>
                    <button_1.Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                      <icons_1.Icons.Languages className="h-3 w-3"/> Translate
                    </button_1.Button>
                  </div>
                </div>
              </div>

              <div>
                <label_1.Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Send From</label_1.Label>
                <div className="space-y-2">
                  <input_1.Input value={formData.fromName} onChange={function (e) { return handleChange('fromName', e.target.value); }} className="h-8 text-sm" placeholder="Name (e.g., Your Hotel)"/>
                  <input_1.Input type="email" value={formData.fromEmail} onChange={function (e) { return handleChange('fromEmail', e.target.value); }} className="h-8 text-sm" placeholder="Email (noreply@yourhotel.com)"/>
                  <p className="text-xs text-orange-600 font-semibold flex items-center gap-1">
                    <icons_1.Icons.AlertCircle className="h-3 w-3"/> Verify your domain to ensure delivery
                  </p>
                </div>
              </div>

              <div>
                <label_1.Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Reply To</label_1.Label>
                <div className="space-y-2">
                  <input_1.Input type="email" value={formData.replyTo} onChange={function (e) { return handleChange('replyTo', e.target.value); }} className="h-8 text-sm" placeholder="support@yourhotel.com"/>
                </div>
              </div>

              <div>
                <label_1.Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">CC List</label_1.Label>
                <input_1.Input value={formData.ccList || ''} onChange={function (e) { return handleChange('ccList', e.target.value); }} className="h-8 text-sm" placeholder="email1@example.com, email2@example.com"/>
                <p className="text-xs text-slate-500 mt-1">Separate multiple emails with commas</p>
              </div>

              <div>
                <label_1.Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">BCC List</label_1.Label>
                <input_1.Input value={formData.bccList || ''} onChange={function (e) { return handleChange('bccList', e.target.value); }} className="h-8 text-sm" placeholder="email1@example.com, email2@example.com"/>
                <p className="text-xs text-slate-500 mt-1">Separate multiple emails with commas</p>
              </div>

              <div>
                <label_1.Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Email Type</label_1.Label>
                <select_1.Select value={formData.emailType || 'transactional'} onValueChange={function (value) { return handleChange('emailType', value); }}>
                  <select_1.SelectTrigger className="h-8 text-sm">
                    <select_1.SelectValue />
                  </select_1.SelectTrigger>
                  <select_1.SelectContent>
                    <select_1.SelectItem value="transactional">Transactional</select_1.SelectItem>
                    <select_1.SelectItem value="marketing">Marketing</select_1.SelectItem>
                    <select_1.SelectItem value="notification">Notification</select_1.SelectItem>
                  </select_1.SelectContent>
                </select_1.Select>
              </div>

              <div>
                <label_1.Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Category / Trigger Type</label_1.Label>
                <select_1.Select value={formData.category} onValueChange={function (value) { return handleChange('category', value); }}>
                  <select_1.SelectTrigger className="h-8 text-sm">
                    <select_1.SelectValue />
                  </select_1.SelectTrigger>
                  <select_1.SelectContent>
                    <select_1.SelectItem value="confirmation">Confirmation</select_1.SelectItem>
                    <select_1.SelectItem value="cancellation">Cancellation</select_1.SelectItem>
                    <select_1.SelectItem value="reminder">Reminder</select_1.SelectItem>
                    <select_1.SelectItem value="marketing">Marketing</select_1.SelectItem>
                    <select_1.SelectItem value="manual">Manual Only</select_1.SelectItem>
                    <select_1.SelectItem value="other">Other</select_1.SelectItem>
                  </select_1.SelectContent>
                </select_1.Select>
              </div>
            </div>

            {/* Subject & Preview */}
            <div className="bg-white border rounded-lg p-4 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-slate-600 uppercase border-b pb-2">Subject & Preview</h3>
              
              <div>
                <label_1.Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Subject Line</label_1.Label>
                <input_1.Input value={formData.subject} onChange={function (e) { return handleChange('subject', e.target.value); }} className="h-8 text-sm" placeholder="e.g., Your reservation is confirmed!"/>
              </div>

              <div>
                <label_1.Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Preview Text</label_1.Label>
                <input_1.Input value={formData.preheaderText} onChange={function (e) { return handleChange('preheaderText', e.target.value); }} className="h-8 text-sm" placeholder="Brief snippet seen in inbox..."/>
              </div>
            </div>
          </div>)}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (<div className="space-y-4 animate-in fade-in duration-200 h-full">
            {/* Merge Tags */}
            <div className="bg-white border rounded-lg p-4 shadow-sm flex flex-col h-full overflow-hidden">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-slate-600 uppercase">Merge Tags</h3>
                <button_1.Button size="sm" variant="ghost" className="h-6 text-xs">
                  <icons_1.Icons.HelpCircle className="h-3 w-3 mr-1"/> Guide
                </button_1.Button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1">
                {MERGE_TAGS.map(function (group) { return (<div key={group.category}>
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">{group.category}</p>
                    <div className="space-y-1 ml-2">
                      {group.tags.map(function (item) { return (<button key={item.tag} onClick={function () { return insertMergeTag(item.tag); }} className="w-full flex justify-between items-center p-2 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all text-left group">
                          <code className="text-xs font-semibold text-blue-600">{item.tag}</code>
                          <span className="text-xs text-slate-500 group-hover:text-blue-600">{item.label}</span>
                        </button>); })}
                    </div>
                  </div>); })}
              </div>
            </div>
          </div>)}

        {/* ADVANCED TAB */}
        {activeTab === 'advanced' && (<div className="space-y-4 animate-in fade-in duration-200">
            {/* Auto-Fill Button */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <button_1.Button onClick={autoFillSignature} disabled={!currentProperty} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold h-9 text-sm">
                <icons_1.Icons.RefreshCw className="h-4 w-4 mr-2"/>
                Auto-Fill from Property Settings
              </button_1.Button>
              <p className="text-xs text-slate-600 mt-2">Automatically fills name, property name, phone, email, address, website, and logo from your property settings.</p>
            </div>

            {/* Logo Upload */}
            <div className="bg-white border rounded-lg p-4 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-slate-600 uppercase border-b pb-2">Email Signature</h3>
              
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-3">Logo / Brand Image</label>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:bg-slate-50 hover:border-slate-300 cursor-pointer transition-all">
                      <icons_1.Icons.UploadCloud className="h-6 w-6 text-slate-400 mx-auto mb-2"/>
                      <p className="text-xs font-bold text-slate-600 uppercase">Click to Upload Logo</p>
                      <p className="text-xs text-slate-500 mt-1">PNG, JPG (Max 200x100px recommended)</p>
                    </div>
                  </div>
                  
                  {/* Logo Thumbnail Preview */}
                  {formData.signatureLogo && (<div className="w-24 h-24 flex-shrink-0">
                      <div className="relative w-full h-full border border-slate-300 rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center">
                        <img src={formData.signatureLogo} alt="Logo" className="max-w-full max-h-full object-contain p-1"/>
                        <button onClick={function () { return handleChange('signatureLogo', ''); }} className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded transition-colors" title="Remove logo">
                          <icons_1.Icons.X className="h-3 w-3"/>
                        </button>
                      </div>
                    </div>)}
                </div>
              </div>
            </div>

            {/* Signature Contact Information */}
            <div className="bg-white border rounded-lg p-4 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-slate-600 uppercase border-b pb-2">Contact Information</h3>
              
              <div>
                <label_1.Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Full Name *</label_1.Label>
                <input_1.Input value={formData.signatureName} onChange={function (e) { return handleChange('signatureName', e.target.value); }} className="h-8 text-sm" placeholder="e.g., John Smith"/>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label_1.Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Property Name</label_1.Label>
                  <input_1.Input value={formData.signaturePropertyName} onChange={function (e) { return handleChange('signaturePropertyName', e.target.value); }} className="h-8 text-sm" placeholder="e.g., Riad Al Medina"/>
                </div>

                <div>
                  <label_1.Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Phone</label_1.Label>
                  <input_1.Input value={formData.signaturePhone} onChange={function (e) { return handleChange('signaturePhone', e.target.value); }} className="h-8 text-sm" placeholder="e.g., +1 (555) 123-4567"/>
                </div>
              </div>

              <div>
                <label_1.Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Email Address</label_1.Label>
                {availableEmails.length > 0 ? (<select_1.Select value={formData.signatureEmail} onValueChange={function (value) { return handleChange('signatureEmail', value); }}>
                    <select_1.SelectTrigger className="h-8 text-sm">
                      <select_1.SelectValue />
                    </select_1.SelectTrigger>
                    <select_1.SelectContent>
                      {availableEmails.map(function (emailOption, idx) { return (<select_1.SelectItem key={idx} value={emailOption.email}>
                          {emailOption.email} ({emailOption.type})
                        </select_1.SelectItem>); })}
                    </select_1.SelectContent>
                  </select_1.Select>) : (<input_1.Input type="email" value={formData.signatureEmail} onChange={function (e) { return handleChange('signatureEmail', e.target.value); }} className="h-8 text-sm" placeholder="e.g., contact@property.com"/>)}
              </div>

              <div>
                <label_1.Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Property Address</label_1.Label>
                <div className="flex gap-2">
                  <input_1.Input value={formData.signatureAddress} onChange={function (e) { return handleChange('signatureAddress', e.target.value); }} className="h-8 text-sm flex-1" placeholder="e.g., 123 Main St, 12345, City"/>
                  {((_b = propertyData === null || propertyData === void 0 ? void 0 : propertyData.infos) === null || _b === void 0 ? void 0 : _b.googleMapsLink) && (<a href={propertyData.infos.googleMapsLink} target="_blank" rel="noopener noreferrer" className="px-3 h-8 flex items-center bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded text-blue-600 text-xs font-bold transition-all" title="Open in Google Maps">
                      <icons_1.Icons.MapPin className="h-4 w-4"/>
                    </a>)}
                </div>
              </div>

              <div>
                <label_1.Label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Website</label_1.Label>
                <input_1.Input type="url" value={formData.signatureWebsite} onChange={function (e) { return handleChange('signatureWebsite', e.target.value); }} className="h-8 text-sm" placeholder="e.g., www.yourproperty.com"/>
              </div>
            </div>

            {/* Social Media Links */}
            <div className="bg-white border rounded-lg p-4 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-slate-600 uppercase border-b pb-2">Social Media Links</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label_1.Label className="text-xs font-bold text-slate-600 uppercase mb-2 block flex items-center gap-1">
                    <icons_1.Icons.Facebook className="h-3 w-3"/> Facebook
                  </label_1.Label>
                  <input_1.Input value={((_c = formData.signatureSocialMedia) === null || _c === void 0 ? void 0 : _c.facebook) || ''} onChange={function (e) { return handleChange('signatureSocialMedia', __assign(__assign({}, formData.signatureSocialMedia), { facebook: e.target.value })); }} className="h-8 text-sm" placeholder="facebook.com/yourpage"/>
                </div>

                <div>
                  <label_1.Label className="text-xs font-bold text-slate-600 uppercase mb-2 block flex items-center gap-1">
                    <icons_1.Icons.Instagram className="h-3 w-3"/> Instagram
                  </label_1.Label>
                  <input_1.Input value={((_d = formData.signatureSocialMedia) === null || _d === void 0 ? void 0 : _d.instagram) || ''} onChange={function (e) { return handleChange('signatureSocialMedia', __assign(__assign({}, formData.signatureSocialMedia), { instagram: e.target.value })); }} className="h-8 text-sm" placeholder="instagram.com/yourpage"/>
                </div>

                <div>
                  <label_1.Label className="text-xs font-bold text-slate-600 uppercase mb-2 block flex items-center gap-1">
                    <icons_1.Icons.Twitter className="h-3 w-3"/> Twitter
                  </label_1.Label>
                  <input_1.Input value={((_e = formData.signatureSocialMedia) === null || _e === void 0 ? void 0 : _e.twitter) || ''} onChange={function (e) { return handleChange('signatureSocialMedia', __assign(__assign({}, formData.signatureSocialMedia), { twitter: e.target.value })); }} className="h-8 text-sm" placeholder="twitter.com/yourpage"/>
                </div>

                <div>
                  <label_1.Label className="text-xs font-bold text-slate-600 uppercase mb-2 block flex items-center gap-1">
                    <icons_1.Icons.Linkedin className="h-3 w-3"/> LinkedIn
                  </label_1.Label>
                  <input_1.Input value={((_f = formData.signatureSocialMedia) === null || _f === void 0 ? void 0 : _f.linkedin) || ''} onChange={function (e) { return handleChange('signatureSocialMedia', __assign(__assign({}, formData.signatureSocialMedia), { linkedin: e.target.value })); }} className="h-8 text-sm" placeholder="linkedin.com/company/yourpage"/>
                </div>

                <div className="col-span-2">
                  <label_1.Label className="text-xs font-bold text-slate-600 uppercase mb-2 block flex items-center gap-1">
                    <icons_1.Icons.Star className="h-3 w-3"/> TripAdvisor
                  </label_1.Label>
                  <input_1.Input value={((_g = formData.signatureSocialMedia) === null || _g === void 0 ? void 0 : _g.tripadvisor) || ''} onChange={function (e) { return handleChange('signatureSocialMedia', __assign(__assign({}, formData.signatureSocialMedia), { tripadvisor: e.target.value })); }} className="h-8 text-sm" placeholder="tripadvisor.com/hotel/yourpage"/>
                </div>
              </div>
            </div>

            {/* Attachments */}
            <div className="bg-white border rounded-lg p-4 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-slate-600 uppercase border-b pb-2">Attachments & Options</h3>
              
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-3">Additional Attachments</label>
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:bg-slate-50 hover:border-slate-300 cursor-pointer transition-all">
                  <icons_1.Icons.Paperclip className="h-6 w-6 text-slate-400 mx-auto mb-2"/>
                  <p className="text-xs font-bold text-slate-600 uppercase">Click to Upload PDF / DOCX</p>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600"/>
                  <span className="text-sm font-semibold text-slate-700">Include Unsubscribe Link</span>
                </label>
                <p className="text-xs text-slate-500 italic ml-7">Mandatory for Marketing categories.</p>
              </div>
            </div>
          </div>)}
        </div>
      </div>

      {/* Right Side: Preview Panel */}
      <div className="lg:col-span-2 bg-slate-50 rounded-lg border flex flex-col overflow-hidden shadow-inner h-full">
        
        {/* Editor Mode Controls */}
        <div className="bg-white border-b px-6 py-3 flex justify-between items-center">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            <button onClick={function () {
            if (richEditorRef.current && editorMode === 'rich') {
                setHtmlContent(richEditorRef.current.innerHTML);
            }
            setEditorMode('visual');
        }} className={"flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all ".concat(editorMode === 'visual' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              <icons_1.Icons.Layout className="w-3.5 h-3.5"/> Visual
            </button>
            <button onClick={function () {
            if (richEditorRef.current && (editorMode === 'visual' || editorMode === 'code')) {
                setHtmlContent(richEditorRef.current.innerHTML);
            }
            setEditorMode('rich');
        }} className={"flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all ".concat(editorMode === 'rich' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              <icons_1.Icons.Type className="w-3.5 h-3.5"/> Rich Text
            </button>
            <button onClick={function () {
            if (richEditorRef.current && editorMode === 'rich') {
                setHtmlContent(richEditorRef.current.innerHTML);
            }
            setEditorMode('code');
        }} className={"flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all ".concat(editorMode === 'code' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              <icons_1.Icons.Code className="w-3.5 h-3.5"/> HTML
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="h-4 w-px bg-slate-200"/>
            <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
              <button onClick={function () { return setPreviewMode('desktop'); }} className={"p-1.5 rounded-md transition-all ".concat(previewMode === 'desktop' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600')} title="Desktop Preview">
                <icons_1.Icons.Monitor className="w-4 h-4"/>
              </button>
              <button onClick={function () { return setPreviewMode('mobile'); }} className={"p-1.5 rounded-md transition-all ".concat(previewMode === 'mobile' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600')} title="Mobile Preview">
                <icons_1.Icons.Smartphone className="w-4 h-4"/>
              </button>
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 overflow-y-auto px-4 py-8">
          {editorMode === 'visual' && (<div className="flex gap-6 max-w-6xl mx-auto">
              {/* Visual Editor Toolbox */}
              <div className="w-10 space-y-2">
                <button onClick={addTextBlock} className="w-full p-3 bg-white border rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-200 cursor-pointer shadow-sm flex flex-col items-center gap-1 transition-all" title="Add Text Block">
                  <icons_1.Icons.Type className="w-5 h-5"/>
                </button>
                <button onClick={addImageBlock} className="w-full p-3 bg-white border rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-200 cursor-pointer shadow-sm flex flex-col items-center gap-1 transition-all" title="Add Image Block">
                  <icons_1.Icons.ImageIcon className="w-5 h-5"/>
                </button>
                <button onClick={addButtonBlock} className="w-full p-3 bg-white border rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-200 cursor-pointer shadow-sm flex flex-col items-center gap-1 transition-all" title="Add Button Block">
                  <icons_1.Icons.MousePointer2 className="w-5 h-5"/>
                </button>
                <button onClick={addDividerBlock} className="w-full p-3 bg-white border rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-200 cursor-pointer shadow-sm flex flex-col items-center gap-1 transition-all" title="Add Divider">
                  <icons_1.Icons.Minus className="w-5 h-5"/>
                </button>
                <button onClick={addSpacerBlock} className="w-full p-3 bg-white border rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-200 cursor-pointer shadow-sm flex flex-col items-center gap-1 transition-all" title="Add Spacer">
                  <icons_1.Icons.Maximize2 className="w-5 h-5"/>
                </button>
              </div>

              {/* Email Canvas */}
              <div className={"flex-1 transition-all duration-500 bg-white shadow-2xl rounded-xl overflow-hidden mx-auto ".concat(previewMode === 'mobile' ? 'max-w-[360px]' : 'max-w-[800px]')}>
                {/* Visual Content Preview */}
                {blocks.length > 0 ? (<div className="px-6 py-10 text-sm leading-relaxed">
                    {blocks.map(function (block) { return (<div key={block.id} draggable onDragStart={function () { return handleDragStart(block.id); }} onDragOver={handleDragOver} onDrop={function () { return handleDrop(block.id); }} className={"cursor-move transition-all border-2 group ".concat(selectedBlockId === block.id ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:border-blue-200', " ").concat(draggedBlockId === block.id ? 'opacity-50' : '')} onClick={function () {
                        setSelectedBlockId(block.id);
                        setShowBlockEditor(true);
                    }} style={{
                        marginTop: "".concat(block.marginTop, "px"),
                        marginBottom: "".concat(block.marginBottom, "px"),
                        display: (previewMode === 'mobile' && block.hideOnMobile) || (previewMode === 'desktop' && block.hideOnDesktop) ? 'none' : 'block',
                    }}>
                        {block.type === 'text' && (<div style={{
                            fontSize: "".concat(block.fontSize, "px"),
                            color: block.color,
                            fontFamily: block.fontFamily,
                            fontWeight: block.fontWeight,
                            textAlign: block.alignment,
                            padding: "".concat(block.padding, "px"),
                        }}>
                            {block.content}
                          </div>)}
                        {block.type === 'image' && (<div style={{ textAlign: block.alignment, padding: "".concat(block.padding, "px") }}>
                            {block.src ? (<img src={block.src} alt={block.altText} style={{
                                width: "".concat(block.width, "px"),
                                height: "".concat(block.height, "px"),
                                borderRadius: "".concat(block.borderRadius, "px"),
                                display: 'inline-block',
                            }}/>) : (<div style={{
                                width: "".concat(block.width, "px"),
                                height: "".concat(block.height, "px"),
                                backgroundColor: '#f3f4f6',
                                borderRadius: "".concat(block.borderRadius, "px"),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#9ca3af',
                                fontSize: '12px',
                                fontWeight: 'bold',
                            }}>
                                Add Image URL
                              </div>)}
                          </div>)}
                        {block.type === 'button' && (<div style={{ textAlign: block.alignment, padding: "".concat(block.padding, "px") }}>
                            <button style={{
                            backgroundColor: block.backgroundColor,
                            color: block.textColor,
                            padding: "".concat(block.padding, "px ").concat(block.padding * 2, "px"),
                            borderRadius: "".concat(block.borderRadius, "px"),
                            fontSize: "".concat(block.fontSize, "px"),
                            width: "".concat(block.width, "px"),
                            border: block.buttonStyle === 'outline' ? "2px solid ".concat(block.backgroundColor) : 'none',
                            backgroundColor: block.buttonStyle === 'outline' ? 'transparent' : block.backgroundColor,
                            color: block.buttonStyle === 'outline' ? block.backgroundColor : block.textColor,
                            cursor: 'pointer',
                        }}>
                              {block.text}
                            </button>
                          </div>)}
                        {block.type === 'divider' && (<div style={{
                            width: "".concat(block.width, "%"),
                            height: "".concat(block.height, "px"),
                            backgroundColor: block.color,
                            margin: "".concat(block.marginTop, "px auto ").concat(block.marginBottom, "px"),
                        }}/>)}
                        {block.type === 'spacer' && (<div style={{
                            height: "".concat(block.height, "px"),
                        }}/>)}
                        <div className="flex justify-between items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                          <span className="text-xs text-slate-400">
                            {previewMode === 'mobile' && block.hideOnMobile ? 'Mobile: Hidden' : previewMode === 'desktop' && block.hideOnDesktop ? 'Desktop: Hidden' : 'Visible'}
                          </span>
                          <button className="text-xs text-red-500 hover:text-red-700" onClick={function (e) {
                        e.stopPropagation();
                        deleteBlock(block.id);
                    }}>
                            Delete
                          </button>
                        </div>
                      </div>); })}
                  </div>) : htmlContent ? (<div className="px-6 py-10 text-sm leading-relaxed" dir="ltr" dangerouslySetInnerHTML={{ __html: htmlContent + generateSignatureHtml() }}/>) : (<div className="px-6 py-10 text-center relative group min-h-[200px] border-b border-transparent hover:border-blue-200 cursor-text">
                    <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/5 transition-colors"/>
                    <div className="w-16 h-16 bg-slate-200 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-black">?</div>
                    <h1 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Start Editing</h1>
                    <p className="text-slate-600 leading-relaxed mb-8">
                      Your email content will appear here. Use the text editor or HTML mode to compose your message.
                    </p>
                  </div>)}
              </div>

              {/* Block Editor Panel */}
              {showBlockEditor && selectedBlockId && getSelectedBlock() && (<div className="w-80 bg-white border border-slate-200 p-6 overflow-y-auto max-h-screen rounded-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold uppercase text-xs text-slate-600">Block Settings</h3>
                    <button onClick={function () { return setShowBlockEditor(false); }} className="text-slate-500 hover:text-slate-700">✕</button>
                  </div>

                  {((_h = getSelectedBlock()) === null || _h === void 0 ? void 0 : _h.type) === 'text' && (<div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-2">Content</label>
                        <textarea value={getSelectedBlock().content} onChange={function (e) { return updateBlock(selectedBlockId, { content: e.target.value }); }} className="w-full p-2 border rounded text-sm h-24"/>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-2">Font Size (px)</label>
                        <input type="number" value={getSelectedBlock().fontSize} onChange={function (e) { return updateBlock(selectedBlockId, { fontSize: parseInt(e.target.value) }); }} className="w-full p-2 border rounded text-sm"/>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-2">Font Color</label>
                        <input type="color" value={getSelectedBlock().color} onChange={function (e) { return updateBlock(selectedBlockId, { color: e.target.value }); }} className="w-full p-2 border rounded h-10"/>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-2">Font Family</label>
                        <select value={getSelectedBlock().fontFamily} onChange={function (e) { return updateBlock(selectedBlockId, { fontFamily: e.target.value }); }} className="w-full p-2 border rounded text-sm">
                          <option>Arial, sans-serif</option>
                          <option>Georgia, serif</option>
                          <option>Courier, monospace</option>
                          <option>Verdana, sans-serif</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-2">Font Weight</label>
                        <select value={getSelectedBlock().fontWeight} onChange={function (e) { return updateBlock(selectedBlockId, { fontWeight: e.target.value }); }} className="w-full p-2 border rounded text-sm">
                          <option value="normal">Normal</option>
                          <option value="bold">Bold</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-2">Alignment</label>
                        <select value={getSelectedBlock().alignment} onChange={function (e) { return updateBlock(selectedBlockId, { alignment: e.target.value }); }} className="w-full p-2 border rounded text-sm">
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-2">Padding (px)</label>
                        <input type="number" value={getSelectedBlock().padding} onChange={function (e) { return updateBlock(selectedBlockId, { padding: parseInt(e.target.value) }); }} className="w-full p-2 border rounded text-sm"/>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-bold text-slate-600 block mb-2">Margin Top (px)</label>
                          <input type="number" value={getSelectedBlock().marginTop} onChange={function (e) { return updateBlock(selectedBlockId, { marginTop: parseInt(e.target.value) }); }} className="w-full p-2 border rounded text-sm"/>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-600 block mb-2">Margin Bottom (px)</label>
                          <input type="number" value={getSelectedBlock().marginBottom} onChange={function (e) { return updateBlock(selectedBlockId, { marginBottom: parseInt(e.target.value) }); }} className="w-full p-2 border rounded text-sm"/>
                        </div>
                      </div>
                    </div>)}

                  {((_j = getSelectedBlock()) === null || _j === void 0 ? void 0 : _j.type) === 'image' && (<div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-2">Image URL</label>
                        <input type="text" value={getSelectedBlock().src} onChange={function (e) { return updateBlock(selectedBlockId, { src: e.target.value }); }} className="w-full p-2 border rounded text-sm" placeholder="https://..."/>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-2">Or Upload Image</label>
                        <label className="w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg p-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                          <icons_1.Icons.UploadCloud className="w-5 h-5 text-slate-500 mb-1"/>
                          <span className="text-xs text-slate-600 font-medium">Click to upload or drag and drop</span>
                          <span className="text-xs text-slate-500">PNG, JPG, GIF up to 5MB</span>
                          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden"/>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-bold text-slate-600 block mb-2">Width (px)</label>
                          <input type="number" value={getSelectedBlock().width} onChange={function (e) { return updateBlock(selectedBlockId, { width: parseInt(e.target.value) }); }} className="w-full p-2 border rounded text-sm"/>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-600 block mb-2">Height (px)</label>
                          <input type="number" value={getSelectedBlock().height} onChange={function (e) { return updateBlock(selectedBlockId, { height: parseInt(e.target.value) }); }} className="w-full p-2 border rounded text-sm"/>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-2">Alt Text</label>
                        <input type="text" value={getSelectedBlock().altText} onChange={function (e) { return updateBlock(selectedBlockId, { altText: e.target.value }); }} className="w-full p-2 border rounded text-sm"/>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-2">Alignment</label>
                        <select value={getSelectedBlock().alignment} onChange={function (e) { return updateBlock(selectedBlockId, { alignment: e.target.value }); }} className="w-full p-2 border rounded text-sm">
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-2">Border Radius (px)</label>
                        <input type="number" value={getSelectedBlock().borderRadius} onChange={function (e) { return updateBlock(selectedBlockId, { borderRadius: parseInt(e.target.value) }); }} className="w-full p-2 border rounded text-sm"/>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-2">Padding (px)</label>
                        <input type="number" value={getSelectedBlock().padding} onChange={function (e) { return updateBlock(selectedBlockId, { padding: parseInt(e.target.value) }); }} className="w-full p-2 border rounded text-sm"/>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-bold text-slate-600 block mb-2">Margin Top (px)</label>
                          <input type="number" value={getSelectedBlock().marginTop} onChange={function (e) { return updateBlock(selectedBlockId, { marginTop: parseInt(e.target.value) }); }} className="w-full p-2 border rounded text-sm"/>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-600 block mb-2">Margin Bottom (px)</label>
                          <input type="number" value={getSelectedBlock().marginBottom} onChange={function (e) { return updateBlock(selectedBlockId, { marginBottom: parseInt(e.target.value) }); }} className="w-full p-2 border rounded text-sm"/>
                        </div>
                      </div>
                    </div>)}

                  {((_k = getSelectedBlock()) === null || _k === void 0 ? void 0 : _k.type) === 'button' && (<div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-2">Button Text</label>
                        <input type="text" value={getSelectedBlock().text} onChange={function (e) { return updateBlock(selectedBlockId, { text: e.target.value }); }} className="w-full p-2 border rounded text-sm"/>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-2">Button URL</label>
                        <input type="text" value={getSelectedBlock().url} onChange={function (e) { return updateBlock(selectedBlockId, { url: e.target.value }); }} className="w-full p-2 border rounded text-sm" placeholder="https://..."/>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-bold text-slate-600 block mb-2">Background Color</label>
                          <input type="color" value={getSelectedBlock().backgroundColor} onChange={function (e) { return updateBlock(selectedBlockId, { backgroundColor: e.target.value }); }} className="w-full p-2 border rounded h-10"/>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-600 block mb-2">Text Color</label>
                          <input type="color" value={getSelectedBlock().textColor} onChange={function (e) { return updateBlock(selectedBlockId, { textColor: e.target.value }); }} className="w-full p-2 border rounded h-10"/>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-2">Font Size (px)</label>
                        <input type="number" value={getSelectedBlock().fontSize} onChange={function (e) { return updateBlock(selectedBlockId, { fontSize: parseInt(e.target.value) }); }} className="w-full p-2 border rounded text-sm"/>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-2">Padding (px)</label>
                        <input type="number" value={getSelectedBlock().padding} onChange={function (e) { return updateBlock(selectedBlockId, { padding: parseInt(e.target.value) }); }} className="w-full p-2 border rounded text-sm"/>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-2">Border Radius (px)</label>
                        <input type="number" value={getSelectedBlock().borderRadius} onChange={function (e) { return updateBlock(selectedBlockId, { borderRadius: parseInt(e.target.value) }); }} className="w-full p-2 border rounded text-sm"/>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-2">Button Width (px)</label>
                        <input type="number" value={getSelectedBlock().width} onChange={function (e) { return updateBlock(selectedBlockId, { width: parseInt(e.target.value) }); }} className="w-full p-2 border rounded text-sm"/>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-2">Alignment</label>
                        <select value={getSelectedBlock().alignment} onChange={function (e) { return updateBlock(selectedBlockId, { alignment: e.target.value }); }} className="w-full p-2 border rounded text-sm">
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-bold text-slate-600 block mb-2">Margin Top (px)</label>
                          <input type="number" value={getSelectedBlock().marginTop} onChange={function (e) { return updateBlock(selectedBlockId, { marginTop: parseInt(e.target.value) }); }} className="w-full p-2 border rounded text-sm"/>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-600 block mb-2">Margin Bottom (px)</label>
                          <input type="number" value={getSelectedBlock().marginBottom} onChange={function (e) { return updateBlock(selectedBlockId, { marginBottom: parseInt(e.target.value) }); }} className="w-full p-2 border rounded text-sm"/>
                        </div>
                      </div>
                    </div>)}

                  {((_l = getSelectedBlock()) === null || _l === void 0 ? void 0 : _l.type) === 'divider' && (<div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-2">Color</label>
                        <input type="color" value={getSelectedBlock().color} onChange={function (e) { return updateBlock(selectedBlockId, { color: e.target.value }); }} className="w-full p-2 border rounded h-10"/>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-2">Height (px)</label>
                        <input type="number" value={getSelectedBlock().height} onChange={function (e) { return updateBlock(selectedBlockId, { height: parseInt(e.target.value) }); }} className="w-full p-2 border rounded text-sm"/>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-2">Width (%)</label>
                        <input type="number" value={getSelectedBlock().width} onChange={function (e) { return updateBlock(selectedBlockId, { width: parseInt(e.target.value) }); }} className="w-full p-2 border rounded text-sm"/>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-bold text-slate-600 block mb-2">Margin Top (px)</label>
                          <input type="number" value={getSelectedBlock().marginTop} onChange={function (e) { return updateBlock(selectedBlockId, { marginTop: parseInt(e.target.value) }); }} className="w-full p-2 border rounded text-sm"/>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-600 block mb-2">Margin Bottom (px)</label>
                          <input type="number" value={getSelectedBlock().marginBottom} onChange={function (e) { return updateBlock(selectedBlockId, { marginBottom: parseInt(e.target.value) }); }} className="w-full p-2 border rounded text-sm"/>
                        </div>
                      </div>
                    </div>)}

                  {((_m = getSelectedBlock()) === null || _m === void 0 ? void 0 : _m.type) === 'spacer' && (<div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-2">Height (px)</label>
                        <input type="range" min="5" max="100" value={getSelectedBlock().height} onChange={function (e) { return updateBlock(selectedBlockId, { height: parseInt(e.target.value) }); }} className="w-full"/>
                        <span className="text-xs text-slate-500">{getSelectedBlock().height}px</span>
                      </div>
                    </div>)}

                  {/* Responsive Visibility Controls - Show for all block types */}
                  <div className="border-t border-slate-200 mt-6 pt-4">
                    <h4 className="text-xs font-bold text-slate-600 mb-3 uppercase tracking-wide">Responsive Visibility</h4>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={((_o = getSelectedBlock()) === null || _o === void 0 ? void 0 : _o.hideOnMobile) || false} onChange={function (e) { return updateBlock(selectedBlockId, { hideOnMobile: e.target.checked }); }} className="w-4 h-4 rounded border-slate-300"/>
                        <span className="text-sm text-slate-600">Hide on mobile</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={((_p = getSelectedBlock()) === null || _p === void 0 ? void 0 : _p.hideOnDesktop) || false} onChange={function (e) { return updateBlock(selectedBlockId, { hideOnDesktop: e.target.checked }); }} className="w-4 h-4 rounded border-slate-300"/>
                        <span className="text-sm text-slate-600">Hide on desktop</span>
                      </label>
                    </div>
                  </div>

                  {/* Button Style Options - Only for button blocks */}
                  {((_q = getSelectedBlock()) === null || _q === void 0 ? void 0 : _q.type) === 'button' && (<div className="border-t border-slate-200 mt-6 pt-4">
                      <h4 className="text-xs font-bold text-slate-600 mb-3 uppercase tracking-wide">Button Style</h4>
                      <div className="grid grid-cols-3 gap-2">
                        {['solid', 'outline', 'text'].map(function (style) { return (<button key={style} onClick={function () { return updateBlock(selectedBlockId, { buttonStyle: style }); }} className={"p-2 rounded text-xs font-semibold transition-all ".concat(getSelectedBlock().buttonStyle === style
                            ? 'ring-2 ring-blue-500 bg-blue-50'
                            : 'hover:bg-slate-100')}>
                            {style.charAt(0).toUpperCase() + style.slice(1)}
                          </button>); })}
                      </div>
                    </div>)}
                </div>)}
            </div>)}
          </div>
        </div>
      </div>);
});
exports.default = EmailTemplateFormComponent;
