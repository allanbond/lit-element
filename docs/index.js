/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const directives = new WeakMap();
const isDirective = (o) => {
    return typeof o === 'function' && directives.has(o);
};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * True if the custom elements polyfill is in use.
 */
const isCEPolyfill = window.customElements !== undefined &&
    window.customElements.polyfillWrapFlushCallback !==
        undefined;
/**
 * Removes nodes, starting from `start` (inclusive) to `end` (exclusive), from
 * `container`.
 */
const removeNodes = (container, start, end = null) => {
    while (start !== end) {
        const n = start.nextSibling;
        container.removeChild(start);
        start = n;
    }
};

/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * A sentinel value that signals that a value was handled by a directive and
 * should not be written to the DOM.
 */
const noChange = {};
/**
 * A sentinel value that signals a NodePart to fully clear its content.
 */
const nothing = {};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * An expression marker with embedded unique key to avoid collision with
 * possible text in templates.
 */
const marker = `{{lit-${String(Math.random()).slice(2)}}}`;
/**
 * An expression marker used text-positions, multi-binding attributes, and
 * attributes with markup-like text values.
 */
const nodeMarker = `<!--${marker}-->`;
const markerRegex = new RegExp(`${marker}|${nodeMarker}`);
/**
 * Suffix appended to all bound attribute names.
 */
const boundAttributeSuffix = '$lit$';
/**
 * An updateable Template that tracks the location of dynamic parts.
 */
class Template {
    constructor(result, element) {
        this.parts = [];
        this.element = element;
        const nodesToRemove = [];
        const stack = [];
        // Edge needs all 4 parameters present; IE11 needs 3rd parameter to be null
        const walker = document.createTreeWalker(element.content, 133 /* NodeFilter.SHOW_{ELEMENT|COMMENT|TEXT} */, null, false);
        // Keeps track of the last index associated with a part. We try to delete
        // unnecessary nodes, but we never want to associate two different parts
        // to the same index. They must have a constant node between.
        let lastPartIndex = 0;
        let index = -1;
        let partIndex = 0;
        const { strings, values: { length } } = result;
        while (partIndex < length) {
            const node = walker.nextNode();
            if (node === null) {
                // We've exhausted the content inside a nested template element.
                // Because we still have parts (the outer for-loop), we know:
                // - There is a template in the stack
                // - The walker will find a nextNode outside the template
                walker.currentNode = stack.pop();
                continue;
            }
            index++;
            if (node.nodeType === 1 /* Node.ELEMENT_NODE */) {
                if (node.hasAttributes()) {
                    const attributes = node.attributes;
                    const { length } = attributes;
                    // Per
                    // https://developer.mozilla.org/en-US/docs/Web/API/NamedNodeMap,
                    // attributes are not guaranteed to be returned in document order.
                    // In particular, Edge/IE can return them out of order, so we cannot
                    // assume a correspondence between part index and attribute index.
                    let count = 0;
                    for (let i = 0; i < length; i++) {
                        if (endsWith(attributes[i].name, boundAttributeSuffix)) {
                            count++;
                        }
                    }
                    while (count-- > 0) {
                        // Get the template literal section leading up to the first
                        // expression in this attribute
                        const stringForPart = strings[partIndex];
                        // Find the attribute name
                        const name = lastAttributeNameRegex.exec(stringForPart)[2];
                        // Find the corresponding attribute
                        // All bound attributes have had a suffix added in
                        // TemplateResult#getHTML to opt out of special attribute
                        // handling. To look up the attribute value we also need to add
                        // the suffix.
                        const attributeLookupName = name.toLowerCase() + boundAttributeSuffix;
                        const attributeValue = node.getAttribute(attributeLookupName);
                        node.removeAttribute(attributeLookupName);
                        const statics = attributeValue.split(markerRegex);
                        this.parts.push({ type: 'attribute', index, name, strings: statics });
                        partIndex += statics.length - 1;
                    }
                }
                if (node.tagName === 'TEMPLATE') {
                    stack.push(node);
                    walker.currentNode = node.content;
                }
            }
            else if (node.nodeType === 3 /* Node.TEXT_NODE */) {
                const data = node.data;
                if (data.indexOf(marker) >= 0) {
                    const parent = node.parentNode;
                    const strings = data.split(markerRegex);
                    const lastIndex = strings.length - 1;
                    // Generate a new text node for each literal section
                    // These nodes are also used as the markers for node parts
                    for (let i = 0; i < lastIndex; i++) {
                        let insert;
                        let s = strings[i];
                        if (s === '') {
                            insert = createMarker();
                        }
                        else {
                            const match = lastAttributeNameRegex.exec(s);
                            if (match !== null && endsWith(match[2], boundAttributeSuffix)) {
                                s = s.slice(0, match.index) + match[1] +
                                    match[2].slice(0, -boundAttributeSuffix.length) + match[3];
                            }
                            insert = document.createTextNode(s);
                        }
                        parent.insertBefore(insert, node);
                        this.parts.push({ type: 'node', index: ++index });
                    }
                    // If there's no text, we must insert a comment to mark our place.
                    // Else, we can trust it will stick around after cloning.
                    if (strings[lastIndex] === '') {
                        parent.insertBefore(createMarker(), node);
                        nodesToRemove.push(node);
                    }
                    else {
                        node.data = strings[lastIndex];
                    }
                    // We have a part for each match found
                    partIndex += lastIndex;
                }
            }
            else if (node.nodeType === 8 /* Node.COMMENT_NODE */) {
                if (node.data === marker) {
                    const parent = node.parentNode;
                    // Add a new marker node to be the startNode of the Part if any of
                    // the following are true:
                    //  * We don't have a previousSibling
                    //  * The previousSibling is already the start of a previous part
                    if (node.previousSibling === null || index === lastPartIndex) {
                        index++;
                        parent.insertBefore(createMarker(), node);
                    }
                    lastPartIndex = index;
                    this.parts.push({ type: 'node', index });
                    // If we don't have a nextSibling, keep this node so we have an end.
                    // Else, we can remove it to save future costs.
                    if (node.nextSibling === null) {
                        node.data = '';
                    }
                    else {
                        nodesToRemove.push(node);
                        index--;
                    }
                    partIndex++;
                }
                else {
                    let i = -1;
                    while ((i = node.data.indexOf(marker, i + 1)) !== -1) {
                        // Comment node has a binding marker inside, make an inactive part
                        // The binding won't work, but subsequent bindings will
                        // TODO (justinfagnani): consider whether it's even worth it to
                        // make bindings in comments work
                        this.parts.push({ type: 'node', index: -1 });
                        partIndex++;
                    }
                }
            }
        }
        // Remove text binding nodes after the walk to not disturb the TreeWalker
        for (const n of nodesToRemove) {
            n.parentNode.removeChild(n);
        }
    }
}
const endsWith = (str, suffix) => {
    const index = str.length - suffix.length;
    return index >= 0 && str.slice(index) === suffix;
};
const isTemplatePartActive = (part) => part.index !== -1;
// Allows `document.createComment('')` to be renamed for a
// small manual size-savings.
const createMarker = () => document.createComment('');
/**
 * This regex extracts the attribute name preceding an attribute-position
 * expression. It does this by matching the syntax allowed for attributes
 * against the string literal directly preceding the expression, assuming that
 * the expression is in an attribute-value position.
 *
 * See attributes in the HTML spec:
 * https://www.w3.org/TR/html5/syntax.html#elements-attributes
 *
 * " \x09\x0a\x0c\x0d" are HTML space characters:
 * https://www.w3.org/TR/html5/infrastructure.html#space-characters
 *
 * "\0-\x1F\x7F-\x9F" are Unicode control characters, which includes every
 * space character except " ".
 *
 * So an attribute is:
 *  * The name: any character except a control character, space character, ('),
 *    ("), ">", "=", or "/"
 *  * Followed by zero or more space characters
 *  * Followed by "="
 *  * Followed by zero or more space characters
 *  * Followed by:
 *    * Any character except space, ('), ("), "<", ">", "=", (`), or
 *    * (") then any non-("), or
 *    * (') then any non-(')
 */
const lastAttributeNameRegex = /([ \x09\x0a\x0c\x0d])([^\0-\x1F\x7F-\x9F "'>=/]+)([ \x09\x0a\x0c\x0d]*=[ \x09\x0a\x0c\x0d]*(?:[^ \x09\x0a\x0c\x0d"'`<>=]*|"[^"]*|'[^']*))$/;

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * An instance of a `Template` that can be attached to the DOM and updated
 * with new values.
 */
class TemplateInstance {
    constructor(template, processor, options) {
        this.__parts = [];
        this.template = template;
        this.processor = processor;
        this.options = options;
    }
    update(values) {
        let i = 0;
        for (const part of this.__parts) {
            if (part !== undefined) {
                part.setValue(values[i]);
            }
            i++;
        }
        for (const part of this.__parts) {
            if (part !== undefined) {
                part.commit();
            }
        }
    }
    _clone() {
        // There are a number of steps in the lifecycle of a template instance's
        // DOM fragment:
        //  1. Clone - create the instance fragment
        //  2. Adopt - adopt into the main document
        //  3. Process - find part markers and create parts
        //  4. Upgrade - upgrade custom elements
        //  5. Update - set node, attribute, property, etc., values
        //  6. Connect - connect to the document. Optional and outside of this
        //     method.
        //
        // We have a few constraints on the ordering of these steps:
        //  * We need to upgrade before updating, so that property values will pass
        //    through any property setters.
        //  * We would like to process before upgrading so that we're sure that the
        //    cloned fragment is inert and not disturbed by self-modifying DOM.
        //  * We want custom elements to upgrade even in disconnected fragments.
        //
        // Given these constraints, with full custom elements support we would
        // prefer the order: Clone, Process, Adopt, Upgrade, Update, Connect
        //
        // But Safari dooes not implement CustomElementRegistry#upgrade, so we
        // can not implement that order and still have upgrade-before-update and
        // upgrade disconnected fragments. So we instead sacrifice the
        // process-before-upgrade constraint, since in Custom Elements v1 elements
        // must not modify their light DOM in the constructor. We still have issues
        // when co-existing with CEv0 elements like Polymer 1, and with polyfills
        // that don't strictly adhere to the no-modification rule because shadow
        // DOM, which may be created in the constructor, is emulated by being placed
        // in the light DOM.
        //
        // The resulting order is on native is: Clone, Adopt, Upgrade, Process,
        // Update, Connect. document.importNode() performs Clone, Adopt, and Upgrade
        // in one step.
        //
        // The Custom Elements v1 polyfill supports upgrade(), so the order when
        // polyfilled is the more ideal: Clone, Process, Adopt, Upgrade, Update,
        // Connect.
        const fragment = isCEPolyfill ?
            this.template.element.content.cloneNode(true) :
            document.importNode(this.template.element.content, true);
        const stack = [];
        const parts = this.template.parts;
        // Edge needs all 4 parameters present; IE11 needs 3rd parameter to be null
        const walker = document.createTreeWalker(fragment, 133 /* NodeFilter.SHOW_{ELEMENT|COMMENT|TEXT} */, null, false);
        let partIndex = 0;
        let nodeIndex = 0;
        let part;
        let node = walker.nextNode();
        // Loop through all the nodes and parts of a template
        while (partIndex < parts.length) {
            part = parts[partIndex];
            if (!isTemplatePartActive(part)) {
                this.__parts.push(undefined);
                partIndex++;
                continue;
            }
            // Progress the tree walker until we find our next part's node.
            // Note that multiple parts may share the same node (attribute parts
            // on a single element), so this loop may not run at all.
            while (nodeIndex < part.index) {
                nodeIndex++;
                if (node.nodeName === 'TEMPLATE') {
                    stack.push(node);
                    walker.currentNode = node.content;
                }
                if ((node = walker.nextNode()) === null) {
                    // We've exhausted the content inside a nested template element.
                    // Because we still have parts (the outer for-loop), we know:
                    // - There is a template in the stack
                    // - The walker will find a nextNode outside the template
                    walker.currentNode = stack.pop();
                    node = walker.nextNode();
                }
            }
            // We've arrived at our part's node.
            if (part.type === 'node') {
                const part = this.processor.handleTextExpression(this.options);
                part.insertAfterNode(node.previousSibling);
                this.__parts.push(part);
            }
            else {
                this.__parts.push(...this.processor.handleAttributeExpressions(node, part.name, part.strings, this.options));
            }
            partIndex++;
        }
        if (isCEPolyfill) {
            document.adoptNode(fragment);
            customElements.upgrade(fragment);
        }
        return fragment;
    }
}

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const commentMarker = ` ${marker} `;
/**
 * The return type of `html`, which holds a Template and the values from
 * interpolated expressions.
 */
class TemplateResult {
    constructor(strings, values, type, processor) {
        this.strings = strings;
        this.values = values;
        this.type = type;
        this.processor = processor;
    }
    /**
     * Returns a string of HTML used to create a `<template>` element.
     */
    getHTML() {
        const l = this.strings.length - 1;
        let html = '';
        let isCommentBinding = false;
        for (let i = 0; i < l; i++) {
            const s = this.strings[i];
            // For each binding we want to determine the kind of marker to insert
            // into the template source before it's parsed by the browser's HTML
            // parser. The marker type is based on whether the expression is in an
            // attribute, text, or comment poisition.
            //   * For node-position bindings we insert a comment with the marker
            //     sentinel as its text content, like <!--{{lit-guid}}-->.
            //   * For attribute bindings we insert just the marker sentinel for the
            //     first binding, so that we support unquoted attribute bindings.
            //     Subsequent bindings can use a comment marker because multi-binding
            //     attributes must be quoted.
            //   * For comment bindings we insert just the marker sentinel so we don't
            //     close the comment.
            //
            // The following code scans the template source, but is *not* an HTML
            // parser. We don't need to track the tree structure of the HTML, only
            // whether a binding is inside a comment, and if not, if it appears to be
            // the first binding in an attribute.
            const commentOpen = s.lastIndexOf('<!--');
            // We're in comment position if we have a comment open with no following
            // comment close. Because <-- can appear in an attribute value there can
            // be false positives.
            isCommentBinding = (commentOpen > -1 || isCommentBinding) &&
                s.indexOf('-->', commentOpen + 1) === -1;
            // Check to see if we have an attribute-like sequence preceeding the
            // expression. This can match "name=value" like structures in text,
            // comments, and attribute values, so there can be false-positives.
            const attributeMatch = lastAttributeNameRegex.exec(s);
            if (attributeMatch === null) {
                // We're only in this branch if we don't have a attribute-like
                // preceeding sequence. For comments, this guards against unusual
                // attribute values like <div foo="<!--${'bar'}">. Cases like
                // <!-- foo=${'bar'}--> are handled correctly in the attribute branch
                // below.
                html += s + (isCommentBinding ? commentMarker : nodeMarker);
            }
            else {
                // For attributes we use just a marker sentinel, and also append a
                // $lit$ suffix to the name to opt-out of attribute-specific parsing
                // that IE and Edge do for style and certain SVG attributes.
                html += s.substr(0, attributeMatch.index) + attributeMatch[1] +
                    attributeMatch[2] + boundAttributeSuffix + attributeMatch[3] +
                    marker;
            }
        }
        html += this.strings[l];
        return html;
    }
    getTemplateElement() {
        const template = document.createElement('template');
        template.innerHTML = this.getHTML();
        return template;
    }
}

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const isPrimitive = (value) => {
    return (value === null ||
        !(typeof value === 'object' || typeof value === 'function'));
};
const isIterable = (value) => {
    return Array.isArray(value) ||
        // tslint:disable-next-line:no-any
        !!(value && value[Symbol.iterator]);
};
/**
 * Writes attribute values to the DOM for a group of AttributeParts bound to a
 * single attibute. The value is only set once even if there are multiple parts
 * for an attribute.
 */
class AttributeCommitter {
    constructor(element, name, strings) {
        this.dirty = true;
        this.element = element;
        this.name = name;
        this.strings = strings;
        this.parts = [];
        for (let i = 0; i < strings.length - 1; i++) {
            this.parts[i] = this._createPart();
        }
    }
    /**
     * Creates a single part. Override this to create a differnt type of part.
     */
    _createPart() {
        return new AttributePart(this);
    }
    _getValue() {
        const strings = this.strings;
        const l = strings.length - 1;
        let text = '';
        for (let i = 0; i < l; i++) {
            text += strings[i];
            const part = this.parts[i];
            if (part !== undefined) {
                const v = part.value;
                if (isPrimitive(v) || !isIterable(v)) {
                    text += typeof v === 'string' ? v : String(v);
                }
                else {
                    for (const t of v) {
                        text += typeof t === 'string' ? t : String(t);
                    }
                }
            }
        }
        text += strings[l];
        return text;
    }
    commit() {
        if (this.dirty) {
            this.dirty = false;
            this.element.setAttribute(this.name, this._getValue());
        }
    }
}
/**
 * A Part that controls all or part of an attribute value.
 */
class AttributePart {
    constructor(committer) {
        this.value = undefined;
        this.committer = committer;
    }
    setValue(value) {
        if (value !== noChange && (!isPrimitive(value) || value !== this.value)) {
            this.value = value;
            // If the value is a not a directive, dirty the committer so that it'll
            // call setAttribute. If the value is a directive, it'll dirty the
            // committer if it calls setValue().
            if (!isDirective(value)) {
                this.committer.dirty = true;
            }
        }
    }
    commit() {
        while (isDirective(this.value)) {
            const directive = this.value;
            this.value = noChange;
            directive(this);
        }
        if (this.value === noChange) {
            return;
        }
        this.committer.commit();
    }
}
/**
 * A Part that controls a location within a Node tree. Like a Range, NodePart
 * has start and end locations and can set and update the Nodes between those
 * locations.
 *
 * NodeParts support several value types: primitives, Nodes, TemplateResults,
 * as well as arrays and iterables of those types.
 */
class NodePart {
    constructor(options) {
        this.value = undefined;
        this.__pendingValue = undefined;
        this.options = options;
    }
    /**
     * Appends this part into a container.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    appendInto(container) {
        this.startNode = container.appendChild(createMarker());
        this.endNode = container.appendChild(createMarker());
    }
    /**
     * Inserts this part after the `ref` node (between `ref` and `ref`'s next
     * sibling). Both `ref` and its next sibling must be static, unchanging nodes
     * such as those that appear in a literal section of a template.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    insertAfterNode(ref) {
        this.startNode = ref;
        this.endNode = ref.nextSibling;
    }
    /**
     * Appends this part into a parent part.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    appendIntoPart(part) {
        part.__insert(this.startNode = createMarker());
        part.__insert(this.endNode = createMarker());
    }
    /**
     * Inserts this part after the `ref` part.
     *
     * This part must be empty, as its contents are not automatically moved.
     */
    insertAfterPart(ref) {
        ref.__insert(this.startNode = createMarker());
        this.endNode = ref.endNode;
        ref.endNode = this.startNode;
    }
    setValue(value) {
        this.__pendingValue = value;
    }
    commit() {
        while (isDirective(this.__pendingValue)) {
            const directive = this.__pendingValue;
            this.__pendingValue = noChange;
            directive(this);
        }
        const value = this.__pendingValue;
        if (value === noChange) {
            return;
        }
        if (isPrimitive(value)) {
            if (value !== this.value) {
                this.__commitText(value);
            }
        }
        else if (value instanceof TemplateResult) {
            this.__commitTemplateResult(value);
        }
        else if (value instanceof Node) {
            this.__commitNode(value);
        }
        else if (isIterable(value)) {
            this.__commitIterable(value);
        }
        else if (value === nothing) {
            this.value = nothing;
            this.clear();
        }
        else {
            // Fallback, will render the string representation
            this.__commitText(value);
        }
    }
    __insert(node) {
        this.endNode.parentNode.insertBefore(node, this.endNode);
    }
    __commitNode(value) {
        if (this.value === value) {
            return;
        }
        this.clear();
        this.__insert(value);
        this.value = value;
    }
    __commitText(value) {
        const node = this.startNode.nextSibling;
        value = value == null ? '' : value;
        // If `value` isn't already a string, we explicitly convert it here in case
        // it can't be implicitly converted - i.e. it's a symbol.
        const valueAsString = typeof value === 'string' ? value : String(value);
        if (node === this.endNode.previousSibling &&
            node.nodeType === 3 /* Node.TEXT_NODE */) {
            // If we only have a single text node between the markers, we can just
            // set its value, rather than replacing it.
            // TODO(justinfagnani): Can we just check if this.value is primitive?
            node.data = valueAsString;
        }
        else {
            this.__commitNode(document.createTextNode(valueAsString));
        }
        this.value = value;
    }
    __commitTemplateResult(value) {
        const template = this.options.templateFactory(value);
        if (this.value instanceof TemplateInstance &&
            this.value.template === template) {
            this.value.update(value.values);
        }
        else {
            // Make sure we propagate the template processor from the TemplateResult
            // so that we use its syntax extension, etc. The template factory comes
            // from the render function options so that it can control template
            // caching and preprocessing.
            const instance = new TemplateInstance(template, value.processor, this.options);
            const fragment = instance._clone();
            instance.update(value.values);
            this.__commitNode(fragment);
            this.value = instance;
        }
    }
    __commitIterable(value) {
        // For an Iterable, we create a new InstancePart per item, then set its
        // value to the item. This is a little bit of overhead for every item in
        // an Iterable, but it lets us recurse easily and efficiently update Arrays
        // of TemplateResults that will be commonly returned from expressions like:
        // array.map((i) => html`${i}`), by reusing existing TemplateInstances.
        // If _value is an array, then the previous render was of an
        // iterable and _value will contain the NodeParts from the previous
        // render. If _value is not an array, clear this part and make a new
        // array for NodeParts.
        if (!Array.isArray(this.value)) {
            this.value = [];
            this.clear();
        }
        // Lets us keep track of how many items we stamped so we can clear leftover
        // items from a previous render
        const itemParts = this.value;
        let partIndex = 0;
        let itemPart;
        for (const item of value) {
            // Try to reuse an existing part
            itemPart = itemParts[partIndex];
            // If no existing part, create a new one
            if (itemPart === undefined) {
                itemPart = new NodePart(this.options);
                itemParts.push(itemPart);
                if (partIndex === 0) {
                    itemPart.appendIntoPart(this);
                }
                else {
                    itemPart.insertAfterPart(itemParts[partIndex - 1]);
                }
            }
            itemPart.setValue(item);
            itemPart.commit();
            partIndex++;
        }
        if (partIndex < itemParts.length) {
            // Truncate the parts array so _value reflects the current state
            itemParts.length = partIndex;
            this.clear(itemPart && itemPart.endNode);
        }
    }
    clear(startNode = this.startNode) {
        removeNodes(this.startNode.parentNode, startNode.nextSibling, this.endNode);
    }
}
/**
 * Implements a boolean attribute, roughly as defined in the HTML
 * specification.
 *
 * If the value is truthy, then the attribute is present with a value of
 * ''. If the value is falsey, the attribute is removed.
 */
class BooleanAttributePart {
    constructor(element, name, strings) {
        this.value = undefined;
        this.__pendingValue = undefined;
        if (strings.length !== 2 || strings[0] !== '' || strings[1] !== '') {
            throw new Error('Boolean attributes can only contain a single expression');
        }
        this.element = element;
        this.name = name;
        this.strings = strings;
    }
    setValue(value) {
        this.__pendingValue = value;
    }
    commit() {
        while (isDirective(this.__pendingValue)) {
            const directive = this.__pendingValue;
            this.__pendingValue = noChange;
            directive(this);
        }
        if (this.__pendingValue === noChange) {
            return;
        }
        const value = !!this.__pendingValue;
        if (this.value !== value) {
            if (value) {
                this.element.setAttribute(this.name, '');
            }
            else {
                this.element.removeAttribute(this.name);
            }
            this.value = value;
        }
        this.__pendingValue = noChange;
    }
}
/**
 * Sets attribute values for PropertyParts, so that the value is only set once
 * even if there are multiple parts for a property.
 *
 * If an expression controls the whole property value, then the value is simply
 * assigned to the property under control. If there are string literals or
 * multiple expressions, then the strings are expressions are interpolated into
 * a string first.
 */
class PropertyCommitter extends AttributeCommitter {
    constructor(element, name, strings) {
        super(element, name, strings);
        this.single =
            (strings.length === 2 && strings[0] === '' && strings[1] === '');
    }
    _createPart() {
        return new PropertyPart(this);
    }
    _getValue() {
        if (this.single) {
            return this.parts[0].value;
        }
        return super._getValue();
    }
    commit() {
        if (this.dirty) {
            this.dirty = false;
            // tslint:disable-next-line:no-any
            this.element[this.name] = this._getValue();
        }
    }
}
class PropertyPart extends AttributePart {
}
// Detect event listener options support. If the `capture` property is read
// from the options object, then options are supported. If not, then the thrid
// argument to add/removeEventListener is interpreted as the boolean capture
// value so we should only pass the `capture` property.
let eventOptionsSupported = false;
try {
    const options = {
        get capture() {
            eventOptionsSupported = true;
            return false;
        }
    };
    // tslint:disable-next-line:no-any
    window.addEventListener('test', options, options);
    // tslint:disable-next-line:no-any
    window.removeEventListener('test', options, options);
}
catch (_e) {
}
class EventPart {
    constructor(element, eventName, eventContext) {
        this.value = undefined;
        this.__pendingValue = undefined;
        this.element = element;
        this.eventName = eventName;
        this.eventContext = eventContext;
        this.__boundHandleEvent = (e) => this.handleEvent(e);
    }
    setValue(value) {
        this.__pendingValue = value;
    }
    commit() {
        while (isDirective(this.__pendingValue)) {
            const directive = this.__pendingValue;
            this.__pendingValue = noChange;
            directive(this);
        }
        if (this.__pendingValue === noChange) {
            return;
        }
        const newListener = this.__pendingValue;
        const oldListener = this.value;
        const shouldRemoveListener = newListener == null ||
            oldListener != null &&
                (newListener.capture !== oldListener.capture ||
                    newListener.once !== oldListener.once ||
                    newListener.passive !== oldListener.passive);
        const shouldAddListener = newListener != null && (oldListener == null || shouldRemoveListener);
        if (shouldRemoveListener) {
            this.element.removeEventListener(this.eventName, this.__boundHandleEvent, this.__options);
        }
        if (shouldAddListener) {
            this.__options = getOptions(newListener);
            this.element.addEventListener(this.eventName, this.__boundHandleEvent, this.__options);
        }
        this.value = newListener;
        this.__pendingValue = noChange;
    }
    handleEvent(event) {
        if (typeof this.value === 'function') {
            this.value.call(this.eventContext || this.element, event);
        }
        else {
            this.value.handleEvent(event);
        }
    }
}
// We copy options because of the inconsistent behavior of browsers when reading
// the third argument of add/removeEventListener. IE11 doesn't support options
// at all. Chrome 41 only reads `capture` if the argument is an object.
const getOptions = (o) => o &&
    (eventOptionsSupported ?
        { capture: o.capture, passive: o.passive, once: o.once } :
        o.capture);

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * Creates Parts when a template is instantiated.
 */
class DefaultTemplateProcessor {
    /**
     * Create parts for an attribute-position binding, given the event, attribute
     * name, and string literals.
     *
     * @param element The element containing the binding
     * @param name  The attribute name
     * @param strings The string literals. There are always at least two strings,
     *   event for fully-controlled bindings with a single expression.
     */
    handleAttributeExpressions(element, name, strings, options) {
        const prefix = name[0];
        if (prefix === '.') {
            const committer = new PropertyCommitter(element, name.slice(1), strings);
            return committer.parts;
        }
        if (prefix === '@') {
            return [new EventPart(element, name.slice(1), options.eventContext)];
        }
        if (prefix === '?') {
            return [new BooleanAttributePart(element, name.slice(1), strings)];
        }
        const committer = new AttributeCommitter(element, name, strings);
        return committer.parts;
    }
    /**
     * Create parts for a text-position binding.
     * @param templateFactory
     */
    handleTextExpression(options) {
        return new NodePart(options);
    }
}
const defaultTemplateProcessor = new DefaultTemplateProcessor();

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * The default TemplateFactory which caches Templates keyed on
 * result.type and result.strings.
 */
function templateFactory(result) {
    let templateCache = templateCaches.get(result.type);
    if (templateCache === undefined) {
        templateCache = {
            stringsArray: new WeakMap(),
            keyString: new Map()
        };
        templateCaches.set(result.type, templateCache);
    }
    let template = templateCache.stringsArray.get(result.strings);
    if (template !== undefined) {
        return template;
    }
    // If the TemplateStringsArray is new, generate a key from the strings
    // This key is shared between all templates with identical content
    const key = result.strings.join(marker);
    // Check if we already have a Template for this key
    template = templateCache.keyString.get(key);
    if (template === undefined) {
        // If we have not seen this key before, create a new Template
        template = new Template(result, result.getTemplateElement());
        // Cache the Template for this key
        templateCache.keyString.set(key, template);
    }
    // Cache all future queries for this TemplateStringsArray
    templateCache.stringsArray.set(result.strings, template);
    return template;
}
const templateCaches = new Map();

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const parts = new WeakMap();
/**
 * Renders a template result or other value to a container.
 *
 * To update a container with new values, reevaluate the template literal and
 * call `render` with the new result.
 *
 * @param result Any value renderable by NodePart - typically a TemplateResult
 *     created by evaluating a template tag like `html` or `svg`.
 * @param container A DOM parent to render to. The entire contents are either
 *     replaced, or efficiently updated if the same result type was previous
 *     rendered there.
 * @param options RenderOptions for the entire render tree rendered to this
 *     container. Render options must *not* change between renders to the same
 *     container, as those changes will not effect previously rendered DOM.
 */
const render = (result, container, options) => {
    let part = parts.get(container);
    if (part === undefined) {
        removeNodes(container, container.firstChild);
        parts.set(container, part = new NodePart(Object.assign({ templateFactory }, options)));
        part.appendInto(container);
    }
    part.setValue(result);
    part.commit();
};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
// IMPORTANT: do not change the property name or the assignment expression.
// This line will be used in regexes to search for lit-html usage.
// TODO(justinfagnani): inject version number at build time
(window['litHtmlVersions'] || (window['litHtmlVersions'] = [])).push('1.1.2');
/**
 * Interprets a template literal as an HTML template that can efficiently
 * render to and update a container.
 */
const html = (strings, ...values) => new TemplateResult(strings, values, 'html', defaultTemplateProcessor);

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
const walkerNodeFilter = 133 /* NodeFilter.SHOW_{ELEMENT|COMMENT|TEXT} */;
/**
 * Removes the list of nodes from a Template safely. In addition to removing
 * nodes from the Template, the Template part indices are updated to match
 * the mutated Template DOM.
 *
 * As the template is walked the removal state is tracked and
 * part indices are adjusted as needed.
 *
 * div
 *   div#1 (remove) <-- start removing (removing node is div#1)
 *     div
 *       div#2 (remove)  <-- continue removing (removing node is still div#1)
 *         div
 * div <-- stop removing since previous sibling is the removing node (div#1,
 * removed 4 nodes)
 */
function removeNodesFromTemplate(template, nodesToRemove) {
    const { element: { content }, parts } = template;
    const walker = document.createTreeWalker(content, walkerNodeFilter, null, false);
    let partIndex = nextActiveIndexInTemplateParts(parts);
    let part = parts[partIndex];
    let nodeIndex = -1;
    let removeCount = 0;
    const nodesToRemoveInTemplate = [];
    let currentRemovingNode = null;
    while (walker.nextNode()) {
        nodeIndex++;
        const node = walker.currentNode;
        // End removal if stepped past the removing node
        if (node.previousSibling === currentRemovingNode) {
            currentRemovingNode = null;
        }
        // A node to remove was found in the template
        if (nodesToRemove.has(node)) {
            nodesToRemoveInTemplate.push(node);
            // Track node we're removing
            if (currentRemovingNode === null) {
                currentRemovingNode = node;
            }
        }
        // When removing, increment count by which to adjust subsequent part indices
        if (currentRemovingNode !== null) {
            removeCount++;
        }
        while (part !== undefined && part.index === nodeIndex) {
            // If part is in a removed node deactivate it by setting index to -1 or
            // adjust the index as needed.
            part.index = currentRemovingNode !== null ? -1 : part.index - removeCount;
            // go to the next active part.
            partIndex = nextActiveIndexInTemplateParts(parts, partIndex);
            part = parts[partIndex];
        }
    }
    nodesToRemoveInTemplate.forEach((n) => n.parentNode.removeChild(n));
}
const countNodes = (node) => {
    let count = (node.nodeType === 11 /* Node.DOCUMENT_FRAGMENT_NODE */) ? 0 : 1;
    const walker = document.createTreeWalker(node, walkerNodeFilter, null, false);
    while (walker.nextNode()) {
        count++;
    }
    return count;
};
const nextActiveIndexInTemplateParts = (parts, startIndex = -1) => {
    for (let i = startIndex + 1; i < parts.length; i++) {
        const part = parts[i];
        if (isTemplatePartActive(part)) {
            return i;
        }
    }
    return -1;
};
/**
 * Inserts the given node into the Template, optionally before the given
 * refNode. In addition to inserting the node into the Template, the Template
 * part indices are updated to match the mutated Template DOM.
 */
function insertNodeIntoTemplate(template, node, refNode = null) {
    const { element: { content }, parts } = template;
    // If there's no refNode, then put node at end of template.
    // No part indices need to be shifted in this case.
    if (refNode === null || refNode === undefined) {
        content.appendChild(node);
        return;
    }
    const walker = document.createTreeWalker(content, walkerNodeFilter, null, false);
    let partIndex = nextActiveIndexInTemplateParts(parts);
    let insertCount = 0;
    let walkerIndex = -1;
    while (walker.nextNode()) {
        walkerIndex++;
        const walkerNode = walker.currentNode;
        if (walkerNode === refNode) {
            insertCount = countNodes(node);
            refNode.parentNode.insertBefore(node, refNode);
        }
        while (partIndex !== -1 && parts[partIndex].index === walkerIndex) {
            // If we've inserted the node, simply adjust all subsequent parts
            if (insertCount > 0) {
                while (partIndex !== -1) {
                    parts[partIndex].index += insertCount;
                    partIndex = nextActiveIndexInTemplateParts(parts, partIndex);
                }
                return;
            }
            partIndex = nextActiveIndexInTemplateParts(parts, partIndex);
        }
    }
}

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
// Get a key to lookup in `templateCaches`.
const getTemplateCacheKey = (type, scopeName) => `${type}--${scopeName}`;
let compatibleShadyCSSVersion = true;
if (typeof window.ShadyCSS === 'undefined') {
    compatibleShadyCSSVersion = false;
}
else if (typeof window.ShadyCSS.prepareTemplateDom === 'undefined') {
    console.warn(`Incompatible ShadyCSS version detected. ` +
        `Please update to at least @webcomponents/webcomponentsjs@2.0.2 and ` +
        `@webcomponents/shadycss@1.3.1.`);
    compatibleShadyCSSVersion = false;
}
/**
 * Template factory which scopes template DOM using ShadyCSS.
 * @param scopeName {string}
 */
const shadyTemplateFactory = (scopeName) => (result) => {
    const cacheKey = getTemplateCacheKey(result.type, scopeName);
    let templateCache = templateCaches.get(cacheKey);
    if (templateCache === undefined) {
        templateCache = {
            stringsArray: new WeakMap(),
            keyString: new Map()
        };
        templateCaches.set(cacheKey, templateCache);
    }
    let template = templateCache.stringsArray.get(result.strings);
    if (template !== undefined) {
        return template;
    }
    const key = result.strings.join(marker);
    template = templateCache.keyString.get(key);
    if (template === undefined) {
        const element = result.getTemplateElement();
        if (compatibleShadyCSSVersion) {
            window.ShadyCSS.prepareTemplateDom(element, scopeName);
        }
        template = new Template(result, element);
        templateCache.keyString.set(key, template);
    }
    templateCache.stringsArray.set(result.strings, template);
    return template;
};
const TEMPLATE_TYPES = ['html', 'svg'];
/**
 * Removes all style elements from Templates for the given scopeName.
 */
const removeStylesFromLitTemplates = (scopeName) => {
    TEMPLATE_TYPES.forEach((type) => {
        const templates = templateCaches.get(getTemplateCacheKey(type, scopeName));
        if (templates !== undefined) {
            templates.keyString.forEach((template) => {
                const { element: { content } } = template;
                // IE 11 doesn't support the iterable param Set constructor
                const styles = new Set();
                Array.from(content.querySelectorAll('style')).forEach((s) => {
                    styles.add(s);
                });
                removeNodesFromTemplate(template, styles);
            });
        }
    });
};
const shadyRenderSet = new Set();
/**
 * For the given scope name, ensures that ShadyCSS style scoping is performed.
 * This is done just once per scope name so the fragment and template cannot
 * be modified.
 * (1) extracts styles from the rendered fragment and hands them to ShadyCSS
 * to be scoped and appended to the document
 * (2) removes style elements from all lit-html Templates for this scope name.
 *
 * Note, <style> elements can only be placed into templates for the
 * initial rendering of the scope. If <style> elements are included in templates
 * dynamically rendered to the scope (after the first scope render), they will
 * not be scoped and the <style> will be left in the template and rendered
 * output.
 */
const prepareTemplateStyles = (scopeName, renderedDOM, template) => {
    shadyRenderSet.add(scopeName);
    // If `renderedDOM` is stamped from a Template, then we need to edit that
    // Template's underlying template element. Otherwise, we create one here
    // to give to ShadyCSS, which still requires one while scoping.
    const templateElement = !!template ? template.element : document.createElement('template');
    // Move styles out of rendered DOM and store.
    const styles = renderedDOM.querySelectorAll('style');
    const { length } = styles;
    // If there are no styles, skip unnecessary work
    if (length === 0) {
        // Ensure prepareTemplateStyles is called to support adding
        // styles via `prepareAdoptedCssText` since that requires that
        // `prepareTemplateStyles` is called.
        //
        // ShadyCSS will only update styles containing @apply in the template
        // given to `prepareTemplateStyles`. If no lit Template was given,
        // ShadyCSS will not be able to update uses of @apply in any relevant
        // template. However, this is not a problem because we only create the
        // template for the purpose of supporting `prepareAdoptedCssText`,
        // which doesn't support @apply at all.
        window.ShadyCSS.prepareTemplateStyles(templateElement, scopeName);
        return;
    }
    const condensedStyle = document.createElement('style');
    // Collect styles into a single style. This helps us make sure ShadyCSS
    // manipulations will not prevent us from being able to fix up template
    // part indices.
    // NOTE: collecting styles is inefficient for browsers but ShadyCSS
    // currently does this anyway. When it does not, this should be changed.
    for (let i = 0; i < length; i++) {
        const style = styles[i];
        style.parentNode.removeChild(style);
        condensedStyle.textContent += style.textContent;
    }
    // Remove styles from nested templates in this scope.
    removeStylesFromLitTemplates(scopeName);
    // And then put the condensed style into the "root" template passed in as
    // `template`.
    const content = templateElement.content;
    if (!!template) {
        insertNodeIntoTemplate(template, condensedStyle, content.firstChild);
    }
    else {
        content.insertBefore(condensedStyle, content.firstChild);
    }
    // Note, it's important that ShadyCSS gets the template that `lit-html`
    // will actually render so that it can update the style inside when
    // needed (e.g. @apply native Shadow DOM case).
    window.ShadyCSS.prepareTemplateStyles(templateElement, scopeName);
    const style = content.querySelector('style');
    if (window.ShadyCSS.nativeShadow && style !== null) {
        // When in native Shadow DOM, ensure the style created by ShadyCSS is
        // included in initially rendered output (`renderedDOM`).
        renderedDOM.insertBefore(style.cloneNode(true), renderedDOM.firstChild);
    }
    else if (!!template) {
        // When no style is left in the template, parts will be broken as a
        // result. To fix this, we put back the style node ShadyCSS removed
        // and then tell lit to remove that node from the template.
        // There can be no style in the template in 2 cases (1) when Shady DOM
        // is in use, ShadyCSS removes all styles, (2) when native Shadow DOM
        // is in use ShadyCSS removes the style if it contains no content.
        // NOTE, ShadyCSS creates its own style so we can safely add/remove
        // `condensedStyle` here.
        content.insertBefore(condensedStyle, content.firstChild);
        const removes = new Set();
        removes.add(condensedStyle);
        removeNodesFromTemplate(template, removes);
    }
};
/**
 * Extension to the standard `render` method which supports rendering
 * to ShadowRoots when the ShadyDOM (https://github.com/webcomponents/shadydom)
 * and ShadyCSS (https://github.com/webcomponents/shadycss) polyfills are used
 * or when the webcomponentsjs
 * (https://github.com/webcomponents/webcomponentsjs) polyfill is used.
 *
 * Adds a `scopeName` option which is used to scope element DOM and stylesheets
 * when native ShadowDOM is unavailable. The `scopeName` will be added to
 * the class attribute of all rendered DOM. In addition, any style elements will
 * be automatically re-written with this `scopeName` selector and moved out
 * of the rendered DOM and into the document `<head>`.
 *
 * It is common to use this render method in conjunction with a custom element
 * which renders a shadowRoot. When this is done, typically the element's
 * `localName` should be used as the `scopeName`.
 *
 * In addition to DOM scoping, ShadyCSS also supports a basic shim for css
 * custom properties (needed only on older browsers like IE11) and a shim for
 * a deprecated feature called `@apply` that supports applying a set of css
 * custom properties to a given location.
 *
 * Usage considerations:
 *
 * * Part values in `<style>` elements are only applied the first time a given
 * `scopeName` renders. Subsequent changes to parts in style elements will have
 * no effect. Because of this, parts in style elements should only be used for
 * values that will never change, for example parts that set scope-wide theme
 * values or parts which render shared style elements.
 *
 * * Note, due to a limitation of the ShadyDOM polyfill, rendering in a
 * custom element's `constructor` is not supported. Instead rendering should
 * either done asynchronously, for example at microtask timing (for example
 * `Promise.resolve()`), or be deferred until the first time the element's
 * `connectedCallback` runs.
 *
 * Usage considerations when using shimmed custom properties or `@apply`:
 *
 * * Whenever any dynamic changes are made which affect
 * css custom properties, `ShadyCSS.styleElement(element)` must be called
 * to update the element. There are two cases when this is needed:
 * (1) the element is connected to a new parent, (2) a class is added to the
 * element that causes it to match different custom properties.
 * To address the first case when rendering a custom element, `styleElement`
 * should be called in the element's `connectedCallback`.
 *
 * * Shimmed custom properties may only be defined either for an entire
 * shadowRoot (for example, in a `:host` rule) or via a rule that directly
 * matches an element with a shadowRoot. In other words, instead of flowing from
 * parent to child as do native css custom properties, shimmed custom properties
 * flow only from shadowRoots to nested shadowRoots.
 *
 * * When using `@apply` mixing css shorthand property names with
 * non-shorthand names (for example `border` and `border-width`) is not
 * supported.
 */
const render$1 = (result, container, options) => {
    if (!options || typeof options !== 'object' || !options.scopeName) {
        throw new Error('The `scopeName` option is required.');
    }
    const scopeName = options.scopeName;
    const hasRendered = parts.has(container);
    const needsScoping = compatibleShadyCSSVersion &&
        container.nodeType === 11 /* Node.DOCUMENT_FRAGMENT_NODE */ &&
        !!container.host;
    // Handle first render to a scope specially...
    const firstScopeRender = needsScoping && !shadyRenderSet.has(scopeName);
    // On first scope render, render into a fragment; this cannot be a single
    // fragment that is reused since nested renders can occur synchronously.
    const renderContainer = firstScopeRender ? document.createDocumentFragment() : container;
    render(result, renderContainer, Object.assign({ templateFactory: shadyTemplateFactory(scopeName) }, options));
    // When performing first scope render,
    // (1) We've rendered into a fragment so that there's a chance to
    // `prepareTemplateStyles` before sub-elements hit the DOM
    // (which might cause them to render based on a common pattern of
    // rendering in a custom element's `connectedCallback`);
    // (2) Scope the template with ShadyCSS one time only for this scope.
    // (3) Render the fragment into the container and make sure the
    // container knows its `part` is the one we just rendered. This ensures
    // DOM will be re-used on subsequent renders.
    if (firstScopeRender) {
        const part = parts.get(renderContainer);
        parts.delete(renderContainer);
        // ShadyCSS might have style sheets (e.g. from `prepareAdoptedCssText`)
        // that should apply to `renderContainer` even if the rendered value is
        // not a TemplateInstance. However, it will only insert scoped styles
        // into the document if `prepareTemplateStyles` has already been called
        // for the given scope name.
        const template = part.value instanceof TemplateInstance ?
            part.value.template :
            undefined;
        prepareTemplateStyles(scopeName, renderContainer, template);
        removeNodes(container, container.firstChild);
        container.appendChild(renderContainer);
        parts.set(container, part);
    }
    // After elements have hit the DOM, update styling if this is the
    // initial render to this container.
    // This is needed whenever dynamic changes are made so it would be
    // safest to do every render; however, this would regress performance
    // so we leave it up to the user to call `ShadyCSS.styleElement`
    // for dynamic changes.
    if (!hasRendered && needsScoping) {
        window.ShadyCSS.styleElement(container.host);
    }
};

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
var _a;
/**
 * When using Closure Compiler, JSCompiler_renameProperty(property, object) is
 * replaced at compile time by the munged name for object[property]. We cannot
 * alias this function, so we have to use a small shim that has the same
 * behavior when not compiling.
 */
window.JSCompiler_renameProperty =
    (prop, _obj) => prop;
const defaultConverter = {
    toAttribute(value, type) {
        switch (type) {
            case Boolean:
                return value ? '' : null;
            case Object:
            case Array:
                // if the value is `null` or `undefined` pass this through
                // to allow removing/no change behavior.
                return value == null ? value : JSON.stringify(value);
        }
        return value;
    },
    fromAttribute(value, type) {
        switch (type) {
            case Boolean:
                return value !== null;
            case Number:
                return value === null ? null : Number(value);
            case Object:
            case Array:
                return JSON.parse(value);
        }
        return value;
    }
};
/**
 * Change function that returns true if `value` is different from `oldValue`.
 * This method is used as the default for a property's `hasChanged` function.
 */
const notEqual = (value, old) => {
    // This ensures (old==NaN, value==NaN) always returns false
    return old !== value && (old === old || value === value);
};
const defaultPropertyDeclaration = {
    attribute: true,
    type: String,
    converter: defaultConverter,
    reflect: false,
    hasChanged: notEqual
};
const microtaskPromise = Promise.resolve(true);
const STATE_HAS_UPDATED = 1;
const STATE_UPDATE_REQUESTED = 1 << 2;
const STATE_IS_REFLECTING_TO_ATTRIBUTE = 1 << 3;
const STATE_IS_REFLECTING_TO_PROPERTY = 1 << 4;
const STATE_HAS_CONNECTED = 1 << 5;
/**
 * The Closure JS Compiler doesn't currently have good support for static
 * property semantics where "this" is dynamic (e.g.
 * https://github.com/google/closure-compiler/issues/3177 and others) so we use
 * this hack to bypass any rewriting by the compiler.
 */
const finalized = 'finalized';
/**
 * Base element class which manages element properties and attributes. When
 * properties change, the `update` method is asynchronously called. This method
 * should be supplied by subclassers to render updates as desired.
 */
class UpdatingElement extends HTMLElement {
    constructor() {
        super();
        this._updateState = 0;
        this._instanceProperties = undefined;
        this._updatePromise = microtaskPromise;
        this._hasConnectedResolver = undefined;
        /**
         * Map with keys for any properties that have changed since the last
         * update cycle with previous values.
         */
        this._changedProperties = new Map();
        /**
         * Map with keys of properties that should be reflected when updated.
         */
        this._reflectingProperties = undefined;
        this.initialize();
    }
    /**
     * Returns a list of attributes corresponding to the registered properties.
     * @nocollapse
     */
    static get observedAttributes() {
        // note: piggy backing on this to ensure we're finalized.
        this.finalize();
        const attributes = [];
        // Use forEach so this works even if for/of loops are compiled to for loops
        // expecting arrays
        this._classProperties.forEach((v, p) => {
            const attr = this._attributeNameForProperty(p, v);
            if (attr !== undefined) {
                this._attributeToPropertyMap.set(attr, p);
                attributes.push(attr);
            }
        });
        return attributes;
    }
    /**
     * Ensures the private `_classProperties` property metadata is created.
     * In addition to `finalize` this is also called in `createProperty` to
     * ensure the `@property` decorator can add property metadata.
     */
    /** @nocollapse */
    static _ensureClassProperties() {
        // ensure private storage for property declarations.
        if (!this.hasOwnProperty(JSCompiler_renameProperty('_classProperties', this))) {
            this._classProperties = new Map();
            // NOTE: Workaround IE11 not supporting Map constructor argument.
            const superProperties = Object.getPrototypeOf(this)._classProperties;
            if (superProperties !== undefined) {
                superProperties.forEach((v, k) => this._classProperties.set(k, v));
            }
        }
    }
    /**
     * Creates a property accessor on the element prototype if one does not exist.
     * The property setter calls the property's `hasChanged` property option
     * or uses a strict identity check to determine whether or not to request
     * an update.
     * @nocollapse
     */
    static createProperty(name, options = defaultPropertyDeclaration) {
        // Note, since this can be called by the `@property` decorator which
        // is called before `finalize`, we ensure storage exists for property
        // metadata.
        this._ensureClassProperties();
        this._classProperties.set(name, options);
        // Do not generate an accessor if the prototype already has one, since
        // it would be lost otherwise and that would never be the user's intention;
        // Instead, we expect users to call `requestUpdate` themselves from
        // user-defined accessors. Note that if the super has an accessor we will
        // still overwrite it
        if (options.noAccessor || this.prototype.hasOwnProperty(name)) {
            return;
        }
        const key = typeof name === 'symbol' ? Symbol() : `__${name}`;
        Object.defineProperty(this.prototype, name, {
            // tslint:disable-next-line:no-any no symbol in index
            get() {
                return this[key];
            },
            set(value) {
                const oldValue = this[name];
                this[key] = value;
                this._requestUpdate(name, oldValue);
            },
            configurable: true,
            enumerable: true
        });
    }
    /**
     * Creates property accessors for registered properties and ensures
     * any superclasses are also finalized.
     * @nocollapse
     */
    static finalize() {
        // finalize any superclasses
        const superCtor = Object.getPrototypeOf(this);
        if (!superCtor.hasOwnProperty(finalized)) {
            superCtor.finalize();
        }
        this[finalized] = true;
        this._ensureClassProperties();
        // initialize Map populated in observedAttributes
        this._attributeToPropertyMap = new Map();
        // make any properties
        // Note, only process "own" properties since this element will inherit
        // any properties defined on the superClass, and finalization ensures
        // the entire prototype chain is finalized.
        if (this.hasOwnProperty(JSCompiler_renameProperty('properties', this))) {
            const props = this.properties;
            // support symbols in properties (IE11 does not support this)
            const propKeys = [
                ...Object.getOwnPropertyNames(props),
                ...(typeof Object.getOwnPropertySymbols === 'function') ?
                    Object.getOwnPropertySymbols(props) :
                    []
            ];
            // This for/of is ok because propKeys is an array
            for (const p of propKeys) {
                // note, use of `any` is due to TypeSript lack of support for symbol in
                // index types
                // tslint:disable-next-line:no-any no symbol in index
                this.createProperty(p, props[p]);
            }
        }
    }
    /**
     * Returns the property name for the given attribute `name`.
     * @nocollapse
     */
    static _attributeNameForProperty(name, options) {
        const attribute = options.attribute;
        return attribute === false ?
            undefined :
            (typeof attribute === 'string' ?
                attribute :
                (typeof name === 'string' ? name.toLowerCase() : undefined));
    }
    /**
     * Returns true if a property should request an update.
     * Called when a property value is set and uses the `hasChanged`
     * option for the property if present or a strict identity check.
     * @nocollapse
     */
    static _valueHasChanged(value, old, hasChanged = notEqual) {
        return hasChanged(value, old);
    }
    /**
     * Returns the property value for the given attribute value.
     * Called via the `attributeChangedCallback` and uses the property's
     * `converter` or `converter.fromAttribute` property option.
     * @nocollapse
     */
    static _propertyValueFromAttribute(value, options) {
        const type = options.type;
        const converter = options.converter || defaultConverter;
        const fromAttribute = (typeof converter === 'function' ? converter : converter.fromAttribute);
        return fromAttribute ? fromAttribute(value, type) : value;
    }
    /**
     * Returns the attribute value for the given property value. If this
     * returns undefined, the property will *not* be reflected to an attribute.
     * If this returns null, the attribute will be removed, otherwise the
     * attribute will be set to the value.
     * This uses the property's `reflect` and `type.toAttribute` property options.
     * @nocollapse
     */
    static _propertyValueToAttribute(value, options) {
        if (options.reflect === undefined) {
            return;
        }
        const type = options.type;
        const converter = options.converter;
        const toAttribute = converter && converter.toAttribute ||
            defaultConverter.toAttribute;
        return toAttribute(value, type);
    }
    /**
     * Performs element initialization. By default captures any pre-set values for
     * registered properties.
     */
    initialize() {
        this._saveInstanceProperties();
        // ensures first update will be caught by an early access of
        // `updateComplete`
        this._requestUpdate();
    }
    /**
     * Fixes any properties set on the instance before upgrade time.
     * Otherwise these would shadow the accessor and break these properties.
     * The properties are stored in a Map which is played back after the
     * constructor runs. Note, on very old versions of Safari (<=9) or Chrome
     * (<=41), properties created for native platform properties like (`id` or
     * `name`) may not have default values set in the element constructor. On
     * these browsers native properties appear on instances and therefore their
     * default value will overwrite any element default (e.g. if the element sets
     * this.id = 'id' in the constructor, the 'id' will become '' since this is
     * the native platform default).
     */
    _saveInstanceProperties() {
        // Use forEach so this works even if for/of loops are compiled to for loops
        // expecting arrays
        this.constructor
            ._classProperties.forEach((_v, p) => {
            if (this.hasOwnProperty(p)) {
                const value = this[p];
                delete this[p];
                if (!this._instanceProperties) {
                    this._instanceProperties = new Map();
                }
                this._instanceProperties.set(p, value);
            }
        });
    }
    /**
     * Applies previously saved instance properties.
     */
    _applyInstanceProperties() {
        // Use forEach so this works even if for/of loops are compiled to for loops
        // expecting arrays
        // tslint:disable-next-line:no-any
        this._instanceProperties.forEach((v, p) => this[p] = v);
        this._instanceProperties = undefined;
    }
    connectedCallback() {
        this._updateState = this._updateState | STATE_HAS_CONNECTED;
        // Ensure first connection completes an update. Updates cannot complete
        // before connection and if one is pending connection the
        // `_hasConnectionResolver` will exist. If so, resolve it to complete the
        // update, otherwise requestUpdate.
        if (this._hasConnectedResolver) {
            this._hasConnectedResolver();
            this._hasConnectedResolver = undefined;
        }
    }
    /**
     * Allows for `super.disconnectedCallback()` in extensions while
     * reserving the possibility of making non-breaking feature additions
     * when disconnecting at some point in the future.
     */
    disconnectedCallback() {
    }
    /**
     * Synchronizes property values when attributes change.
     */
    attributeChangedCallback(name, old, value) {
        if (old !== value) {
            this._attributeToProperty(name, value);
        }
    }
    _propertyToAttribute(name, value, options = defaultPropertyDeclaration) {
        const ctor = this.constructor;
        const attr = ctor._attributeNameForProperty(name, options);
        if (attr !== undefined) {
            const attrValue = ctor._propertyValueToAttribute(value, options);
            // an undefined value does not change the attribute.
            if (attrValue === undefined) {
                return;
            }
            // Track if the property is being reflected to avoid
            // setting the property again via `attributeChangedCallback`. Note:
            // 1. this takes advantage of the fact that the callback is synchronous.
            // 2. will behave incorrectly if multiple attributes are in the reaction
            // stack at time of calling. However, since we process attributes
            // in `update` this should not be possible (or an extreme corner case
            // that we'd like to discover).
            // mark state reflecting
            this._updateState = this._updateState | STATE_IS_REFLECTING_TO_ATTRIBUTE;
            if (attrValue == null) {
                this.removeAttribute(attr);
            }
            else {
                this.setAttribute(attr, attrValue);
            }
            // mark state not reflecting
            this._updateState = this._updateState & ~STATE_IS_REFLECTING_TO_ATTRIBUTE;
        }
    }
    _attributeToProperty(name, value) {
        // Use tracking info to avoid deserializing attribute value if it was
        // just set from a property setter.
        if (this._updateState & STATE_IS_REFLECTING_TO_ATTRIBUTE) {
            return;
        }
        const ctor = this.constructor;
        const propName = ctor._attributeToPropertyMap.get(name);
        if (propName !== undefined) {
            const options = ctor._classProperties.get(propName) || defaultPropertyDeclaration;
            // mark state reflecting
            this._updateState = this._updateState | STATE_IS_REFLECTING_TO_PROPERTY;
            this[propName] =
                // tslint:disable-next-line:no-any
                ctor._propertyValueFromAttribute(value, options);
            // mark state not reflecting
            this._updateState = this._updateState & ~STATE_IS_REFLECTING_TO_PROPERTY;
        }
    }
    /**
     * This private version of `requestUpdate` does not access or return the
     * `updateComplete` promise. This promise can be overridden and is therefore
     * not free to access.
     */
    _requestUpdate(name, oldValue) {
        let shouldRequestUpdate = true;
        // If we have a property key, perform property update steps.
        if (name !== undefined) {
            const ctor = this.constructor;
            const options = ctor._classProperties.get(name) || defaultPropertyDeclaration;
            if (ctor._valueHasChanged(this[name], oldValue, options.hasChanged)) {
                if (!this._changedProperties.has(name)) {
                    this._changedProperties.set(name, oldValue);
                }
                // Add to reflecting properties set.
                // Note, it's important that every change has a chance to add the
                // property to `_reflectingProperties`. This ensures setting
                // attribute + property reflects correctly.
                if (options.reflect === true &&
                    !(this._updateState & STATE_IS_REFLECTING_TO_PROPERTY)) {
                    if (this._reflectingProperties === undefined) {
                        this._reflectingProperties = new Map();
                    }
                    this._reflectingProperties.set(name, options);
                }
            }
            else {
                // Abort the request if the property should not be considered changed.
                shouldRequestUpdate = false;
            }
        }
        if (!this._hasRequestedUpdate && shouldRequestUpdate) {
            this._enqueueUpdate();
        }
    }
    /**
     * Requests an update which is processed asynchronously. This should
     * be called when an element should update based on some state not triggered
     * by setting a property. In this case, pass no arguments. It should also be
     * called when manually implementing a property setter. In this case, pass the
     * property `name` and `oldValue` to ensure that any configured property
     * options are honored. Returns the `updateComplete` Promise which is resolved
     * when the update completes.
     *
     * @param name {PropertyKey} (optional) name of requesting property
     * @param oldValue {any} (optional) old value of requesting property
     * @returns {Promise} A Promise that is resolved when the update completes.
     */
    requestUpdate(name, oldValue) {
        this._requestUpdate(name, oldValue);
        return this.updateComplete;
    }
    /**
     * Sets up the element to asynchronously update.
     */
    async _enqueueUpdate() {
        // Mark state updating...
        this._updateState = this._updateState | STATE_UPDATE_REQUESTED;
        let resolve;
        let reject;
        const previousUpdatePromise = this._updatePromise;
        this._updatePromise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        try {
            // Ensure any previous update has resolved before updating.
            // This `await` also ensures that property changes are batched.
            await previousUpdatePromise;
        }
        catch (e) {
            // Ignore any previous errors. We only care that the previous cycle is
            // done. Any error should have been handled in the previous update.
        }
        // Make sure the element has connected before updating.
        if (!this._hasConnected) {
            await new Promise((res) => this._hasConnectedResolver = res);
        }
        try {
            const result = this.performUpdate();
            // If `performUpdate` returns a Promise, we await it. This is done to
            // enable coordinating updates with a scheduler. Note, the result is
            // checked to avoid delaying an additional microtask unless we need to.
            if (result != null) {
                await result;
            }
        }
        catch (e) {
            reject(e);
        }
        resolve(!this._hasRequestedUpdate);
    }
    get _hasConnected() {
        return (this._updateState & STATE_HAS_CONNECTED);
    }
    get _hasRequestedUpdate() {
        return (this._updateState & STATE_UPDATE_REQUESTED);
    }
    get hasUpdated() {
        return (this._updateState & STATE_HAS_UPDATED);
    }
    /**
     * Performs an element update. Note, if an exception is thrown during the
     * update, `firstUpdated` and `updated` will not be called.
     *
     * You can override this method to change the timing of updates. If this
     * method is overridden, `super.performUpdate()` must be called.
     *
     * For instance, to schedule updates to occur just before the next frame:
     *
     * ```
     * protected async performUpdate(): Promise<unknown> {
     *   await new Promise((resolve) => requestAnimationFrame(() => resolve()));
     *   super.performUpdate();
     * }
     * ```
     */
    performUpdate() {
        // Mixin instance properties once, if they exist.
        if (this._instanceProperties) {
            this._applyInstanceProperties();
        }
        let shouldUpdate = false;
        const changedProperties = this._changedProperties;
        try {
            shouldUpdate = this.shouldUpdate(changedProperties);
            if (shouldUpdate) {
                this.update(changedProperties);
            }
        }
        catch (e) {
            // Prevent `firstUpdated` and `updated` from running when there's an
            // update exception.
            shouldUpdate = false;
            throw e;
        }
        finally {
            // Ensure element can accept additional updates after an exception.
            this._markUpdated();
        }
        if (shouldUpdate) {
            if (!(this._updateState & STATE_HAS_UPDATED)) {
                this._updateState = this._updateState | STATE_HAS_UPDATED;
                this.firstUpdated(changedProperties);
            }
            this.updated(changedProperties);
        }
    }
    _markUpdated() {
        this._changedProperties = new Map();
        this._updateState = this._updateState & ~STATE_UPDATE_REQUESTED;
    }
    /**
     * Returns a Promise that resolves when the element has completed updating.
     * The Promise value is a boolean that is `true` if the element completed the
     * update without triggering another update. The Promise result is `false` if
     * a property was set inside `updated()`. If the Promise is rejected, an
     * exception was thrown during the update.
     *
     * To await additional asynchronous work, override the `_getUpdateComplete`
     * method. For example, it is sometimes useful to await a rendered element
     * before fulfilling this Promise. To do this, first await
     * `super._getUpdateComplete()`, then any subsequent state.
     *
     * @returns {Promise} The Promise returns a boolean that indicates if the
     * update resolved without triggering another update.
     */
    get updateComplete() {
        return this._getUpdateComplete();
    }
    /**
     * Override point for the `updateComplete` promise.
     *
     * It is not safe to override the `updateComplete` getter directly due to a
     * limitation in TypeScript which means it is not possible to call a
     * superclass getter (e.g. `super.updateComplete.then(...)`) when the target
     * language is ES5 (https://github.com/microsoft/TypeScript/issues/338).
     * This method should be overridden instead. For example:
     *
     *   class MyElement extends LitElement {
     *     async _getUpdateComplete() {
     *       await super._getUpdateComplete();
     *       await this._myChild.updateComplete;
     *     }
     *   }
     */
    _getUpdateComplete() {
        return this._updatePromise;
    }
    /**
     * Controls whether or not `update` should be called when the element requests
     * an update. By default, this method always returns `true`, but this can be
     * customized to control when to update.
     *
     * * @param _changedProperties Map of changed properties with old values
     */
    shouldUpdate(_changedProperties) {
        return true;
    }
    /**
     * Updates the element. This method reflects property values to attributes.
     * It can be overridden to render and keep updated element DOM.
     * Setting properties inside this method will *not* trigger
     * another update.
     *
     * * @param _changedProperties Map of changed properties with old values
     */
    update(_changedProperties) {
        if (this._reflectingProperties !== undefined &&
            this._reflectingProperties.size > 0) {
            // Use forEach so this works even if for/of loops are compiled to for
            // loops expecting arrays
            this._reflectingProperties.forEach((v, k) => this._propertyToAttribute(k, this[k], v));
            this._reflectingProperties = undefined;
        }
    }
    /**
     * Invoked whenever the element is updated. Implement to perform
     * post-updating tasks via DOM APIs, for example, focusing an element.
     *
     * Setting properties inside this method will trigger the element to update
     * again after this update cycle completes.
     *
     * * @param _changedProperties Map of changed properties with old values
     */
    updated(_changedProperties) {
    }
    /**
     * Invoked when the element is first updated. Implement to perform one time
     * work on the element after update.
     *
     * Setting properties inside this method will trigger the element to update
     * again after this update cycle completes.
     *
     * * @param _changedProperties Map of changed properties with old values
     */
    firstUpdated(_changedProperties) {
    }
}
_a = finalized;
/**
 * Marks class as having finished creating properties.
 */
UpdatingElement[_a] = true;

/**
@license
Copyright (c) 2019 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at
http://polymer.github.io/LICENSE.txt The complete set of authors may be found at
http://polymer.github.io/AUTHORS.txt The complete set of contributors may be
found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by Google as
part of the polymer project is also subject to an additional IP rights grant
found at http://polymer.github.io/PATENTS.txt
*/
const supportsAdoptingStyleSheets = ('adoptedStyleSheets' in Document.prototype) &&
    ('replace' in CSSStyleSheet.prototype);

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
// IMPORTANT: do not change the property name or the assignment expression.
// This line will be used in regexes to search for LitElement usage.
// TODO(justinfagnani): inject version number at build time
(window['litElementVersions'] || (window['litElementVersions'] = []))
    .push('2.2.1');
/**
 * Minimal implementation of Array.prototype.flat
 * @param arr the array to flatten
 * @param result the accumlated result
 */
function arrayFlat(styles, result = []) {
    for (let i = 0, length = styles.length; i < length; i++) {
        const value = styles[i];
        if (Array.isArray(value)) {
            arrayFlat(value, result);
        }
        else {
            result.push(value);
        }
    }
    return result;
}
/** Deeply flattens styles array. Uses native flat if available. */
const flattenStyles = (styles) => styles.flat ? styles.flat(Infinity) : arrayFlat(styles);
class LitElement extends UpdatingElement {
    /** @nocollapse */
    static finalize() {
        // The Closure JS Compiler does not always preserve the correct "this"
        // when calling static super methods (b/137460243), so explicitly bind.
        super.finalize.call(this);
        // Prepare styling that is stamped at first render time. Styling
        // is built from user provided `styles` or is inherited from the superclass.
        this._styles =
            this.hasOwnProperty(JSCompiler_renameProperty('styles', this)) ?
                this._getUniqueStyles() :
                this._styles || [];
    }
    /** @nocollapse */
    static _getUniqueStyles() {
        // Take care not to call `this.styles` multiple times since this generates
        // new CSSResults each time.
        // TODO(sorvell): Since we do not cache CSSResults by input, any
        // shared styles will generate new stylesheet objects, which is wasteful.
        // This should be addressed when a browser ships constructable
        // stylesheets.
        const userStyles = this.styles;
        const styles = [];
        if (Array.isArray(userStyles)) {
            const flatStyles = flattenStyles(userStyles);
            // As a performance optimization to avoid duplicated styling that can
            // occur especially when composing via subclassing, de-duplicate styles
            // preserving the last item in the list. The last item is kept to
            // try to preserve cascade order with the assumption that it's most
            // important that last added styles override previous styles.
            const styleSet = flatStyles.reduceRight((set, s) => {
                set.add(s);
                // on IE set.add does not return the set.
                return set;
            }, new Set());
            // Array.from does not work on Set in IE
            styleSet.forEach((v) => styles.unshift(v));
        }
        else if (userStyles) {
            styles.push(userStyles);
        }
        return styles;
    }
    /**
     * Performs element initialization. By default this calls `createRenderRoot`
     * to create the element `renderRoot` node and captures any pre-set values for
     * registered properties.
     */
    initialize() {
        super.initialize();
        this.renderRoot =
            this.createRenderRoot();
        // Note, if renderRoot is not a shadowRoot, styles would/could apply to the
        // element's getRootNode(). While this could be done, we're choosing not to
        // support this now since it would require different logic around de-duping.
        if (window.ShadowRoot && this.renderRoot instanceof window.ShadowRoot) {
            this.adoptStyles();
        }
    }
    /**
     * Returns the node into which the element should render and by default
     * creates and returns an open shadowRoot. Implement to customize where the
     * element's DOM is rendered. For example, to render into the element's
     * childNodes, return `this`.
     * @returns {Element|DocumentFragment} Returns a node into which to render.
     */
    createRenderRoot() {
        return this.attachShadow({ mode: 'open' });
    }
    /**
     * Applies styling to the element shadowRoot using the `static get styles`
     * property. Styling will apply using `shadowRoot.adoptedStyleSheets` where
     * available and will fallback otherwise. When Shadow DOM is polyfilled,
     * ShadyCSS scopes styles and adds them to the document. When Shadow DOM
     * is available but `adoptedStyleSheets` is not, styles are appended to the
     * end of the `shadowRoot` to [mimic spec
     * behavior](https://wicg.github.io/construct-stylesheets/#using-constructed-stylesheets).
     */
    adoptStyles() {
        const styles = this.constructor._styles;
        if (styles.length === 0) {
            return;
        }
        // There are three separate cases here based on Shadow DOM support.
        // (1) shadowRoot polyfilled: use ShadyCSS
        // (2) shadowRoot.adoptedStyleSheets available: use it.
        // (3) shadowRoot.adoptedStyleSheets polyfilled: append styles after
        // rendering
        if (window.ShadyCSS !== undefined && !window.ShadyCSS.nativeShadow) {
            window.ShadyCSS.ScopingShim.prepareAdoptedCssText(styles.map((s) => s.cssText), this.localName);
        }
        else if (supportsAdoptingStyleSheets) {
            this.renderRoot.adoptedStyleSheets =
                styles.map((s) => s.styleSheet);
        }
        else {
            // This must be done after rendering so the actual style insertion is done
            // in `update`.
            this._needsShimAdoptedStyleSheets = true;
        }
    }
    connectedCallback() {
        super.connectedCallback();
        // Note, first update/render handles styleElement so we only call this if
        // connected after first update.
        if (this.hasUpdated && window.ShadyCSS !== undefined) {
            window.ShadyCSS.styleElement(this);
        }
    }
    /**
     * Updates the element. This method reflects property values to attributes
     * and calls `render` to render DOM via lit-html. Setting properties inside
     * this method will *not* trigger another update.
     * * @param _changedProperties Map of changed properties with old values
     */
    update(changedProperties) {
        super.update(changedProperties);
        const templateResult = this.render();
        if (templateResult instanceof TemplateResult) {
            this.constructor
                .render(templateResult, this.renderRoot, { scopeName: this.localName, eventContext: this });
        }
        // When native Shadow DOM is used but adoptedStyles are not supported,
        // insert styling after rendering to ensure adoptedStyles have highest
        // priority.
        if (this._needsShimAdoptedStyleSheets) {
            this._needsShimAdoptedStyleSheets = false;
            this.constructor._styles.forEach((s) => {
                const style = document.createElement('style');
                style.textContent = s.cssText;
                this.renderRoot.appendChild(style);
            });
        }
    }
    /**
     * Invoked on each update to perform rendering tasks. This method must return
     * a lit-html TemplateResult. Setting properties inside this method will *not*
     * trigger the element to update.
     */
    render() {
    }
}
/**
 * Ensure this class is marked as `finalized` as an optimization ensuring
 * it will not needlessly try to `finalize`.
 *
 * Note this property name is a string to prevent breaking Closure JS Compiler
 * optimizations. See updating-element.ts for more information.
 */
LitElement['finalized'] = true;
/**
 * Render method used to render the lit-html TemplateResult to the element's
 * DOM.
 * @param {TemplateResult} Template to render.
 * @param {Element|DocumentFragment} Node into which to render.
 * @param {String} Element name.
 * @nocollapse
 */
LitElement.render = render$1;

// import { customElements } from "@webcomponents/webcomponentsjs";
class MyButton extends LitElement {
    render() {
        return html `
      <link rel="stylesheet" href="./styles/styles.css" />
      <button class="text-white rounded bg-blue-500 p-2 m-2">
        <slot></slot>
      </button>
    `;
    }
}
customElements.define("my-button", MyButton);

// import { customElements } from "@webcomponents/webcomponentsjs";
class MyCard extends LitElement {
    render() {
        return html `
      <link rel="stylesheet" href="./styles/styles.css" />
      <p class="p-8 m-4 border border-gray-400 rounded text-blue-500">
        My Card
        <slot></slot>
      </p>
    `;
    }
}
customElements.define("my-card", MyCard);

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

/**
@license @nocompile
Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/
(function(){/*

 Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 Code distributed by Google as part of the polymer project is also
 subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/
var w;function ba(a){var b=0;return function(){return b<a.length?{done:!1,value:a[b++]}:{done:!0}}}function ca(a){var b="undefined"!=typeof Symbol&&Symbol.iterator&&a[Symbol.iterator];return b?b.call(a):{next:ba(a)}}function da(a){if(!(a instanceof Array)){a=ca(a);for(var b,c=[];!(b=a.next()).done;)c.push(b.value);a=c;}return a}
var ea="undefined"!=typeof window&&window===this?this:"undefined"!=typeof commonjsGlobal&&null!=commonjsGlobal?commonjsGlobal:this,ha="function"==typeof Object.defineProperties?Object.defineProperty:function(a,b,c){a!=Array.prototype&&a!=Object.prototype&&(a[b]=c.value);};function ia(){ia=function(){};ea.Symbol||(ea.Symbol=la);}function ma(a,b){this.a=a;ha(this,"description",{configurable:!0,writable:!0,value:b});}ma.prototype.toString=function(){return this.a};
var la=function(){function a(c){if(this instanceof a)throw new TypeError("Symbol is not a constructor");return new ma("jscomp_symbol_"+(c||"")+"_"+b++,c)}var b=0;return a}();function na(){ia();var a=ea.Symbol.iterator;a||(a=ea.Symbol.iterator=ea.Symbol("Symbol.iterator"));"function"!=typeof Array.prototype[a]&&ha(Array.prototype,a,{configurable:!0,writable:!0,value:function(){return ra(ba(this))}});na=function(){};}
function ra(a){na();a={next:a};a[ea.Symbol.iterator]=function(){return this};return a}var sa;if("function"==typeof Object.setPrototypeOf)sa=Object.setPrototypeOf;else{var ua;a:{var va={Ga:!0},wa={};try{wa.__proto__=va;ua=wa.Ga;break a}catch(a){}ua=!1;}sa=ua?function(a,b){a.__proto__=b;if(a.__proto__!==b)throw new TypeError(a+" is not extensible");return a}:null;}var xa=sa;function ya(){this.f=!1;this.b=null;this.U=void 0;this.a=1;this.D=0;this.c=null;}
function za(a){if(a.f)throw new TypeError("Generator is already running");a.f=!0;}ya.prototype.u=function(a){this.U=a;};function Aa(a,b){a.c={Ja:b,Na:!0};a.a=a.D;}ya.prototype.return=function(a){this.c={return:a};this.a=this.D;};function Ba(a,b){a.a=3;return {value:b}}function Ca(a){this.a=new ya;this.b=a;}function Da(a,b){za(a.a);var c=a.a.b;if(c)return Ea(a,"return"in c?c["return"]:function(d){return {value:d,done:!0}},b,a.a.return);a.a.return(b);return Fa(a)}
function Ea(a,b,c,d){try{var e=b.call(a.a.b,c);if(!(e instanceof Object))throw new TypeError("Iterator result "+e+" is not an object");if(!e.done)return a.a.f=!1,e;var f=e.value;}catch(g){return a.a.b=null,Aa(a.a,g),Fa(a)}a.a.b=null;d.call(a.a,f);return Fa(a)}function Fa(a){for(;a.a.a;)try{var b=a.b(a.a);if(b)return a.a.f=!1,{value:b.value,done:!1}}catch(c){a.a.U=void 0,Aa(a.a,c);}a.a.f=!1;if(a.a.c){b=a.a.c;a.a.c=null;if(b.Na)throw b.Ja;return {value:b.return,done:!0}}return {value:void 0,done:!0}}
function Ga(a){this.next=function(b){za(a.a);a.a.b?b=Ea(a,a.a.b.next,b,a.a.u):(a.a.u(b),b=Fa(a));return b};this.throw=function(b){za(a.a);a.a.b?b=Ea(a,a.a.b["throw"],b,a.a.u):(Aa(a.a,b),b=Fa(a));return b};this.return=function(b){return Da(a,b)};na();this[Symbol.iterator]=function(){return this};}function Ha(a,b){b=new Ga(new Ca(b));xa&&xa(b,a.prototype);return b}Array.from||(Array.from=function(a){return [].slice.call(a)});
Object.assign||(Object.assign=function(a){for(var b=[].slice.call(arguments,1),c=0,d;c<b.length;c++)if(d=b[c])for(var e=a,f=d,g=Object.getOwnPropertyNames(f),h=0;h<g.length;h++)d=g[h],e[d]=f[d];return a});(function(){if(!function(){var f=document.createEvent("Event");f.initEvent("foo",!0,!0);f.preventDefault();return f.defaultPrevented}()){var a=Event.prototype.preventDefault;Event.prototype.preventDefault=function(){this.cancelable&&(a.call(this),Object.defineProperty(this,"defaultPrevented",{get:function(){return !0},configurable:!0}));};}var b=/Trident/.test(navigator.userAgent);if(!window.Event||b&&"function"!==typeof window.Event){var c=window.Event;window.Event=function(f,g){g=g||{};var h=document.createEvent("Event");
h.initEvent(f,!!g.bubbles,!!g.cancelable);return h};if(c){for(var d in c)window.Event[d]=c[d];window.Event.prototype=c.prototype;}}if(!window.CustomEvent||b&&"function"!==typeof window.CustomEvent)window.CustomEvent=function(f,g){g=g||{};var h=document.createEvent("CustomEvent");h.initCustomEvent(f,!!g.bubbles,!!g.cancelable,g.detail);return h},window.CustomEvent.prototype=window.Event.prototype;if(!window.MouseEvent||b&&"function"!==typeof window.MouseEvent){b=window.MouseEvent;window.MouseEvent=
function(f,g){g=g||{};var h=document.createEvent("MouseEvent");h.initMouseEvent(f,!!g.bubbles,!!g.cancelable,g.view||window,g.detail,g.screenX,g.screenY,g.clientX,g.clientY,g.ctrlKey,g.altKey,g.shiftKey,g.metaKey,g.button,g.relatedTarget);return h};if(b)for(var e in b)window.MouseEvent[e]=b[e];window.MouseEvent.prototype=b.prototype;}})();(function(){function a(){}function b(p,t){if(!p.childNodes.length)return [];switch(p.nodeType){case Node.DOCUMENT_NODE:return F.call(p,t);case Node.DOCUMENT_FRAGMENT_NODE:return C.call(p,t);default:return r.call(p,t)}}var c="undefined"===typeof HTMLTemplateElement,d=!(document.createDocumentFragment().cloneNode()instanceof DocumentFragment),e=!1;/Trident/.test(navigator.userAgent)&&function(){function p(y,R){if(y instanceof DocumentFragment)for(var $a;$a=y.firstChild;)D.call(this,$a,R);else D.call(this,
y,R);return y}e=!0;var t=Node.prototype.cloneNode;Node.prototype.cloneNode=function(y){y=t.call(this,y);this instanceof DocumentFragment&&(y.__proto__=DocumentFragment.prototype);return y};DocumentFragment.prototype.querySelectorAll=HTMLElement.prototype.querySelectorAll;DocumentFragment.prototype.querySelector=HTMLElement.prototype.querySelector;Object.defineProperties(DocumentFragment.prototype,{nodeType:{get:function(){return Node.DOCUMENT_FRAGMENT_NODE},configurable:!0},localName:{get:function(){},
configurable:!0},nodeName:{get:function(){return "#document-fragment"},configurable:!0}});var D=Node.prototype.insertBefore;Node.prototype.insertBefore=p;var K=Node.prototype.appendChild;Node.prototype.appendChild=function(y){y instanceof DocumentFragment?p.call(this,y,null):K.call(this,y);return y};var aa=Node.prototype.removeChild,ja=Node.prototype.replaceChild;Node.prototype.replaceChild=function(y,R){y instanceof DocumentFragment?(p.call(this,y,R),aa.call(this,R)):ja.call(this,y,R);return R};Document.prototype.createDocumentFragment=
function(){var y=this.createElement("df");y.__proto__=DocumentFragment.prototype;return y};var oa=Document.prototype.importNode;Document.prototype.importNode=function(y,R){R=oa.call(this,y,R||!1);y instanceof DocumentFragment&&(R.__proto__=DocumentFragment.prototype);return R};}();var f=Node.prototype.cloneNode,g=Document.prototype.createElement,h=Document.prototype.importNode,k=Node.prototype.removeChild,l=Node.prototype.appendChild,m=Node.prototype.replaceChild,q=DOMParser.prototype.parseFromString,
H=Object.getOwnPropertyDescriptor(window.HTMLElement.prototype,"innerHTML")||{get:function(){return this.innerHTML},set:function(p){this.innerHTML=p;}},E=Object.getOwnPropertyDescriptor(window.Node.prototype,"childNodes")||{get:function(){return this.childNodes}},r=Element.prototype.querySelectorAll,F=Document.prototype.querySelectorAll,C=DocumentFragment.prototype.querySelectorAll,N=function(){if(!c){var p=document.createElement("template"),t=document.createElement("template");t.content.appendChild(document.createElement("div"));
p.content.appendChild(t);p=p.cloneNode(!0);return 0===p.content.childNodes.length||0===p.content.firstChild.content.childNodes.length||d}}();if(c){var x=document.implementation.createHTMLDocument("template"),X=!0,v=document.createElement("style");v.textContent="template{display:none;}";var pa=document.head;pa.insertBefore(v,pa.firstElementChild);a.prototype=Object.create(HTMLElement.prototype);var fa=!document.createElement("div").hasOwnProperty("innerHTML");a.S=function(p){if(!p.content&&p.namespaceURI===
document.documentElement.namespaceURI){p.content=x.createDocumentFragment();for(var t;t=p.firstChild;)l.call(p.content,t);if(fa)p.__proto__=a.prototype;else if(p.cloneNode=function(D){return a.b(this,D)},X)try{n(p),I(p);}catch(D){X=!1;}a.a(p.content);}};var qa={option:["select"],thead:["table"],col:["colgroup","table"],tr:["tbody","table"],th:["tr","tbody","table"],td:["tr","tbody","table"]},n=function(p){Object.defineProperty(p,"innerHTML",{get:function(){return ta(this)},set:function(t){var D=qa[(/<([a-z][^/\0>\x20\t\r\n\f]+)/i.exec(t)||
["",""])[1].toLowerCase()];if(D)for(var K=0;K<D.length;K++)t="<"+D[K]+">"+t+"</"+D[K]+">";x.body.innerHTML=t;for(a.a(x);this.content.firstChild;)k.call(this.content,this.content.firstChild);t=x.body;if(D)for(K=0;K<D.length;K++)t=t.lastChild;for(;t.firstChild;)l.call(this.content,t.firstChild);},configurable:!0});},I=function(p){Object.defineProperty(p,"outerHTML",{get:function(){return "<template>"+this.innerHTML+"</template>"},set:function(t){if(this.parentNode){x.body.innerHTML=t;for(t=this.ownerDocument.createDocumentFragment();x.body.firstChild;)l.call(t,
x.body.firstChild);m.call(this.parentNode,t,this);}else throw Error("Failed to set the 'outerHTML' property on 'Element': This element has no parent node.");},configurable:!0});};n(a.prototype);I(a.prototype);a.a=function(p){p=b(p,"template");for(var t=0,D=p.length,K;t<D&&(K=p[t]);t++)a.S(K);};document.addEventListener("DOMContentLoaded",function(){a.a(document);});Document.prototype.createElement=function(){var p=g.apply(this,arguments);"template"===p.localName&&a.S(p);return p};DOMParser.prototype.parseFromString=
function(){var p=q.apply(this,arguments);a.a(p);return p};Object.defineProperty(HTMLElement.prototype,"innerHTML",{get:function(){return ta(this)},set:function(p){H.set.call(this,p);a.a(this);},configurable:!0,enumerable:!0});var ka=/[&\u00A0"]/g,Tb=/[&\u00A0<>]/g,ab=function(p){switch(p){case "&":return "&amp;";case "<":return "&lt;";case ">":return "&gt;";case '"':return "&quot;";case "\u00a0":return "&nbsp;"}};v=function(p){for(var t={},D=0;D<p.length;D++)t[p[D]]=!0;return t};var Pa=v("area base br col command embed hr img input keygen link meta param source track wbr".split(" ")),
bb=v("style script xmp iframe noembed noframes plaintext noscript".split(" ")),ta=function(p,t){"template"===p.localName&&(p=p.content);for(var D="",K=t?t(p):E.get.call(p),aa=0,ja=K.length,oa;aa<ja&&(oa=K[aa]);aa++){a:{var y=oa;var R=p;var $a=t;switch(y.nodeType){case Node.ELEMENT_NODE:for(var Ub=y.localName,cb="<"+Ub,Uf=y.attributes,qd=0;R=Uf[qd];qd++)cb+=" "+R.name+'="'+R.value.replace(ka,ab)+'"';cb+=">";y=Pa[Ub]?cb:cb+ta(y,$a)+"</"+Ub+">";break a;case Node.TEXT_NODE:y=y.data;y=R&&bb[R.localName]?
y:y.replace(Tb,ab);break a;case Node.COMMENT_NODE:y="\x3c!--"+y.data+"--\x3e";break a;default:throw window.console.error(y),Error("not implemented");}}D+=y;}return D};}if(c||N){a.b=function(p,t){var D=f.call(p,!1);this.S&&this.S(D);t&&(l.call(D.content,f.call(p.content,!0)),u(D.content,p.content));return D};var u=function(p,t){if(t.querySelectorAll&&(t=b(t,"template"),0!==t.length)){p=b(p,"template");for(var D=0,K=p.length,aa,ja;D<K;D++)ja=t[D],aa=p[D],a&&a.S&&a.S(ja),m.call(aa.parentNode,G.call(ja,
!0),aa);}},G=Node.prototype.cloneNode=function(p){if(!e&&d&&this instanceof DocumentFragment)if(p)var t=J.call(this.ownerDocument,this,!0);else return this.ownerDocument.createDocumentFragment();else this.nodeType===Node.ELEMENT_NODE&&"template"===this.localName&&this.namespaceURI==document.documentElement.namespaceURI?t=a.b(this,p):t=f.call(this,p);p&&u(t,this);return t},J=Document.prototype.importNode=function(p,t){t=t||!1;if("template"===p.localName)return a.b(p,t);var D=h.call(this,p,t);if(t){u(D,
p);p=b(D,'script:not([type]),script[type="application/javascript"],script[type="text/javascript"]');for(var K,aa=0;aa<p.length;aa++){K=p[aa];t=g.call(document,"script");t.textContent=K.textContent;for(var ja=K.attributes,oa=0,y;oa<ja.length;oa++)y=ja[oa],t.setAttribute(y.name,y.value);m.call(K.parentNode,t,K);}}return D};}c&&(window.HTMLTemplateElement=a);})();var Ia=setTimeout;function Ja(){}function Ka(a,b){return function(){a.apply(b,arguments);}}function z(a){if(!(this instanceof z))throw new TypeError("Promises must be constructed via new");if("function"!==typeof a)throw new TypeError("not a function");this.J=0;this.oa=!1;this.w=void 0;this.V=[];La(a,this);}
function Ma(a,b){for(;3===a.J;)a=a.w;0===a.J?a.V.push(b):(a.oa=!0,Na(function(){var c=1===a.J?b.Pa:b.Qa;if(null===c)(1===a.J?Oa:Qa)(b.ma,a.w);else{try{var d=c(a.w);}catch(e){Qa(b.ma,e);return}Oa(b.ma,d);}}));}function Oa(a,b){try{if(b===a)throw new TypeError("A promise cannot be resolved with itself.");if(b&&("object"===typeof b||"function"===typeof b)){var c=b.then;if(b instanceof z){a.J=3;a.w=b;Ra(a);return}if("function"===typeof c){La(Ka(c,b),a);return}}a.J=1;a.w=b;Ra(a);}catch(d){Qa(a,d);}}
function Qa(a,b){a.J=2;a.w=b;Ra(a);}function Ra(a){2===a.J&&0===a.V.length&&Na(function(){a.oa||"undefined"!==typeof console&&console&&console.warn("Possible Unhandled Promise Rejection:",a.w);});for(var b=0,c=a.V.length;b<c;b++)Ma(a,a.V[b]);a.V=null;}function Sa(a,b,c){this.Pa="function"===typeof a?a:null;this.Qa="function"===typeof b?b:null;this.ma=c;}function La(a,b){var c=!1;try{a(function(d){c||(c=!0,Oa(b,d));},function(d){c||(c=!0,Qa(b,d));});}catch(d){c||(c=!0,Qa(b,d));}}
z.prototype["catch"]=function(a){return this.then(null,a)};z.prototype.then=function(a,b){var c=new this.constructor(Ja);Ma(this,new Sa(a,b,c));return c};z.prototype["finally"]=function(a){var b=this.constructor;return this.then(function(c){return b.resolve(a()).then(function(){return c})},function(c){return b.resolve(a()).then(function(){return b.reject(c)})})};
function Ta(a){return new z(function(b,c){function d(h,k){try{if(k&&("object"===typeof k||"function"===typeof k)){var l=k.then;if("function"===typeof l){l.call(k,function(m){d(h,m);},c);return}}e[h]=k;0===--f&&b(e);}catch(m){c(m);}}if(!a||"undefined"===typeof a.length)throw new TypeError("Promise.all accepts an array");var e=Array.prototype.slice.call(a);if(0===e.length)return b([]);for(var f=e.length,g=0;g<e.length;g++)d(g,e[g]);})}
function Ua(a){return a&&"object"===typeof a&&a.constructor===z?a:new z(function(b){b(a);})}function Va(a){return new z(function(b,c){c(a);})}function Wa(a){return new z(function(b,c){for(var d=0,e=a.length;d<e;d++)a[d].then(b,c);})}var Na="function"===typeof setImmediate&&function(a){setImmediate(a);}||function(a){Ia(a,0);};/*

Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/
if(!window.Promise){window.Promise=z;z.prototype.then=z.prototype.then;z.all=Ta;z.race=Wa;z.resolve=Ua;z.reject=Va;var Xa=document.createTextNode(""),Ya=[];(new MutationObserver(function(){for(var a=Ya.length,b=0;b<a;b++)Ya[b]();Ya.splice(0,a);})).observe(Xa,{characterData:!0});Na=function(a){Ya.push(a);Xa.textContent=0<Xa.textContent.length?"":"a";};}(function(a,b){if(!(b in a)){var c=typeof commonjsGlobal===typeof c?window:commonjsGlobal,d=0,e=""+Math.random(),f="__\u0001symbol@@"+e,g=a.getOwnPropertyNames,h=a.getOwnPropertyDescriptor,k=a.create,l=a.keys,m=a.freeze||a,q=a.defineProperty,H=a.defineProperties,E=h(a,"getOwnPropertyNames"),r=a.prototype,F=r.hasOwnProperty,C=r.propertyIsEnumerable,N=r.toString,x=function(u,G,J){F.call(u,f)||q(u,f,{enumerable:!1,configurable:!1,writable:!1,value:{}});u[f]["@@"+G]=J;},X=function(u,G){var J=k(u);g(G).forEach(function(p){qa.call(G,
p)&&Pa(J,p,G[p]);});return J},v=function(){},pa=function(u){return u!=f&&!F.call(ka,u)},fa=function(u){return u!=f&&F.call(ka,u)},qa=function(u){var G=""+u;return fa(G)?F.call(this,G)&&this[f]["@@"+G]:C.call(this,u)},n=function(u){q(r,u,{enumerable:!1,configurable:!0,get:v,set:function(G){ta(this,u,{enumerable:!1,configurable:!0,writable:!0,value:G});x(this,u,!0);}});return m(ka[u]=q(a(u),"constructor",Tb))},I=function(u){if(this&&this!==c)throw new TypeError("Symbol is not a constructor");return n("__\u0001symbol:".concat(u||
"",e,++d))},ka=k(null),Tb={value:I},ab=function(u){return ka[u]},Pa=function(u,G,J){var p=""+G;if(fa(p)){G=ta;if(J.enumerable){var t=k(J);t.enumerable=!1;}else t=J;G(u,p,t);x(u,p,!!J.enumerable);}else q(u,G,J);return u},bb=function(u){return g(u).filter(fa).map(ab)};E.value=Pa;q(a,"defineProperty",E);E.value=bb;q(a,b,E);E.value=function(u){return g(u).filter(pa)};q(a,"getOwnPropertyNames",E);E.value=function(u,G){var J=bb(G);J.length?l(G).concat(J).forEach(function(p){qa.call(G,p)&&Pa(u,p,G[p]);}):H(u,
G);return u};q(a,"defineProperties",E);E.value=qa;q(r,"propertyIsEnumerable",E);E.value=I;q(c,"Symbol",E);E.value=function(u){u="__\u0001symbol:".concat("__\u0001symbol:",u,e);return u in r?ka[u]:n(u)};q(I,"for",E);E.value=function(u){if(pa(u))throw new TypeError(u+" is not a symbol");return F.call(ka,u)?u.slice(20,-e.length):void 0};q(I,"keyFor",E);E.value=function(u,G){var J=h(u,G);J&&fa(G)&&(J.enumerable=qa.call(u,G));return J};q(a,"getOwnPropertyDescriptor",E);E.value=function(u,G){return 1===
arguments.length?k(u):X(u,G)};q(a,"create",E);E.value=function(){var u=N.call(this);return "[object String]"===u&&fa(this)?"[object Symbol]":u};q(r,"toString",E);try{var ta=k(q({},"__\u0001symbol:",{get:function(){return q(this,"__\u0001symbol:",{value:!1})["__\u0001symbol:"]}}))["__\u0001symbol:"]||q;}catch(u){ta=function(G,J,p){var t=h(r,J);delete r[J];q(G,J,p);q(r,J,t);};}}})(Object,"getOwnPropertySymbols");
(function(a){var b=a.defineProperty,c=a.prototype,d=c.toString,e;"iterator match replace search split hasInstance isConcatSpreadable unscopables species toPrimitive toStringTag".split(" ").forEach(function(f){if(!(f in Symbol))switch(b(Symbol,f,{value:Symbol(f)}),f){case "toStringTag":e=a.getOwnPropertyDescriptor(c,"toString"),e.value=function(){var g=d.call(this),h=this[Symbol.toStringTag];return "undefined"===typeof h?g:"[object "+h+"]"},b(c,"toString",e);}});})(Object);
(function(a,b,c){function d(){return this}b[a]||(b[a]=function(){var e=0,f=this,g={next:function(){var h=f.length<=e;return h?{done:h}:{done:h,value:f[e++]}}};g[a]=d;return g});c[a]||(c[a]=function(){var e=String.fromCodePoint,f=this,g=0,h=f.length,k={next:function(){var l=h<=g,m=l?"":e(f.codePointAt(g));g+=m.length;return l?{done:l}:{done:l,value:m}}};k[a]=d;return k});})(Symbol.iterator,Array.prototype,String.prototype);/*

Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/
var Za=Object.prototype.toString;Object.prototype.toString=function(){return void 0===this?"[object Undefined]":null===this?"[object Null]":Za.call(this)};Object.keys=function(a){return Object.getOwnPropertyNames(a).filter(function(b){return (b=Object.getOwnPropertyDescriptor(a,b))&&b.enumerable})};var db=window.Symbol.iterator;
String.prototype[db]&&String.prototype.codePointAt||(String.prototype[db]=function eb(){var b,c=this;return Ha(eb,function(d){1==d.a&&(b=0);if(3!=d.a)return b<c.length?d=Ba(d,c[b]):(d.a=0,d=void 0),d;b++;d.a=2;})});Set.prototype[db]||(Set.prototype[db]=function fb(){var b,c=this,d;return Ha(fb,function(e){1==e.a&&(b=[],c.forEach(function(f){b.push(f);}),d=0);if(3!=e.a)return d<b.length?e=Ba(e,b[d]):(e.a=0,e=void 0),e;d++;e.a=2;})});
Map.prototype[db]||(Map.prototype[db]=function gb(){var b,c=this,d;return Ha(gb,function(e){1==e.a&&(b=[],c.forEach(function(f,g){b.push([g,f]);}),d=0);if(3!=e.a)return d<b.length?e=Ba(e,b[d]):(e.a=0,e=void 0),e;d++;e.a=2;})});/*

 Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 Code distributed by Google as part of the polymer project is also
 subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/
window.WebComponents=window.WebComponents||{flags:{}};var hb=document.querySelector('script[src*="webcomponents-bundle"]'),ib=/wc-(.+)/,jb={};if(!jb.noOpts){location.search.slice(1).split("&").forEach(function(a){a=a.split("=");var b;a[0]&&(b=a[0].match(ib))&&(jb[b[1]]=a[1]||!0);});if(hb)for(var kb=0,lb=void 0;lb=hb.attributes[kb];kb++)"src"!==lb.name&&(jb[lb.name]=lb.value||!0);if(jb.log&&jb.log.split){var mb=jb.log.split(",");jb.log={};mb.forEach(function(a){jb.log[a]=!0;});}else jb.log={};}
window.WebComponents.flags=jb;var nb=jb.shadydom;nb&&(window.ShadyDOM=window.ShadyDOM||{},window.ShadyDOM.force=nb);var ob=jb.register||jb.ce;ob&&window.customElements&&(window.customElements.forcePolyfill=ob);/*

Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/
function pb(){}pb.prototype.toJSON=function(){return {}};function A(a){a.__shady||(a.__shady=new pb);return a.__shady}function B(a){return a&&a.__shady}var L=window.ShadyDOM||{};L.La=!(!Element.prototype.attachShadow||!Node.prototype.getRootNode);var qb=Object.getOwnPropertyDescriptor(Node.prototype,"firstChild");L.F=!!(qb&&qb.configurable&&qb.get);L.ja=L.force||!L.La;L.M=L.noPatch||!1;L.va=L.preferPerformance;L.ya=navigator.userAgent.match("Trident");function rb(a){return (a=B(a))&&void 0!==a.firstChild}function M(a){return "ShadyRoot"===a.Da}function sb(a){return (a=(a=B(a))&&a.root)&&tb(a)}
var ub=Element.prototype,vb=ub.matches||ub.matchesSelector||ub.mozMatchesSelector||ub.msMatchesSelector||ub.oMatchesSelector||ub.webkitMatchesSelector,wb=document.createTextNode(""),xb=0,yb=[];(new MutationObserver(function(){for(;yb.length;)try{yb.shift()();}catch(a){throw wb.textContent=xb++,a;}})).observe(wb,{characterData:!0});function zb(a){yb.push(a);wb.textContent=xb++;}var Ab=!!document.contains;function Bb(a,b){for(;b;){if(b==a)return !0;b=b.__shady_parentNode;}return !1}
function Cb(a){for(var b=a.length-1;0<=b;b--){var c=a[b],d=c.getAttribute("id")||c.getAttribute("name");d&&"length"!==d&&isNaN(d)&&(a[d]=c);}a.item=function(e){return a[e]};a.namedItem=function(e){if("length"!==e&&isNaN(e)&&a[e])return a[e];for(var f=ca(a),g=f.next();!g.done;g=f.next())if(g=g.value,(g.getAttribute("id")||g.getAttribute("name"))==e)return g;return null};return a}function Db(a){var b=[];for(a=a.__shady_native_firstChild;a;a=a.__shady_native_nextSibling)b.push(a);return b}
function Eb(a){var b=[];for(a=a.__shady_firstChild;a;a=a.__shady_nextSibling)b.push(a);return b}function O(a,b,c,d){c=void 0===c?"":c;for(var e in b){var f=b[e];if(!(d&&0<=d.indexOf(e))){f.configurable=!0;var g=c+e;if(f.value)a[g]=f.value;else try{Object.defineProperty(a,g,f);}catch(h){}}}}function P(a){var b={};Object.getOwnPropertyNames(a).forEach(function(c){b[c]=Object.getOwnPropertyDescriptor(a,c);});return b}var Fb=[],Gb;function Hb(a){Gb||(Gb=!0,zb(Ib));Fb.push(a);}function Ib(){Gb=!1;for(var a=!!Fb.length;Fb.length;)Fb.shift()();return a}Ib.list=Fb;function Jb(){this.a=!1;this.addedNodes=[];this.removedNodes=[];this.ca=new Set;}function Kb(a){a.a||(a.a=!0,zb(function(){a.flush();}));}Jb.prototype.flush=function(){if(this.a){this.a=!1;var a=this.takeRecords();a.length&&this.ca.forEach(function(b){b(a);});}};Jb.prototype.takeRecords=function(){if(this.addedNodes.length||this.removedNodes.length){var a=[{addedNodes:this.addedNodes,removedNodes:this.removedNodes}];this.addedNodes=[];this.removedNodes=[];return a}return []};
function Lb(a,b){var c=A(a);c.W||(c.W=new Jb);c.W.ca.add(b);var d=c.W;return {Ca:b,P:d,Ea:a,takeRecords:function(){return d.takeRecords()}}}function Mb(a){var b=a&&a.P;b&&(b.ca.delete(a.Ca),b.ca.size||(A(a.Ea).W=null));}
function Nb(a,b){var c=b.getRootNode();return a.map(function(d){var e=c===d.target.getRootNode();if(e&&d.addedNodes){if(e=Array.from(d.addedNodes).filter(function(f){return c===f.getRootNode()}),e.length)return d=Object.create(d),Object.defineProperty(d,"addedNodes",{value:e,configurable:!0}),d}else if(e)return d}).filter(function(d){return d})}var Ob=/[&\u00A0"]/g,Pb=/[&\u00A0<>]/g;function Qb(a){switch(a){case "&":return "&amp;";case "<":return "&lt;";case ">":return "&gt;";case '"':return "&quot;";case "\u00a0":return "&nbsp;"}}function Rb(a){for(var b={},c=0;c<a.length;c++)b[a[c]]=!0;return b}var Sb=Rb("area base br col command embed hr img input keygen link meta param source track wbr".split(" ")),Vb=Rb("style script xmp iframe noembed noframes plaintext noscript".split(" "));
function Wb(a,b){"template"===a.localName&&(a=a.content);for(var c="",d=b?b(a):a.childNodes,e=0,f=d.length,g=void 0;e<f&&(g=d[e]);e++){a:{var h=g;var k=a,l=b;switch(h.nodeType){case Node.ELEMENT_NODE:k=h.localName;for(var m="<"+k,q=h.attributes,H=0,E;E=q[H];H++)m+=" "+E.name+'="'+E.value.replace(Ob,Qb)+'"';m+=">";h=Sb[k]?m:m+Wb(h,l)+"</"+k+">";break a;case Node.TEXT_NODE:h=h.data;h=k&&Vb[k.localName]?h:h.replace(Pb,Qb);break a;case Node.COMMENT_NODE:h="\x3c!--"+h.data+"--\x3e";break a;default:throw window.console.error(h),
Error("not implemented");}}c+=h;}return c}var Xb=L.F,Yb={querySelector:function(a){return this.__shady_native_querySelector(a)},querySelectorAll:function(a){return this.__shady_native_querySelectorAll(a)}},Zb={};function $b(a){Zb[a]=function(b){return b["__shady_native_"+a]};}function ac(a,b){O(a,b,"__shady_native_");for(var c in b)$b(c);}function Q(a,b){b=void 0===b?[]:b;for(var c=0;c<b.length;c++){var d=b[c],e=Object.getOwnPropertyDescriptor(a,d);e&&(Object.defineProperty(a,"__shady_native_"+d,e),e.value?Yb[d]||(Yb[d]=e.value):$b(d));}}
var bc=document.createTreeWalker(document,NodeFilter.SHOW_ALL,null,!1),cc=document.createTreeWalker(document,NodeFilter.SHOW_ELEMENT,null,!1),dc=document.implementation.createHTMLDocument("inert");function ec(a){for(var b;b=a.__shady_native_firstChild;)a.__shady_native_removeChild(b);}var fc=["firstElementChild","lastElementChild","children","childElementCount"],gc=["querySelector","querySelectorAll"];
function hc(){var a=["dispatchEvent","addEventListener","removeEventListener"];window.EventTarget?Q(window.EventTarget.prototype,a):(Q(Node.prototype,a),Q(Window.prototype,a));Xb?Q(Node.prototype,"parentNode firstChild lastChild previousSibling nextSibling childNodes parentElement textContent".split(" ")):ac(Node.prototype,{parentNode:{get:function(){bc.currentNode=this;return bc.parentNode()}},firstChild:{get:function(){bc.currentNode=this;return bc.firstChild()}},lastChild:{get:function(){bc.currentNode=
this;return bc.lastChild()}},previousSibling:{get:function(){bc.currentNode=this;return bc.previousSibling()}},nextSibling:{get:function(){bc.currentNode=this;return bc.nextSibling()}},childNodes:{get:function(){var b=[];bc.currentNode=this;for(var c=bc.firstChild();c;)b.push(c),c=bc.nextSibling();return b}},parentElement:{get:function(){cc.currentNode=this;return cc.parentNode()}},textContent:{get:function(){switch(this.nodeType){case Node.ELEMENT_NODE:case Node.DOCUMENT_FRAGMENT_NODE:for(var b=
document.createTreeWalker(this,NodeFilter.SHOW_TEXT,null,!1),c="",d;d=b.nextNode();)c+=d.nodeValue;return c;default:return this.nodeValue}},set:function(b){if("undefined"===typeof b||null===b)b="";switch(this.nodeType){case Node.ELEMENT_NODE:case Node.DOCUMENT_FRAGMENT_NODE:ec(this);(0<b.length||this.nodeType===Node.ELEMENT_NODE)&&this.__shady_native_insertBefore(document.createTextNode(b),void 0);break;default:this.nodeValue=b;}}}});Q(Node.prototype,"appendChild insertBefore removeChild replaceChild cloneNode contains".split(" "));
Q(HTMLElement.prototype,["parentElement","contains"]);a={firstElementChild:{get:function(){cc.currentNode=this;return cc.firstChild()}},lastElementChild:{get:function(){cc.currentNode=this;return cc.lastChild()}},children:{get:function(){var b=[];cc.currentNode=this;for(var c=cc.firstChild();c;)b.push(c),c=cc.nextSibling();return Cb(b)}},childElementCount:{get:function(){return this.children?this.children.length:0}}};Xb?(Q(Element.prototype,fc),Q(Element.prototype,["previousElementSibling","nextElementSibling",
"innerHTML","className"]),Q(HTMLElement.prototype,["children","innerHTML","className"])):(ac(Element.prototype,a),ac(Element.prototype,{previousElementSibling:{get:function(){cc.currentNode=this;return cc.previousSibling()}},nextElementSibling:{get:function(){cc.currentNode=this;return cc.nextSibling()}},innerHTML:{get:function(){return Wb(this,Db)},set:function(b){var c="template"===this.localName?this.content:this;ec(c);var d=this.localName||"div";d=this.namespaceURI&&this.namespaceURI!==dc.namespaceURI?
dc.createElementNS(this.namespaceURI,d):dc.createElement(d);d.innerHTML=b;for(b="template"===this.localName?d.content:d;d=b.__shady_native_firstChild;)c.__shady_native_insertBefore(d,void 0);}},className:{get:function(){return this.getAttribute("class")||""},set:function(b){this.setAttribute("class",b);}}}));Q(Element.prototype,"setAttribute getAttribute hasAttribute removeAttribute focus blur".split(" "));Q(Element.prototype,gc);Q(HTMLElement.prototype,["focus","blur"]);window.HTMLTemplateElement&&
Q(window.HTMLTemplateElement.prototype,["innerHTML"]);Xb?Q(DocumentFragment.prototype,fc):ac(DocumentFragment.prototype,a);Q(DocumentFragment.prototype,gc);Xb?(Q(Document.prototype,fc),Q(Document.prototype,["activeElement"])):ac(Document.prototype,a);Q(Document.prototype,["importNode","getElementById"]);Q(Document.prototype,gc);}var ic=P({get childNodes(){return this.__shady_childNodes},get firstChild(){return this.__shady_firstChild},get lastChild(){return this.__shady_lastChild},get childElementCount(){return this.__shady_childElementCount},get children(){return this.__shady_children},get firstElementChild(){return this.__shady_firstElementChild},get lastElementChild(){return this.__shady_lastElementChild},get shadowRoot(){return this.__shady_shadowRoot}}),jc=P({get textContent(){return this.__shady_textContent},set textContent(a){this.__shady_textContent=
a;},get innerHTML(){return this.__shady_innerHTML},set innerHTML(a){return this.__shady_innerHTML=a}}),kc=P({get parentElement(){return this.__shady_parentElement},get parentNode(){return this.__shady_parentNode},get nextSibling(){return this.__shady_nextSibling},get previousSibling(){return this.__shady_previousSibling},get nextElementSibling(){return this.__shady_nextElementSibling},get previousElementSibling(){return this.__shady_previousElementSibling},get className(){return this.__shady_className},
set className(a){return this.__shady_className=a}});function lc(a){for(var b in a){var c=a[b];c&&(c.enumerable=!1);}}lc(ic);lc(jc);lc(kc);var mc=L.F||L.M,nc=mc?function(){}:function(a){var b=A(a);b.Aa||(b.Aa=!0,O(a,kc));},oc=mc?function(){}:function(a){var b=A(a);b.za||(b.za=!0,O(a,ic),window.customElements&&!L.M||O(a,jc));};var pc="__eventWrappers"+Date.now(),qc=function(){var a=Object.getOwnPropertyDescriptor(Event.prototype,"composed");return a?function(b){return a.get.call(b)}:null}(),rc=function(){function a(){}var b=!1,c={get capture(){b=!0;return !1}};window.addEventListener("test",a,c);window.removeEventListener("test",a,c);return b}();function sc(a){if(a&&"object"===typeof a){var b=!!a.capture;var c=!!a.once;var d=!!a.passive;var e=a.O;}else b=!!a,d=c=!1;return {wa:e,capture:b,once:c,passive:d,ta:rc?a:b}}
var tc={blur:!0,focus:!0,focusin:!0,focusout:!0,click:!0,dblclick:!0,mousedown:!0,mouseenter:!0,mouseleave:!0,mousemove:!0,mouseout:!0,mouseover:!0,mouseup:!0,wheel:!0,beforeinput:!0,input:!0,keydown:!0,keyup:!0,compositionstart:!0,compositionupdate:!0,compositionend:!0,touchstart:!0,touchend:!0,touchmove:!0,touchcancel:!0,pointerover:!0,pointerenter:!0,pointerdown:!0,pointermove:!0,pointerup:!0,pointercancel:!0,pointerout:!0,pointerleave:!0,gotpointercapture:!0,lostpointercapture:!0,dragstart:!0,
drag:!0,dragenter:!0,dragleave:!0,dragover:!0,drop:!0,dragend:!0,DOMActivate:!0,DOMFocusIn:!0,DOMFocusOut:!0,keypress:!0},uc={DOMAttrModified:!0,DOMAttributeNameChanged:!0,DOMCharacterDataModified:!0,DOMElementNameChanged:!0,DOMNodeInserted:!0,DOMNodeInsertedIntoDocument:!0,DOMNodeRemoved:!0,DOMNodeRemovedFromDocument:!0,DOMSubtreeModified:!0};function vc(a){return a instanceof Node?a.__shady_getRootNode():a}
function wc(a,b){var c=[],d=a;for(a=vc(a);d;)c.push(d),d.__shady_assignedSlot?d=d.__shady_assignedSlot:d.nodeType===Node.DOCUMENT_FRAGMENT_NODE&&d.host&&(b||d!==a)?d=d.host:d=d.__shady_parentNode;c[c.length-1]===document&&c.push(window);return c}function xc(a){a.__composedPath||(a.__composedPath=wc(a.target,!0));return a.__composedPath}function yc(a,b){if(!M)return a;a=wc(a,!0);for(var c=0,d,e=void 0,f,g=void 0;c<b.length;c++)if(d=b[c],f=vc(d),f!==e&&(g=a.indexOf(f),e=f),!M(f)||-1<g)return d}
function zc(a){function b(c,d){c=new a(c,d);c.__composed=d&&!!d.composed;return c}b.__proto__=a;b.prototype=a.prototype;return b}var Ac={focus:!0,blur:!0};function Bc(a){return a.__target!==a.target||a.__relatedTarget!==a.relatedTarget}function Cc(a,b,c){if(c=b.__handlers&&b.__handlers[a.type]&&b.__handlers[a.type][c])for(var d=0,e;(e=c[d])&&(!Bc(a)||a.target!==a.relatedTarget)&&(e.call(b,a),!a.__immediatePropagationStopped);d++);}
function Dc(a){var b=a.composedPath();Object.defineProperty(a,"currentTarget",{get:function(){return d},configurable:!0});for(var c=b.length-1;0<=c;c--){var d=b[c];Cc(a,d,"capture");if(a.fa)return}Object.defineProperty(a,"eventPhase",{get:function(){return Event.AT_TARGET}});var e;for(c=0;c<b.length;c++){d=b[c];var f=B(d);f=f&&f.root;if(0===c||f&&f===e)if(Cc(a,d,"bubble"),d!==window&&(e=d.__shady_getRootNode()),a.fa)break}}
function Ec(a,b,c,d,e,f){for(var g=0;g<a.length;g++){var h=a[g],k=h.type,l=h.capture,m=h.once,q=h.passive;if(b===h.node&&c===k&&d===l&&e===m&&f===q)return g}return -1}function Fc(a){Ib();return this.__shady_native_dispatchEvent(a)}
function Gc(a,b,c){var d=sc(c),e=d.capture,f=d.once,g=d.passive,h=d.wa;d=d.ta;if(b){var k=typeof b;if("function"===k||"object"===k)if("object"!==k||b.handleEvent&&"function"===typeof b.handleEvent){if(uc[a])return this.__shady_native_addEventListener(a,b,d);var l=h||this;if(h=b[pc]){if(-1<Ec(h,l,a,e,f,g))return}else b[pc]=[];h=function(m){f&&this.__shady_removeEventListener(a,b,c);m.__target||Hc(m);if(l!==this){var q=Object.getOwnPropertyDescriptor(m,"currentTarget");Object.defineProperty(m,"currentTarget",
{get:function(){return l},configurable:!0});}m.__previousCurrentTarget=m.currentTarget;if(!M(l)&&"slot"!==l.localName||-1!=m.composedPath().indexOf(l))if(m.composed||-1<m.composedPath().indexOf(l))if(Bc(m)&&m.target===m.relatedTarget)m.eventPhase===Event.BUBBLING_PHASE&&m.stopImmediatePropagation();else if(m.eventPhase===Event.CAPTURING_PHASE||m.bubbles||m.target===l||l instanceof Window){var H="function"===k?b.call(l,m):b.handleEvent&&b.handleEvent(m);l!==this&&(q?(Object.defineProperty(m,"currentTarget",
q),q=null):delete m.currentTarget);return H}};b[pc].push({node:l,type:a,capture:e,once:f,passive:g,ab:h});Ac[a]?(this.__handlers=this.__handlers||{},this.__handlers[a]=this.__handlers[a]||{capture:[],bubble:[]},this.__handlers[a][e?"capture":"bubble"].push(h)):this.__shady_native_addEventListener(a,h,d);}}}
function Ic(a,b,c){if(b){var d=sc(c);c=d.capture;var e=d.once,f=d.passive,g=d.wa;d=d.ta;if(uc[a])return this.__shady_native_removeEventListener(a,b,d);var h=g||this;g=void 0;var k=null;try{k=b[pc];}catch(l){}k&&(e=Ec(k,h,a,c,e,f),-1<e&&(g=k.splice(e,1)[0].ab,k.length||(b[pc]=void 0)));this.__shady_native_removeEventListener(a,g||b,d);g&&Ac[a]&&this.__handlers&&this.__handlers[a]&&(a=this.__handlers[a][c?"capture":"bubble"],b=a.indexOf(g),-1<b&&a.splice(b,1));}}
function Jc(){for(var a in Ac)window.__shady_native_addEventListener(a,function(b){b.__target||(Hc(b),Dc(b));},!0);}
var Kc=P({get composed(){void 0===this.__composed&&(qc?this.__composed="focusin"===this.type||"focusout"===this.type||qc(this):!1!==this.isTrusted&&(this.__composed=tc[this.type]));return this.__composed||!1},composedPath:function(){this.__composedPath||(this.__composedPath=wc(this.__target,this.composed));return this.__composedPath},get target(){return yc(this.currentTarget||this.__previousCurrentTarget,this.composedPath())},get relatedTarget(){if(!this.__relatedTarget)return null;this.__relatedTargetComposedPath||
(this.__relatedTargetComposedPath=wc(this.__relatedTarget,!0));return yc(this.currentTarget||this.__previousCurrentTarget,this.__relatedTargetComposedPath)},stopPropagation:function(){Event.prototype.stopPropagation.call(this);this.fa=!0;},stopImmediatePropagation:function(){Event.prototype.stopImmediatePropagation.call(this);this.fa=this.__immediatePropagationStopped=!0;}});
function Hc(a){a.__target=a.target;a.__relatedTarget=a.relatedTarget;if(L.F){var b=Object.getPrototypeOf(a);if(!Object.hasOwnProperty(b,"__shady_patchedProto")){var c=Object.create(b);c.__shady_sourceProto=b;O(c,Kc);b.__shady_patchedProto=c;}a.__proto__=b.__shady_patchedProto;}else O(a,Kc);}var Lc=zc(Event),Mc=zc(CustomEvent),Nc=zc(MouseEvent);
function Oc(){if(!qc&&Object.getOwnPropertyDescriptor(Event.prototype,"isTrusted")){var a=function(){var b=new MouseEvent("click",{bubbles:!0,cancelable:!0,composed:!0});this.__shady_dispatchEvent(b);};Element.prototype.click?Element.prototype.click=a:HTMLElement.prototype.click&&(HTMLElement.prototype.click=a);}}var Pc=Object.getOwnPropertyNames(Document.prototype).filter(function(a){return "on"===a.substring(0,2)});function Qc(a,b){return {index:a,X:[],ba:b}}
function Rc(a,b,c,d){var e=0,f=0,g=0,h=0,k=Math.min(b-e,d-f);if(0==e&&0==f)a:{for(g=0;g<k;g++)if(a[g]!==c[g])break a;g=k;}if(b==a.length&&d==c.length){h=a.length;for(var l=c.length,m=0;m<k-g&&Sc(a[--h],c[--l]);)m++;h=m;}e+=g;f+=g;b-=h;d-=h;if(0==b-e&&0==d-f)return [];if(e==b){for(b=Qc(e,0);f<d;)b.X.push(c[f++]);return [b]}if(f==d)return [Qc(e,b-e)];k=e;g=f;d=d-g+1;h=b-k+1;b=Array(d);for(l=0;l<d;l++)b[l]=Array(h),b[l][0]=l;for(l=0;l<h;l++)b[0][l]=l;for(l=1;l<d;l++)for(m=1;m<h;m++)if(a[k+m-1]===c[g+l-1])b[l][m]=
b[l-1][m-1];else{var q=b[l-1][m]+1,H=b[l][m-1]+1;b[l][m]=q<H?q:H;}k=b.length-1;g=b[0].length-1;d=b[k][g];for(a=[];0<k||0<g;)0==k?(a.push(2),g--):0==g?(a.push(3),k--):(h=b[k-1][g-1],l=b[k-1][g],m=b[k][g-1],q=l<m?l<h?l:h:m<h?m:h,q==h?(h==d?a.push(0):(a.push(1),d=h),k--,g--):q==l?(a.push(3),k--,d=l):(a.push(2),g--,d=m));a.reverse();b=void 0;k=[];for(g=0;g<a.length;g++)switch(a[g]){case 0:b&&(k.push(b),b=void 0);e++;f++;break;case 1:b||(b=Qc(e,0));b.ba++;e++;b.X.push(c[f]);f++;break;case 2:b||(b=Qc(e,
0));b.ba++;e++;break;case 3:b||(b=Qc(e,0)),b.X.push(c[f]),f++;}b&&k.push(b);return k}function Sc(a,b){return a===b}function Tc(a,b,c,d){nc(a);d=d||null;var e=A(a),f=d?A(d):null;e.previousSibling=d?f.previousSibling:b.__shady_lastChild;if(f=B(e.previousSibling))f.nextSibling=a;if(f=B(e.nextSibling=d))f.previousSibling=a;e.parentNode=b;d?d===c.firstChild&&(c.firstChild=a):(c.lastChild=a,c.firstChild||(c.firstChild=a));c.childNodes=null;}
function Uc(a,b,c){oc(b);var d=A(b);void 0!==d.firstChild&&(d.childNodes=null);if(a.nodeType===Node.DOCUMENT_FRAGMENT_NODE)for(a=a.__shady_native_firstChild;a;a=a.__shady_native_nextSibling)Tc(a,b,d,c);else Tc(a,b,d,c);}
function Vc(a,b){var c=A(a);b=A(b);a===b.firstChild&&(b.firstChild=c.nextSibling);a===b.lastChild&&(b.lastChild=c.previousSibling);a=c.previousSibling;var d=c.nextSibling;a&&(A(a).nextSibling=d);d&&(A(d).previousSibling=a);c.parentNode=c.previousSibling=c.nextSibling=void 0;void 0!==b.childNodes&&(b.childNodes=null);}
function Wc(a,b){var c=A(a);if(b||void 0===c.firstChild){c.childNodes=null;var d=c.firstChild=a.__shady_native_firstChild;c.lastChild=a.__shady_native_lastChild;oc(a);c=d;for(d=void 0;c;c=c.__shady_native_nextSibling){var e=A(c);e.parentNode=b||a;e.nextSibling=c.__shady_native_nextSibling;e.previousSibling=d||null;d=c;nc(c);}}}var Xc=null;function Yc(){Xc||(Xc=window.ShadyCSS&&window.ShadyCSS.ScopingShim);return Xc||null}function Zc(a,b,c){var d=Yc();return d&&"class"===b?(d.setElementClass(a,c),!0):!1}function $c(a,b){var c=Yc();c&&c.unscopeNode(a,b);}function ad(a,b){var c=Yc();if(!c)return !0;if(a.nodeType===Node.DOCUMENT_FRAGMENT_NODE){c=!0;for(a=a.__shady_firstChild;a;a=a.__shady_nextSibling)c=c&&ad(a,b);return c}return a.nodeType!==Node.ELEMENT_NODE?!0:c.currentScopeForNode(a)===b}
function bd(a){if(a.nodeType!==Node.ELEMENT_NODE)return "";var b=Yc();return b?b.currentScopeForNode(a):""}function cd(a,b){if(a)for(a.nodeType===Node.ELEMENT_NODE&&b(a),a=a.__shady_firstChild;a;a=a.__shady_nextSibling)a.nodeType===Node.ELEMENT_NODE&&cd(a,b);}var dd=window.document,ed=L.va,fd=Object.getOwnPropertyDescriptor(Node.prototype,"isConnected"),gd=fd&&fd.get;function hd(a){for(var b;b=a.__shady_firstChild;)a.__shady_removeChild(b);}function id(a){var b=B(a);if(b&&void 0!==b.ea)for(b=a.__shady_firstChild;b;b=b.__shady_nextSibling)id(b);if(a=B(a))a.ea=void 0;}function jd(a){var b=a;a&&"slot"===a.localName&&(b=(b=(b=B(a))&&b.T)&&b.length?b[0]:jd(a.__shady_nextSibling));return b}
function kd(a,b,c){if(a=(a=B(a))&&a.W)b&&(b.nodeType===Node.DOCUMENT_FRAGMENT_NODE?a.addedNodes.push.apply(a.addedNodes,da(b.childNodes)):a.addedNodes.push(b)),c&&a.removedNodes.push(c),Kb(a);}
var pd=P({get parentNode(){var a=B(this);a=a&&a.parentNode;return void 0!==a?a:this.__shady_native_parentNode},get firstChild(){var a=B(this);a=a&&a.firstChild;return void 0!==a?a:this.__shady_native_firstChild},get lastChild(){var a=B(this);a=a&&a.lastChild;return void 0!==a?a:this.__shady_native_lastChild},get nextSibling(){var a=B(this);a=a&&a.nextSibling;return void 0!==a?a:this.__shady_native_nextSibling},get previousSibling(){var a=B(this);a=a&&a.previousSibling;return void 0!==a?a:this.__shady_native_previousSibling},
get childNodes(){if(rb(this)){var a=B(this);if(!a.childNodes){a.childNodes=[];for(var b=this.__shady_firstChild;b;b=b.__shady_nextSibling)a.childNodes.push(b);}var c=a.childNodes;}else c=this.__shady_native_childNodes;c.item=function(d){return c[d]};return c},get parentElement(){var a=B(this);(a=a&&a.parentNode)&&a.nodeType!==Node.ELEMENT_NODE&&(a=null);return void 0!==a?a:this.__shady_native_parentElement},get isConnected(){if(gd&&gd.call(this))return !0;if(this.nodeType==Node.DOCUMENT_FRAGMENT_NODE)return !1;
var a=this.ownerDocument;if(Ab){if(a.__shady_native_contains(this))return !0}else if(a.documentElement&&a.documentElement.__shady_native_contains(this))return !0;for(a=this;a&&!(a instanceof Document);)a=a.__shady_parentNode||(M(a)?a.host:void 0);return !!(a&&a instanceof Document)},get textContent(){if(rb(this)){for(var a=[],b=this.__shady_firstChild;b;b=b.__shady_nextSibling)b.nodeType!==Node.COMMENT_NODE&&a.push(b.__shady_textContent);return a.join("")}return this.__shady_native_textContent},set textContent(a){if("undefined"===
typeof a||null===a)a="";switch(this.nodeType){case Node.ELEMENT_NODE:case Node.DOCUMENT_FRAGMENT_NODE:if(!rb(this)&&L.F){var b=this.__shady_firstChild;(b!=this.__shady_lastChild||b&&b.nodeType!=Node.TEXT_NODE)&&hd(this);this.__shady_native_textContent=a;}else hd(this),(0<a.length||this.nodeType===Node.ELEMENT_NODE)&&this.__shady_insertBefore(document.createTextNode(a));break;default:this.nodeValue=a;}},insertBefore:function(a,b){if(this.ownerDocument!==dd&&a.ownerDocument!==dd)return this.__shady_native_insertBefore(a,
b),a;if(a===this)throw Error("Failed to execute 'appendChild' on 'Node': The new child element contains the parent.");if(b){var c=B(b);c=c&&c.parentNode;if(void 0!==c&&c!==this||void 0===c&&b.__shady_native_parentNode!==this)throw Error("Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node.");}if(b===a)return a;kd(this,a);var d=[],e=(c=ld(this))?c.host.localName:bd(this),f=a.__shady_parentNode;if(f){var g=bd(a);var h=!!c||!ld(a)||
ed&&void 0!==this.__noInsertionPoint;f.__shady_removeChild(a,h);}f=!0;var k=(!ed||void 0===a.__noInsertionPoint&&void 0===this.__noInsertionPoint)&&!ad(a,e),l=c&&!a.__noInsertionPoint&&(!ed||a.nodeType===Node.DOCUMENT_FRAGMENT_NODE);if(l||k)k&&(g=g||bd(a)),cd(a,function(m){l&&"slot"===m.localName&&d.push(m);if(k){var q=g;Yc()&&(q&&$c(m,q),(q=Yc())&&q.scopeNode(m,e));}});d.length&&(md(c),c.c.push.apply(c.c,da(d)),nd(c));rb(this)&&(Uc(a,this,b),c=B(this),sb(this)?(nd(c.root),f=!1):c.root&&(f=!1));f?(c=
M(this)?this.host:this,b?(b=jd(b),c.__shady_native_insertBefore(a,b)):c.__shady_native_appendChild(a)):a.ownerDocument!==this.ownerDocument&&this.ownerDocument.adoptNode(a);return a},appendChild:function(a){if(this!=a||!M(a))return this.__shady_insertBefore(a)},removeChild:function(a,b){b=void 0===b?!1:b;if(this.ownerDocument!==dd)return this.__shady_native_removeChild(a);if(a.__shady_parentNode!==this)throw Error("The node to be removed is not a child of this node: "+a);kd(this,null,a);var c=ld(a),
d=c&&od(c,a),e=B(this);if(rb(this)&&(Vc(a,this),sb(this))){nd(e.root);var f=!0;}if(Yc()&&!b&&c&&a.nodeType!==Node.TEXT_NODE){var g=bd(a);cd(a,function(h){$c(h,g);});}id(a);c&&((b=this&&"slot"===this.localName)&&(f=!0),(d||b)&&nd(c));f||(f=M(this)?this.host:this,(!e.root&&"slot"!==a.localName||f===a.__shady_native_parentNode)&&f.__shady_native_removeChild(a));return a},replaceChild:function(a,b){this.__shady_insertBefore(a,b);this.__shady_removeChild(b);return a},cloneNode:function(a){if("template"==
this.localName)return this.__shady_native_cloneNode(a);var b=this.__shady_native_cloneNode(!1);if(a&&b.nodeType!==Node.ATTRIBUTE_NODE){a=this.__shady_firstChild;for(var c;a;a=a.__shady_nextSibling)c=a.__shady_cloneNode(!0),b.__shady_appendChild(c);}return b},getRootNode:function(a){if(this&&this.nodeType){var b=A(this),c=b.ea;void 0===c&&(M(this)?(c=this,b.ea=c):(c=(c=this.__shady_parentNode)?c.__shady_getRootNode(a):this,document.documentElement.__shady_native_contains(this)&&(b.ea=c)));return c}},
contains:function(a){return Bb(this,a)}});function rd(a,b,c){var d=[];sd(a,b,c,d);return d}function sd(a,b,c,d){for(a=a.__shady_firstChild;a;a=a.__shady_nextSibling){var e;if(e=a.nodeType===Node.ELEMENT_NODE){e=a;var f=b,g=c,h=d,k=f(e);k&&h.push(e);g&&g(k)?e=k:(sd(e,f,g,h),e=void 0);}if(e)break}}
var td=P({get firstElementChild(){var a=B(this);if(a&&void 0!==a.firstChild){for(a=this.__shady_firstChild;a&&a.nodeType!==Node.ELEMENT_NODE;)a=a.__shady_nextSibling;return a}return this.__shady_native_firstElementChild},get lastElementChild(){var a=B(this);if(a&&void 0!==a.lastChild){for(a=this.__shady_lastChild;a&&a.nodeType!==Node.ELEMENT_NODE;)a=a.__shady_previousSibling;return a}return this.__shady_native_lastElementChild},get children(){return rb(this)?Cb(Array.prototype.filter.call(Eb(this),
function(a){return a.nodeType===Node.ELEMENT_NODE})):this.__shady_native_children},get childElementCount(){var a=this.__shady_children;return a?a.length:0}}),ud=P({querySelector:function(a){return rd(this,function(b){return vb.call(b,a)},function(b){return !!b})[0]||null},querySelectorAll:function(a,b){if(b){b=Array.prototype.slice.call(this.__shady_native_querySelectorAll(a));var c=this.__shady_getRootNode();return Cb(b.filter(function(d){return d.__shady_getRootNode()==c}))}return Cb(rd(this,function(d){return vb.call(d,
a)}))}}),vd=L.va&&!L.M?Object.assign({},td):td;Object.assign(td,ud);var wd=P({getElementById:function(a){return ""===a?null:rd(this,function(b){return b.id==a},function(b){return !!b})[0]||null}});var xd=P({get activeElement(){var a=L.F?document.__shady_native_activeElement:document.activeElement;if(!a||!a.nodeType)return null;var b=!!M(this);if(!(this===document||b&&this.host!==a&&this.host.__shady_native_contains(a)))return null;for(b=ld(a);b&&b!==this;)a=b.host,b=ld(a);return this===document?b?null:a:b===this?a:null}});var yd=document.implementation.createHTMLDocument("inert"),zd=P({get innerHTML(){return rb(this)?Wb("template"===this.localName?this.content:this,Eb):this.__shady_native_innerHTML},set innerHTML(a){if("template"===this.localName)this.__shady_native_innerHTML=a;else{hd(this);var b=this.localName||"div";b=this.namespaceURI&&this.namespaceURI!==yd.namespaceURI?yd.createElementNS(this.namespaceURI,b):yd.createElement(b);for(L.F?b.__shady_native_innerHTML=a:b.innerHTML=a;a=b.__shady_firstChild;)this.__shady_insertBefore(a);}}});var Ad=P({addEventListener:function(a,b,c){"object"!==typeof c&&(c={capture:!!c});c.O=c.O||this;this.host.__shady_addEventListener(a,b,c);},removeEventListener:function(a,b,c){"object"!==typeof c&&(c={capture:!!c});c.O=c.O||this;this.host.__shady_removeEventListener(a,b,c);}});function Bd(a,b){O(a,Ad,b);O(a,xd,b);O(a,zd,b);O(a,td,b);L.M&&!b?(O(a,pd,b),O(a,wd,b)):L.F||(O(a,kc),O(a,ic),O(a,jc));}var Cd={},Dd=L.deferConnectionCallbacks&&"loading"===document.readyState,Ed;function Fd(a){var b=[];do b.unshift(a);while(a=a.__shady_parentNode);return b}function Gd(a,b,c){if(a!==Cd)throw new TypeError("Illegal constructor");this.a=null;Hd(this,b,c);}
function Hd(a,b,c){a.Da="ShadyRoot";a.host=b;a.mode=c&&c.mode;Wc(a.host);b=A(a.host);b.root=a;b.Ta="closed"!==a.mode?a:null;b=A(a);b.firstChild=b.lastChild=b.parentNode=b.nextSibling=b.previousSibling=null;if(L.preferPerformance)for(;b=a.host.__shady_native_firstChild;)a.host.__shady_native_removeChild(b);else nd(a);}function nd(a){a.R||(a.R=!0,Hb(function(){return Id(a)}));}
function Id(a){var b;if(b=a.R){for(var c;a;)a:{a.R&&(c=a),b=a;a=b.host.__shady_getRootNode();if(M(a)&&(b=B(b.host))&&0<b.aa)break a;a=void 0;}b=c;}(c=b)&&c._renderSelf();}
Gd.prototype._renderSelf=function(){var a=Dd;Dd=!0;this.R=!1;if(this.a){Jd(this);for(var b=0,c;b<this.a.length;b++){c=this.a[b];var d=B(c),e=d.assignedNodes;d.assignedNodes=[];d.T=[];if(d.qa=e)for(d=0;d<e.length;d++){var f=B(e[d]);f.ga=f.assignedSlot;f.assignedSlot===c&&(f.assignedSlot=null);}}for(b=this.host.__shady_firstChild;b;b=b.__shady_nextSibling)Kd(this,b);for(b=0;b<this.a.length;b++){c=this.a[b];e=B(c);if(!e.assignedNodes.length)for(d=c.__shady_firstChild;d;d=d.__shady_nextSibling)Kd(this,
d,c);(d=(d=B(c.__shady_parentNode))&&d.root)&&(tb(d)||d.R)&&d._renderSelf();Ld(this,e.T,e.assignedNodes);if(d=e.qa){for(f=0;f<d.length;f++)B(d[f]).ga=null;e.qa=null;d.length>e.assignedNodes.length&&(e.ia=!0);}e.ia&&(e.ia=!1,Md(this,c));}c=this.a;b=[];for(e=0;e<c.length;e++)d=c[e].__shady_parentNode,(f=B(d))&&f.root||!(0>b.indexOf(d))||b.push(d);for(c=0;c<b.length;c++){f=b[c];e=f===this?this.host:f;d=[];for(f=f.__shady_firstChild;f;f=f.__shady_nextSibling)if("slot"==f.localName)for(var g=B(f).T,h=0;h<
g.length;h++)d.push(g[h]);else d.push(f);f=Db(e);g=Rc(d,d.length,f,f.length);for(var k=h=0,l=void 0;h<g.length&&(l=g[h]);h++){for(var m=0,q=void 0;m<l.X.length&&(q=l.X[m]);m++)q.__shady_native_parentNode===e&&e.__shady_native_removeChild(q),f.splice(l.index+k,1);k-=l.ba;}k=0;for(l=void 0;k<g.length&&(l=g[k]);k++)for(h=f[l.index],m=l.index;m<l.index+l.ba;m++)q=d[m],e.__shady_native_insertBefore(q,h),f.splice(m,0,q);}}if(!L.preferPerformance&&!this.pa)for(b=this.host.__shady_firstChild;b;b=b.__shady_nextSibling)c=
B(b),b.__shady_native_parentNode!==this.host||"slot"!==b.localName&&c.assignedSlot||this.host.__shady_native_removeChild(b);this.pa=!0;Dd=a;Ed&&Ed();};function Kd(a,b,c){var d=A(b),e=d.ga;d.ga=null;c||(c=(a=a.b[b.__shady_slot||"__catchall"])&&a[0]);c?(A(c).assignedNodes.push(b),d.assignedSlot=c):d.assignedSlot=void 0;e!==d.assignedSlot&&d.assignedSlot&&(A(d.assignedSlot).ia=!0);}
function Ld(a,b,c){for(var d=0,e=void 0;d<c.length&&(e=c[d]);d++)if("slot"==e.localName){var f=B(e).assignedNodes;f&&f.length&&Ld(a,b,f);}else b.push(c[d]);}function Md(a,b){b.__shady_native_dispatchEvent(new Event("slotchange"));b=B(b);b.assignedSlot&&Md(a,b.assignedSlot);}function md(a){a.c=a.c||[];a.a=a.a||[];a.b=a.b||{};}
function Jd(a){if(a.c&&a.c.length){for(var b=a.c,c,d=0;d<b.length;d++){var e=b[d];Wc(e);var f=e.__shady_parentNode;Wc(f);f=B(f);f.aa=(f.aa||0)+1;f=Nd(e);a.b[f]?(c=c||{},c[f]=!0,a.b[f].push(e)):a.b[f]=[e];a.a.push(e);}if(c)for(var g in c)a.b[g]=Od(a.b[g]);a.c=[];}}function Nd(a){var b=a.name||a.getAttribute("name")||"__catchall";return a.Ba=b}
function Od(a){return a.sort(function(b,c){b=Fd(b);for(var d=Fd(c),e=0;e<b.length;e++){c=b[e];var f=d[e];if(c!==f)return b=Eb(c.__shady_parentNode),b.indexOf(c)-b.indexOf(f)}})}
function od(a,b){if(a.a){Jd(a);var c=a.b,d;for(d in c)for(var e=c[d],f=0;f<e.length;f++){var g=e[f];if(Bb(b,g)){e.splice(f,1);var h=a.a.indexOf(g);0<=h&&(a.a.splice(h,1),(h=B(g.__shady_parentNode))&&h.aa&&h.aa--);f--;g=B(g);if(h=g.T)for(var k=0;k<h.length;k++){var l=h[k],m=l.__shady_native_parentNode;m&&m.__shady_native_removeChild(l);}g.T=[];g.assignedNodes=[];h=!0;}}return h}}function tb(a){Jd(a);return !(!a.a||!a.a.length)}
(function(a){a.__proto__=DocumentFragment.prototype;Bd(a,"__shady_");Bd(a);Object.defineProperties(a,{nodeType:{value:Node.DOCUMENT_FRAGMENT_NODE,configurable:!0},nodeName:{value:"#document-fragment",configurable:!0},nodeValue:{value:null,configurable:!0}});["localName","namespaceURI","prefix"].forEach(function(b){Object.defineProperty(a,b,{value:void 0,configurable:!0});});["ownerDocument","baseURI","isConnected"].forEach(function(b){Object.defineProperty(a,b,{get:function(){return this.host[b]},
configurable:!0});});})(Gd.prototype);
if(window.customElements&&L.ja&&!L.preferPerformance){var Pd=new Map;Ed=function(){var a=[];Pd.forEach(function(d,e){a.push([e,d]);});Pd.clear();for(var b=0;b<a.length;b++){var c=a[b][0];a[b][1]?c.__shadydom_connectedCallback():c.__shadydom_disconnectedCallback();}};Dd&&document.addEventListener("readystatechange",function(){Dd=!1;Ed();},{once:!0});var Qd=function(a,b,c){var d=0,e="__isConnected"+d++;if(b||c)a.prototype.connectedCallback=a.prototype.__shadydom_connectedCallback=function(){Dd?Pd.set(this,
!0):this[e]||(this[e]=!0,b&&b.call(this));},a.prototype.disconnectedCallback=a.prototype.__shadydom_disconnectedCallback=function(){Dd?this.isConnected||Pd.set(this,!1):this[e]&&(this[e]=!1,c&&c.call(this));};return a},Rd=window.customElements.define,define=function(a,b){var c=b.prototype.connectedCallback,d=b.prototype.disconnectedCallback;Rd.call(window.customElements,a,Qd(b,c,d));b.prototype.connectedCallback=c;b.prototype.disconnectedCallback=d;};window.customElements.define=define;Object.defineProperty(window.CustomElementRegistry.prototype,
"define",{value:define,configurable:!0});}function ld(a){a=a.__shady_getRootNode();if(M(a))return a}function Sd(a){this.node=a;}w=Sd.prototype;w.addEventListener=function(a,b,c){return this.node.__shady_addEventListener(a,b,c)};w.removeEventListener=function(a,b,c){return this.node.__shady_removeEventListener(a,b,c)};w.appendChild=function(a){return this.node.__shady_appendChild(a)};w.insertBefore=function(a,b){return this.node.__shady_insertBefore(a,b)};w.removeChild=function(a){return this.node.__shady_removeChild(a)};w.replaceChild=function(a,b){return this.node.__shady_replaceChild(a,b)};
w.cloneNode=function(a){return this.node.__shady_cloneNode(a)};w.getRootNode=function(a){return this.node.__shady_getRootNode(a)};w.contains=function(a){return this.node.__shady_contains(a)};w.dispatchEvent=function(a){return this.node.__shady_dispatchEvent(a)};w.setAttribute=function(a,b){this.node.__shady_setAttribute(a,b);};w.getAttribute=function(a){return this.node.__shady_native_getAttribute(a)};w.hasAttribute=function(a){return this.node.__shady_native_hasAttribute(a)};w.removeAttribute=function(a){this.node.__shady_removeAttribute(a);};
w.attachShadow=function(a){return this.node.__shady_attachShadow(a)};w.focus=function(){this.node.__shady_native_focus();};w.blur=function(){this.node.__shady_blur();};w.importNode=function(a,b){if(this.node.nodeType===Node.DOCUMENT_NODE)return this.node.__shady_importNode(a,b)};w.getElementById=function(a){if(this.node.nodeType===Node.DOCUMENT_NODE)return this.node.__shady_getElementById(a)};w.querySelector=function(a){return this.node.__shady_querySelector(a)};
w.querySelectorAll=function(a,b){return this.node.__shady_querySelectorAll(a,b)};w.assignedNodes=function(a){if("slot"===this.node.localName)return this.node.__shady_assignedNodes(a)};
ea.Object.defineProperties(Sd.prototype,{activeElement:{configurable:!0,enumerable:!0,get:function(){if(M(this.node)||this.node.nodeType===Node.DOCUMENT_NODE)return this.node.__shady_activeElement}},_activeElement:{configurable:!0,enumerable:!0,get:function(){return this.activeElement}},host:{configurable:!0,enumerable:!0,get:function(){if(M(this.node))return this.node.host}},parentNode:{configurable:!0,enumerable:!0,get:function(){return this.node.__shady_parentNode}},firstChild:{configurable:!0,
enumerable:!0,get:function(){return this.node.__shady_firstChild}},lastChild:{configurable:!0,enumerable:!0,get:function(){return this.node.__shady_lastChild}},nextSibling:{configurable:!0,enumerable:!0,get:function(){return this.node.__shady_nextSibling}},previousSibling:{configurable:!0,enumerable:!0,get:function(){return this.node.__shady_previousSibling}},childNodes:{configurable:!0,enumerable:!0,get:function(){return this.node.__shady_childNodes}},parentElement:{configurable:!0,enumerable:!0,
get:function(){return this.node.__shady_parentElement}},firstElementChild:{configurable:!0,enumerable:!0,get:function(){return this.node.__shady_firstElementChild}},lastElementChild:{configurable:!0,enumerable:!0,get:function(){return this.node.__shady_lastElementChild}},nextElementSibling:{configurable:!0,enumerable:!0,get:function(){return this.node.__shady_nextElementSibling}},previousElementSibling:{configurable:!0,enumerable:!0,get:function(){return this.node.__shady_previousElementSibling}},
children:{configurable:!0,enumerable:!0,get:function(){return this.node.__shady_children}},childElementCount:{configurable:!0,enumerable:!0,get:function(){return this.node.__shady_childElementCount}},shadowRoot:{configurable:!0,enumerable:!0,get:function(){return this.node.__shady_shadowRoot}},assignedSlot:{configurable:!0,enumerable:!0,get:function(){return this.node.__shady_assignedSlot}},isConnected:{configurable:!0,enumerable:!0,get:function(){return this.node.__shady_isConnected}},innerHTML:{configurable:!0,
enumerable:!0,get:function(){return this.node.__shady_innerHTML},set:function(a){this.node.__shady_innerHTML=a;}},textContent:{configurable:!0,enumerable:!0,get:function(){return this.node.__shady_textContent},set:function(a){this.node.__shady_textContent=a;}},slot:{configurable:!0,enumerable:!0,get:function(){return this.node.__shady_slot},set:function(a){this.node.__shady_slot=a;}},className:{configurable:!0,enumerable:!0,get:function(){return this.node.__shady_className},set:function(a){return this.node.__shady_className=
a}}});Pc.forEach(function(a){Object.defineProperty(Sd.prototype,a,{get:function(){return this.node["__shady_"+a]},set:function(b){this.node["__shady_"+a]=b;},configurable:!0});});var Td=new WeakMap;function Ud(a){if(M(a)||a instanceof Sd)return a;var b=Td.get(a);b||(b=new Sd(a),Td.set(a,b));return b}var Vd=P({dispatchEvent:Fc,addEventListener:Gc,removeEventListener:Ic});var Wd=P({get assignedSlot(){var a=this.__shady_parentNode;(a=a&&a.__shady_shadowRoot)&&Id(a);return (a=B(this))&&a.assignedSlot||null}});var Xd=window.document;function Yd(a,b){if("slot"===b)a=a.__shady_parentNode,sb(a)&&nd(B(a).root);else if("slot"===a.localName&&"name"===b&&(b=ld(a))){if(b.a){Jd(b);var c=a.Ba,d=Nd(a);if(d!==c){c=b.b[c];var e=c.indexOf(a);0<=e&&c.splice(e,1);c=b.b[d]||(b.b[d]=[]);c.push(a);1<c.length&&(b.b[d]=Od(c));}}nd(b);}}
var Zd=P({get previousElementSibling(){var a=B(this);if(a&&void 0!==a.previousSibling){for(a=this.__shady_previousSibling;a&&a.nodeType!==Node.ELEMENT_NODE;)a=a.__shady_previousSibling;return a}return this.__shady_native_previousElementSibling},get nextElementSibling(){var a=B(this);if(a&&void 0!==a.nextSibling){for(a=this.__shady_nextSibling;a&&a.nodeType!==Node.ELEMENT_NODE;)a=a.__shady_nextSibling;return a}return this.__shady_native_nextElementSibling},get slot(){return this.getAttribute("slot")},
set slot(a){this.__shady_setAttribute("slot",a);},get shadowRoot(){var a=B(this);return a&&a.Ta||null},get className(){return this.getAttribute("class")||""},set className(a){this.__shady_setAttribute("class",a);},setAttribute:function(a,b){this.ownerDocument!==Xd?this.__shady_native_setAttribute(a,b):Zc(this,a,b)||(this.__shady_native_setAttribute(a,b),Yd(this,a));},removeAttribute:function(a){this.ownerDocument!==Xd?this.__shady_native_removeAttribute(a):Zc(this,a,"")?""===this.getAttribute(a)&&this.__shady_native_removeAttribute(a):
(this.__shady_native_removeAttribute(a),Yd(this,a));},attachShadow:function(a){if(!this)throw Error("Must provide a host.");if(!a)throw Error("Not enough arguments.");if(a.shadyUpgradeFragment&&!L.ya){var b=a.shadyUpgradeFragment;b.__proto__=ShadowRoot.prototype;Hd(b,this,a);Wc(b,b);a=b.__noInsertionPoint?null:b.querySelectorAll("slot");b.__noInsertionPoint=void 0;if(a&&a.length){var c=b;md(c);c.c.push.apply(c.c,da(a));nd(b);}b.host.__shady_native_appendChild(b);}else b=new Gd(Cd,this,a);return b}});var $d=P({blur:function(){var a=B(this);(a=(a=a&&a.root)&&a.activeElement)?a.__shady_blur():this.__shady_native_blur();}});Pc.forEach(function(a){$d[a]={set:function(b){var c=A(this),d=a.substring(2);c.N||(c.N={});c.N[a]&&this.removeEventListener(d,c.N[a]);this.__shady_addEventListener(d,b);c.N[a]=b;},get:function(){var b=B(this);return b&&b.N&&b.N[a]},configurable:!0};});var ae=P({assignedNodes:function(a){if("slot"===this.localName){var b=this.__shady_getRootNode();b&&M(b)&&Id(b);return (b=B(this))?(a&&a.flatten?b.T:b.assignedNodes)||[]:[]}},addEventListener:function(a,b,c){if("slot"!==this.localName||"slotchange"===a)Gc.call(this,a,b,c);else{"object"!==typeof c&&(c={capture:!!c});var d=this.__shady_parentNode;if(!d)throw Error("ShadyDOM cannot attach event to slot unless it has a `parentNode`");c.O=this;d.__shady_addEventListener(a,b,c);}},removeEventListener:function(a,
b,c){if("slot"!==this.localName||"slotchange"===a)Ic.call(this,a,b,c);else{"object"!==typeof c&&(c={capture:!!c});var d=this.__shady_parentNode;if(!d)throw Error("ShadyDOM cannot attach event to slot unless it has a `parentNode`");c.O=this;d.__shady_removeEventListener(a,b,c);}}});var be=window.document,ce=P({importNode:function(a,b){if(a.ownerDocument!==be||"template"===a.localName)return this.__shady_native_importNode(a,b);var c=this.__shady_native_importNode(a,!1);if(b)for(a=a.__shady_firstChild;a;a=a.__shady_nextSibling)b=this.__shady_importNode(a,!0),c.__shady_appendChild(b);return c}});var de=P({dispatchEvent:Fc,addEventListener:Gc.bind(window),removeEventListener:Ic.bind(window)});var ee={};Object.getOwnPropertyDescriptor(HTMLElement.prototype,"parentElement")&&(ee.parentElement=pd.parentElement);Object.getOwnPropertyDescriptor(HTMLElement.prototype,"contains")&&(ee.contains=pd.contains);Object.getOwnPropertyDescriptor(HTMLElement.prototype,"children")&&(ee.children=td.children);Object.getOwnPropertyDescriptor(HTMLElement.prototype,"innerHTML")&&(ee.innerHTML=zd.innerHTML);Object.getOwnPropertyDescriptor(HTMLElement.prototype,"className")&&(ee.className=Zd.className);
var fe={EventTarget:[Vd],Node:[pd,window.EventTarget?null:Vd],Text:[Wd],Element:[Zd,td,Wd,!L.F||"innerHTML"in Element.prototype?zd:null,window.HTMLSlotElement?null:ae],HTMLElement:[$d,ee],HTMLSlotElement:[ae],DocumentFragment:[vd,wd],Document:[ce,vd,wd,xd],Window:[de]},ge=L.F?null:["innerHTML","textContent"];function he(a){var b=a?null:ge,c={},d;for(d in fe)c.Z=window[d]&&window[d].prototype,fe[d].forEach(function(e){return function(f){return e.Z&&f&&O(e.Z,f,a,b)}}(c)),c={Z:c.Z};}if(L.ja){var ShadyDOM={inUse:L.ja,patch:function(a){oc(a);nc(a);return a},isShadyRoot:M,enqueue:Hb,flush:Ib,flushInitial:function(a){!a.pa&&a.R&&Id(a);},settings:L,filterMutations:Nb,observeChildren:Lb,unobserveChildren:Mb,deferConnectionCallbacks:L.deferConnectionCallbacks,preferPerformance:L.preferPerformance,handlesDynamicScoping:!0,wrap:L.M?Ud:function(a){return a},Wrapper:Sd,composedPath:xc,noPatch:L.M,nativeMethods:Yb,nativeTree:Zb};window.ShadyDOM=ShadyDOM;hc();he("__shady_");Object.defineProperty(document,
"_activeElement",xd.activeElement);O(Window.prototype,de,"__shady_");L.M||(he(),Oc());Jc();window.Event=Lc;window.CustomEvent=Mc;window.MouseEvent=Nc;window.ShadowRoot=Gd;}var ie=window.Document.prototype.createElement,je=window.Document.prototype.createElementNS,ke=window.Document.prototype.importNode,le=window.Document.prototype.prepend,me=window.Document.prototype.append,ne=window.DocumentFragment.prototype.prepend,oe=window.DocumentFragment.prototype.append,pe=window.Node.prototype.cloneNode,qe=window.Node.prototype.appendChild,re=window.Node.prototype.insertBefore,se=window.Node.prototype.removeChild,te=window.Node.prototype.replaceChild,ue=Object.getOwnPropertyDescriptor(window.Node.prototype,
"textContent"),ve=window.Element.prototype.attachShadow,we=Object.getOwnPropertyDescriptor(window.Element.prototype,"innerHTML"),xe=window.Element.prototype.getAttribute,ye=window.Element.prototype.setAttribute,ze=window.Element.prototype.removeAttribute,Ae=window.Element.prototype.getAttributeNS,Be=window.Element.prototype.setAttributeNS,Ce=window.Element.prototype.removeAttributeNS,De=window.Element.prototype.insertAdjacentElement,Ee=window.Element.prototype.insertAdjacentHTML,Fe=window.Element.prototype.prepend,
Ge=window.Element.prototype.append,He=window.Element.prototype.before,Ie=window.Element.prototype.after,Je=window.Element.prototype.replaceWith,Ke=window.Element.prototype.remove,Le=window.HTMLElement,Me=Object.getOwnPropertyDescriptor(window.HTMLElement.prototype,"innerHTML"),Ne=window.HTMLElement.prototype.insertAdjacentElement,Oe=window.HTMLElement.prototype.insertAdjacentHTML;var Pe=new Set;"annotation-xml color-profile font-face font-face-src font-face-uri font-face-format font-face-name missing-glyph".split(" ").forEach(function(a){return Pe.add(a)});function Qe(a){var b=Pe.has(a);a=/^[a-z][.0-9_a-z]*-[\-.0-9_a-z]*$/.test(a);return !b&&a}var Re=document.contains?document.contains.bind(document):document.documentElement.contains.bind(document.documentElement);
function S(a){var b=a.isConnected;if(void 0!==b)return b;if(Re(a))return !0;for(;a&&!(a.__CE_isImportDocument||a instanceof Document);)a=a.parentNode||(window.ShadowRoot&&a instanceof ShadowRoot?a.host:void 0);return !(!a||!(a.__CE_isImportDocument||a instanceof Document))}function Se(a){var b=a.children;if(b)return Array.prototype.slice.call(b);b=[];for(a=a.firstChild;a;a=a.nextSibling)a.nodeType===Node.ELEMENT_NODE&&b.push(a);return b}
function Te(a,b){for(;b&&b!==a&&!b.nextSibling;)b=b.parentNode;return b&&b!==a?b.nextSibling:null}
function Ue(a,b,c){for(var d=a;d;){if(d.nodeType===Node.ELEMENT_NODE){var e=d;b(e);var f=e.localName;if("link"===f&&"import"===e.getAttribute("rel")){d=e.import;void 0===c&&(c=new Set);if(d instanceof Node&&!c.has(d))for(c.add(d),d=d.firstChild;d;d=d.nextSibling)Ue(d,b,c);d=Te(a,e);continue}else if("template"===f){d=Te(a,e);continue}if(e=e.__CE_shadowRoot)for(e=e.firstChild;e;e=e.nextSibling)Ue(e,b,c);}d=d.firstChild?d.firstChild:Te(a,d);}}function T(a,b,c){a[b]=c;}function Ve(a){var b=document;this.b=a;this.a=b;this.P=void 0;We(this.b,this.a);"loading"===this.a.readyState&&(this.P=new MutationObserver(this.c.bind(this)),this.P.observe(this.a,{childList:!0,subtree:!0}));}function Xe(a){a.P&&a.P.disconnect();}Ve.prototype.c=function(a){var b=this.a.readyState;"interactive"!==b&&"complete"!==b||Xe(this);for(b=0;b<a.length;b++)for(var c=a[b].addedNodes,d=0;d<c.length;d++)We(this.b,c[d]);};function Ye(){var a=this;this.a=this.w=void 0;this.b=new Promise(function(b){a.a=b;a.w&&b(a.w);});}Ye.prototype.resolve=function(a){if(this.w)throw Error("Already resolved.");this.w=a;this.a&&this.a(a);};function U(a){this.f=new Map;this.u=new Map;this.sa=new Map;this.U=!1;this.b=a;this.ka=new Map;this.c=function(b){return b()};this.a=!1;this.D=[];this.ua=a.f?new Ve(a):void 0;}w=U.prototype;w.Ra=function(a,b){var c=this;if(!(b instanceof Function))throw new TypeError("Custom element constructor getters must be functions.");Ze(this,a);this.f.set(a,b);this.D.push(a);this.a||(this.a=!0,this.c(function(){return $e(c)}));};
w.define=function(a,b){var c=this;if(!(b instanceof Function))throw new TypeError("Custom element constructors must be functions.");Ze(this,a);af(this,a,b);this.D.push(a);this.a||(this.a=!0,this.c(function(){return $e(c)}));};function Ze(a,b){if(!Qe(b))throw new SyntaxError("The element name '"+b+"' is not valid.");if(bf(a,b))throw Error("A custom element with name '"+b+"' has already been defined.");if(a.U)throw Error("A custom element is already being defined.");}
function af(a,b,c){a.U=!0;var d;try{var e=function(m){var q=f[m];if(void 0!==q&&!(q instanceof Function))throw Error("The '"+m+"' callback must be a function.");return q},f=c.prototype;if(!(f instanceof Object))throw new TypeError("The custom element constructor's prototype is not an object.");var g=e("connectedCallback");var h=e("disconnectedCallback");var k=e("adoptedCallback");var l=(d=e("attributeChangedCallback"))&&c.observedAttributes||[];}catch(m){throw m;}finally{a.U=!1;}c={localName:b,constructorFunction:c,
connectedCallback:g,disconnectedCallback:h,adoptedCallback:k,attributeChangedCallback:d,observedAttributes:l,constructionStack:[]};a.u.set(b,c);a.sa.set(c.constructorFunction,c);return c}w.upgrade=function(a){We(this.b,a);};
function $e(a){if(!1!==a.a){a.a=!1;for(var b=[],c=a.D,d=new Map,e=0;e<c.length;e++)d.set(c[e],[]);We(a.b,document,{upgrade:function(k){if(void 0===k.__CE_state){var l=k.localName,m=d.get(l);m?m.push(k):a.u.has(l)&&b.push(k);}}});for(e=0;e<b.length;e++)cf(a.b,b[e]);for(e=0;e<c.length;e++){for(var f=c[e],g=d.get(f),h=0;h<g.length;h++)cf(a.b,g[h]);(f=a.ka.get(f))&&f.resolve(void 0);}c.length=0;}}w.get=function(a){if(a=bf(this,a))return a.constructorFunction};
w.whenDefined=function(a){if(!Qe(a))return Promise.reject(new SyntaxError("'"+a+"' is not a valid custom element name."));var b=this.ka.get(a);if(b)return b.b;b=new Ye;this.ka.set(a,b);var c=this.u.has(a)||this.f.has(a);a=-1===this.D.indexOf(a);c&&a&&b.resolve(void 0);return b.b};w.polyfillWrapFlushCallback=function(a){this.ua&&Xe(this.ua);var b=this.c;this.c=function(c){return a(function(){return b(c)})};};
function bf(a,b){var c=a.u.get(b);if(c)return c;if(c=a.f.get(b)){a.f.delete(b);try{return af(a,b,c())}catch(d){df(d);}}}window.CustomElementRegistry=U;U.prototype.define=U.prototype.define;U.prototype.upgrade=U.prototype.upgrade;U.prototype.get=U.prototype.get;U.prototype.whenDefined=U.prototype.whenDefined;U.prototype.polyfillDefineLazy=U.prototype.Ra;U.prototype.polyfillWrapFlushCallback=U.prototype.polyfillWrapFlushCallback;function ef(){var a=ff&&ff.noDocumentConstructionObserver,b=ff&&ff.shadyDomFastWalk;this.b=[];this.c=[];this.a=!1;this.shadyDomFastWalk=b;this.f=!a;}function gf(a,b,c,d){var e=window.ShadyDOM;if(a.shadyDomFastWalk&&e&&e.inUse){if(b.nodeType===Node.ELEMENT_NODE&&c(b),b.querySelectorAll)for(a=e.nativeMethods.querySelectorAll.call(b,"*"),b=0;b<a.length;b++)c(a[b]);}else Ue(b,c,d);}function hf(a,b){a.a=!0;a.b.push(b);}function jf(a,b){a.a=!0;a.c.push(b);}
function kf(a,b){a.a&&gf(a,b,function(c){return lf(a,c)});}function lf(a,b){if(a.a&&!b.__CE_patched){b.__CE_patched=!0;for(var c=0;c<a.b.length;c++)a.b[c](b);for(c=0;c<a.c.length;c++)a.c[c](b);}}function mf(a,b){var c=[];gf(a,b,function(e){return c.push(e)});for(b=0;b<c.length;b++){var d=c[b];1===d.__CE_state?a.connectedCallback(d):cf(a,d);}}function nf(a,b){var c=[];gf(a,b,function(e){return c.push(e)});for(b=0;b<c.length;b++){var d=c[b];1===d.__CE_state&&a.disconnectedCallback(d);}}
function We(a,b,c){c=void 0===c?{}:c;var d=c.$a,e=c.upgrade||function(g){return cf(a,g)},f=[];gf(a,b,function(g){a.a&&lf(a,g);if("link"===g.localName&&"import"===g.getAttribute("rel")){var h=g.import;h instanceof Node&&(h.__CE_isImportDocument=!0,h.__CE_registry=document.__CE_registry);h&&"complete"===h.readyState?h.__CE_documentLoadHandled=!0:g.addEventListener("load",function(){var k=g.import;if(!k.__CE_documentLoadHandled){k.__CE_documentLoadHandled=!0;var l=new Set;d&&(d.forEach(function(m){return l.add(m)}),
l.delete(k));We(a,k,{$a:l,upgrade:e});}});}else f.push(g);},d);for(b=0;b<f.length;b++)e(f[b]);}
function cf(a,b){try{var c=b.ownerDocument,d=c.__CE_registry;var e=d&&(c.defaultView||c.__CE_isImportDocument)?bf(d,b.localName):void 0;if(e&&void 0===b.__CE_state){e.constructionStack.push(b);try{try{if(new e.constructorFunction!==b)throw Error("The custom element constructor did not produce the element being upgraded.");}finally{e.constructionStack.pop();}}catch(k){throw b.__CE_state=2,k;}b.__CE_state=1;b.__CE_definition=e;if(e.attributeChangedCallback&&b.hasAttributes()){var f=e.observedAttributes;
for(e=0;e<f.length;e++){var g=f[e],h=b.getAttribute(g);null!==h&&a.attributeChangedCallback(b,g,null,h,null);}}S(b)&&a.connectedCallback(b);}}catch(k){df(k);}}ef.prototype.connectedCallback=function(a){var b=a.__CE_definition;if(b.connectedCallback)try{b.connectedCallback.call(a);}catch(c){df(c);}};ef.prototype.disconnectedCallback=function(a){var b=a.__CE_definition;if(b.disconnectedCallback)try{b.disconnectedCallback.call(a);}catch(c){df(c);}};
ef.prototype.attributeChangedCallback=function(a,b,c,d,e){var f=a.__CE_definition;if(f.attributeChangedCallback&&-1<f.observedAttributes.indexOf(b))try{f.attributeChangedCallback.call(a,b,c,d,e);}catch(g){df(g);}};
function of(a,b,c,d){var e=b.__CE_registry;if(e&&(null===d||"http://www.w3.org/1999/xhtml"===d)&&(e=bf(e,c)))try{var f=new e.constructorFunction;if(void 0===f.__CE_state||void 0===f.__CE_definition)throw Error("Failed to construct '"+c+"': The returned value was not constructed with the HTMLElement constructor.");if("http://www.w3.org/1999/xhtml"!==f.namespaceURI)throw Error("Failed to construct '"+c+"': The constructed element's namespace must be the HTML namespace.");if(f.hasAttributes())throw Error("Failed to construct '"+
c+"': The constructed element must not have any attributes.");if(null!==f.firstChild)throw Error("Failed to construct '"+c+"': The constructed element must not have any children.");if(null!==f.parentNode)throw Error("Failed to construct '"+c+"': The constructed element must not have a parent node.");if(f.ownerDocument!==b)throw Error("Failed to construct '"+c+"': The constructed element's owner document is incorrect.");if(f.localName!==c)throw Error("Failed to construct '"+c+"': The constructed element's local name is incorrect.");
return f}catch(g){return df(g),b=null===d?ie.call(b,c):je.call(b,d,c),Object.setPrototypeOf(b,HTMLUnknownElement.prototype),b.__CE_state=2,b.__CE_definition=void 0,lf(a,b),b}b=null===d?ie.call(b,c):je.call(b,d,c);lf(a,b);return b}
function df(a){var b=a.message,c=a.sourceURL||a.fileName||"",d=a.line||a.lineNumber||0,e=a.column||a.columnNumber||0,f=void 0;void 0===ErrorEvent.prototype.initErrorEvent?f=new ErrorEvent("error",{cancelable:!0,message:b,filename:c,lineno:d,colno:e,error:a}):(f=document.createEvent("ErrorEvent"),f.initErrorEvent("error",!1,!0,b,c,d),f.preventDefault=function(){Object.defineProperty(this,"defaultPrevented",{configurable:!0,get:function(){return !0}});});void 0===f.error&&Object.defineProperty(f,"error",
{configurable:!0,enumerable:!0,get:function(){return a}});window.dispatchEvent(f);f.defaultPrevented||console.error(a);}var pf=new function(){};function qf(a){window.HTMLElement=function(){function b(){var c=this.constructor;var d=document.__CE_registry.sa.get(c);if(!d)throw Error("Failed to construct a custom element: The constructor was not registered with `customElements`.");var e=d.constructionStack;if(0===e.length)return e=ie.call(document,d.localName),Object.setPrototypeOf(e,c.prototype),e.__CE_state=1,e.__CE_definition=d,lf(a,e),e;var f=e.length-1,g=e[f];if(g===pf)throw Error("Failed to construct '"+d.localName+"': This element was already constructed.");
e[f]=pf;Object.setPrototypeOf(g,c.prototype);lf(a,g);return g}b.prototype=Le.prototype;Object.defineProperty(b.prototype,"constructor",{writable:!0,configurable:!0,enumerable:!1,value:b});return b}();}function rf(a,b,c){function d(e){return function(f){for(var g=[],h=0;h<arguments.length;++h)g[h]=arguments[h];h=[];for(var k=[],l=0;l<g.length;l++){var m=g[l];m instanceof Element&&S(m)&&k.push(m);if(m instanceof DocumentFragment)for(m=m.firstChild;m;m=m.nextSibling)h.push(m);else h.push(m);}e.apply(this,g);for(g=0;g<k.length;g++)nf(a,k[g]);if(S(this))for(g=0;g<h.length;g++)k=h[g],k instanceof Element&&mf(a,k);}}void 0!==c.prepend&&T(b,"prepend",d(c.prepend));void 0!==c.append&&T(b,"append",d(c.append));}
function sf(a){T(Document.prototype,"createElement",function(b){return of(a,this,b,null)});T(Document.prototype,"importNode",function(b,c){b=ke.call(this,b,!!c);this.__CE_registry?We(a,b):kf(a,b);return b});T(Document.prototype,"createElementNS",function(b,c){return of(a,this,c,b)});rf(a,Document.prototype,{prepend:le,append:me});}function tf(a){function b(c,d){Object.defineProperty(c,"textContent",{enumerable:d.enumerable,configurable:!0,get:d.get,set:function(e){if(this.nodeType===Node.TEXT_NODE)d.set.call(this,e);else{var f=void 0;if(this.firstChild){var g=this.childNodes,h=g.length;if(0<h&&S(this)){f=Array(h);for(var k=0;k<h;k++)f[k]=g[k];}}d.set.call(this,e);if(f)for(e=0;e<f.length;e++)nf(a,f[e]);}}});}T(Node.prototype,"insertBefore",function(c,d){if(c instanceof DocumentFragment){var e=Se(c);c=re.call(this,c,d);if(S(this))for(d=
0;d<e.length;d++)mf(a,e[d]);return c}e=c instanceof Element&&S(c);d=re.call(this,c,d);e&&nf(a,c);S(this)&&mf(a,c);return d});T(Node.prototype,"appendChild",function(c){if(c instanceof DocumentFragment){var d=Se(c);c=qe.call(this,c);if(S(this))for(var e=0;e<d.length;e++)mf(a,d[e]);return c}d=c instanceof Element&&S(c);e=qe.call(this,c);d&&nf(a,c);S(this)&&mf(a,c);return e});T(Node.prototype,"cloneNode",function(c){c=pe.call(this,!!c);this.ownerDocument.__CE_registry?We(a,c):kf(a,c);return c});T(Node.prototype,
"removeChild",function(c){var d=c instanceof Element&&S(c),e=se.call(this,c);d&&nf(a,c);return e});T(Node.prototype,"replaceChild",function(c,d){if(c instanceof DocumentFragment){var e=Se(c);c=te.call(this,c,d);if(S(this))for(nf(a,d),d=0;d<e.length;d++)mf(a,e[d]);return c}e=c instanceof Element&&S(c);var f=te.call(this,c,d),g=S(this);g&&nf(a,d);e&&nf(a,c);g&&mf(a,c);return f});ue&&ue.get?b(Node.prototype,ue):hf(a,function(c){b(c,{enumerable:!0,configurable:!0,get:function(){for(var d=[],e=this.firstChild;e;e=
e.nextSibling)e.nodeType!==Node.COMMENT_NODE&&d.push(e.textContent);return d.join("")},set:function(d){for(;this.firstChild;)se.call(this,this.firstChild);null!=d&&""!==d&&qe.call(this,document.createTextNode(d));}});});}function uf(a){function b(d){return function(e){for(var f=[],g=0;g<arguments.length;++g)f[g]=arguments[g];g=[];for(var h=[],k=0;k<f.length;k++){var l=f[k];l instanceof Element&&S(l)&&h.push(l);if(l instanceof DocumentFragment)for(l=l.firstChild;l;l=l.nextSibling)g.push(l);else g.push(l);}d.apply(this,f);for(f=0;f<h.length;f++)nf(a,h[f]);if(S(this))for(f=0;f<g.length;f++)h=g[f],h instanceof Element&&mf(a,h);}}var c=Element.prototype;void 0!==He&&T(c,"before",b(He));void 0!==Ie&&T(c,"after",b(Ie));void 0!==
Je&&T(c,"replaceWith",function(d){for(var e=[],f=0;f<arguments.length;++f)e[f]=arguments[f];f=[];for(var g=[],h=0;h<e.length;h++){var k=e[h];k instanceof Element&&S(k)&&g.push(k);if(k instanceof DocumentFragment)for(k=k.firstChild;k;k=k.nextSibling)f.push(k);else f.push(k);}h=S(this);Je.apply(this,e);for(e=0;e<g.length;e++)nf(a,g[e]);if(h)for(nf(a,this),e=0;e<f.length;e++)g=f[e],g instanceof Element&&mf(a,g);});void 0!==Ke&&T(c,"remove",function(){var d=S(this);Ke.call(this);d&&nf(a,this);});}function vf(a){function b(e,f){Object.defineProperty(e,"innerHTML",{enumerable:f.enumerable,configurable:!0,get:f.get,set:function(g){var h=this,k=void 0;S(this)&&(k=[],gf(a,this,function(q){q!==h&&k.push(q);}));f.set.call(this,g);if(k)for(var l=0;l<k.length;l++){var m=k[l];1===m.__CE_state&&a.disconnectedCallback(m);}this.ownerDocument.__CE_registry?We(a,this):kf(a,this);return g}});}function c(e,f){T(e,"insertAdjacentElement",function(g,h){var k=S(h);g=f.call(this,g,h);k&&nf(a,h);S(g)&&mf(a,h);return g});}
function d(e,f){function g(h,k){for(var l=[];h!==k;h=h.nextSibling)l.push(h);for(k=0;k<l.length;k++)We(a,l[k]);}T(e,"insertAdjacentHTML",function(h,k){h=h.toLowerCase();if("beforebegin"===h){var l=this.previousSibling;f.call(this,h,k);g(l||this.parentNode.firstChild,this);}else if("afterbegin"===h)l=this.firstChild,f.call(this,h,k),g(this.firstChild,l);else if("beforeend"===h)l=this.lastChild,f.call(this,h,k),g(l||this.firstChild,null);else if("afterend"===h)l=this.nextSibling,f.call(this,h,k),g(this.nextSibling,
l);else throw new SyntaxError("The value provided ("+String(h)+") is not one of 'beforebegin', 'afterbegin', 'beforeend', or 'afterend'.");});}ve&&T(Element.prototype,"attachShadow",function(e){e=ve.call(this,e);if(a.a&&!e.__CE_patched){e.__CE_patched=!0;for(var f=0;f<a.b.length;f++)a.b[f](e);}return this.__CE_shadowRoot=e});we&&we.get?b(Element.prototype,we):Me&&Me.get?b(HTMLElement.prototype,Me):jf(a,function(e){b(e,{enumerable:!0,configurable:!0,get:function(){return pe.call(this,!0).innerHTML},
set:function(f){var g="template"===this.localName,h=g?this.content:this,k=je.call(document,this.namespaceURI,this.localName);for(k.innerHTML=f;0<h.childNodes.length;)se.call(h,h.childNodes[0]);for(f=g?k.content:k;0<f.childNodes.length;)qe.call(h,f.childNodes[0]);}});});T(Element.prototype,"setAttribute",function(e,f){if(1!==this.__CE_state)return ye.call(this,e,f);var g=xe.call(this,e);ye.call(this,e,f);f=xe.call(this,e);a.attributeChangedCallback(this,e,g,f,null);});T(Element.prototype,"setAttributeNS",
function(e,f,g){if(1!==this.__CE_state)return Be.call(this,e,f,g);var h=Ae.call(this,e,f);Be.call(this,e,f,g);g=Ae.call(this,e,f);a.attributeChangedCallback(this,f,h,g,e);});T(Element.prototype,"removeAttribute",function(e){if(1!==this.__CE_state)return ze.call(this,e);var f=xe.call(this,e);ze.call(this,e);null!==f&&a.attributeChangedCallback(this,e,f,null,null);});T(Element.prototype,"removeAttributeNS",function(e,f){if(1!==this.__CE_state)return Ce.call(this,e,f);var g=Ae.call(this,e,f);Ce.call(this,
e,f);var h=Ae.call(this,e,f);g!==h&&a.attributeChangedCallback(this,f,g,h,e);});Ne?c(HTMLElement.prototype,Ne):De?c(Element.prototype,De):console.warn("Custom Elements: `Element#insertAdjacentElement` was not patched.");Oe?d(HTMLElement.prototype,Oe):Ee?d(Element.prototype,Ee):console.warn("Custom Elements: `Element#insertAdjacentHTML` was not patched.");rf(a,Element.prototype,{prepend:Fe,append:Ge});uf(a);}var ff=window.customElements;function wf(){var a=new ef;qf(a);sf(a);rf(a,DocumentFragment.prototype,{prepend:ne,append:oe});tf(a);vf(a);a=new U(a);document.__CE_registry=a;Object.defineProperty(window,"customElements",{configurable:!0,enumerable:!0,value:a});}ff&&!ff.forcePolyfill&&"function"==typeof ff.define&&"function"==typeof ff.get||wf();window.__CE_installPolyfill=wf;function xf(){this.end=this.start=0;this.rules=this.parent=this.previous=null;this.cssText=this.parsedCssText="";this.atRule=!1;this.type=0;this.parsedSelector=this.selector=this.keyframesName="";}
function yf(a){var b=a=a.replace(zf,"").replace(Af,""),c=new xf;c.start=0;c.end=b.length;for(var d=c,e=0,f=b.length;e<f;e++)if("{"===b[e]){d.rules||(d.rules=[]);var g=d,h=g.rules[g.rules.length-1]||null;d=new xf;d.start=e+1;d.parent=g;d.previous=h;g.rules.push(d);}else"}"===b[e]&&(d.end=e+1,d=d.parent||c);return Bf(c,a)}
function Bf(a,b){var c=b.substring(a.start,a.end-1);a.parsedCssText=a.cssText=c.trim();a.parent&&(c=b.substring(a.previous?a.previous.end:a.parent.start,a.start-1),c=Cf(c),c=c.replace(Df," "),c=c.substring(c.lastIndexOf(";")+1),c=a.parsedSelector=a.selector=c.trim(),a.atRule=0===c.indexOf("@"),a.atRule?0===c.indexOf("@media")?a.type=Ef:c.match(Ff)&&(a.type=Gf,a.keyframesName=a.selector.split(Df).pop()):a.type=0===c.indexOf("--")?Hf:If);if(c=a.rules)for(var d=0,e=c.length,f=void 0;d<e&&(f=c[d]);d++)Bf(f,
b);return a}function Cf(a){return a.replace(/\\([0-9a-f]{1,6})\s/gi,function(b,c){b=c;for(c=6-b.length;c--;)b="0"+b;return "\\"+b})}
function Jf(a,b,c){c=void 0===c?"":c;var d="";if(a.cssText||a.rules){var e=a.rules,f;if(f=e)f=e[0],f=!(f&&f.selector&&0===f.selector.indexOf("--"));if(f){f=0;for(var g=e.length,h=void 0;f<g&&(h=e[f]);f++)d=Jf(h,b,d);}else b?b=a.cssText:(b=a.cssText,b=b.replace(Kf,"").replace(Lf,""),b=b.replace(Mf,"").replace(Nf,"")),(d=b.trim())&&(d="  "+d+"\n");}d&&(a.selector&&(c+=a.selector+" {\n"),c+=d,a.selector&&(c+="}\n\n"));return c}
var If=1,Gf=7,Ef=4,Hf=1E3,zf=/\/\*[^*]*\*+([^/*][^*]*\*+)*\//gim,Af=/@import[^;]*;/gim,Kf=/(?:^[^;\-\s}]+)?--[^;{}]*?:[^{};]*?(?:[;\n]|$)/gim,Lf=/(?:^[^;\-\s}]+)?--[^;{}]*?:[^{};]*?{[^}]*?}(?:[;\n]|$)?/gim,Mf=/@apply\s*\(?[^);]*\)?\s*(?:[;\n]|$)?/gim,Nf=/[^;:]*?:[^;]*?var\([^;]*\)(?:[;\n]|$)?/gim,Ff=/^@[^\s]*keyframes/,Df=/\s+/g;var V=!(window.ShadyDOM&&window.ShadyDOM.inUse),Of;function Pf(a){Of=a&&a.shimcssproperties?!1:V||!(navigator.userAgent.match(/AppleWebKit\/601|Edge\/15/)||!window.CSS||!CSS.supports||!CSS.supports("box-shadow","0 0 0 var(--foo)"));}var Qf;window.ShadyCSS&&void 0!==window.ShadyCSS.cssBuild&&(Qf=window.ShadyCSS.cssBuild);var Rf=!(!window.ShadyCSS||!window.ShadyCSS.disableRuntime);
window.ShadyCSS&&void 0!==window.ShadyCSS.nativeCss?Of=window.ShadyCSS.nativeCss:window.ShadyCSS?(Pf(window.ShadyCSS),window.ShadyCSS=void 0):Pf(window.WebComponents&&window.WebComponents.flags);var W=Of;var Sf=/(?:^|[;\s{]\s*)(--[\w-]*?)\s*:\s*(?:((?:'(?:\\'|.)*?'|"(?:\\"|.)*?"|\([^)]*?\)|[^};{])+)|\{([^}]*)\}(?:(?=[;\s}])|$))/gi,Tf=/(?:^|\W+)@apply\s*\(?([^);\n]*)\)?/gi,Vf=/(--[\w-]+)\s*([:,;)]|$)/gi,Wf=/(animation\s*:)|(animation-name\s*:)/,Xf=/@media\s(.*)/,Yf=/\{[^}]*\}/g;var Zf=new Set;function $f(a,b){if(!a)return "";"string"===typeof a&&(a=yf(a));b&&ag(a,b);return Jf(a,W)}function bg(a){!a.__cssRules&&a.textContent&&(a.__cssRules=yf(a.textContent));return a.__cssRules||null}function cg(a){return !!a.parent&&a.parent.type===Gf}function ag(a,b,c,d){if(a){var e=!1,f=a.type;if(d&&f===Ef){var g=a.selector.match(Xf);g&&(window.matchMedia(g[1]).matches||(e=!0));}f===If?b(a):c&&f===Gf?c(a):f===Hf&&(e=!0);if((a=a.rules)&&!e)for(e=0,f=a.length,g=void 0;e<f&&(g=a[e]);e++)ag(g,b,c,d);}}
function dg(a,b,c,d){var e=document.createElement("style");b&&e.setAttribute("scope",b);e.textContent=a;eg(e,c,d);return e}var fg=null;function gg(a){a=document.createComment(" Shady DOM styles for "+a+" ");var b=document.head;b.insertBefore(a,(fg?fg.nextSibling:null)||b.firstChild);return fg=a}function eg(a,b,c){b=b||document.head;b.insertBefore(a,c&&c.nextSibling||b.firstChild);fg?a.compareDocumentPosition(fg)===Node.DOCUMENT_POSITION_PRECEDING&&(fg=a):fg=a;}
function hg(a,b){for(var c=0,d=a.length;b<d;b++)if("("===a[b])c++;else if(")"===a[b]&&0===--c)return b;return -1}function ig(a,b){var c=a.indexOf("var(");if(-1===c)return b(a,"","","");var d=hg(a,c+3),e=a.substring(c+4,d);c=a.substring(0,c);a=ig(a.substring(d+1),b);d=e.indexOf(",");return -1===d?b(c,e.trim(),"",a):b(c,e.substring(0,d).trim(),e.substring(d+1).trim(),a)}function jg(a,b){V?a.setAttribute("class",b):window.ShadyDOM.nativeMethods.setAttribute.call(a,"class",b);}
var kg=window.ShadyDOM&&window.ShadyDOM.wrap||function(a){return a};function lg(a){var b=a.localName,c="";b?-1<b.indexOf("-")||(c=b,b=a.getAttribute&&a.getAttribute("is")||""):(b=a.is,c=a.extends);return {is:b,Y:c}}function mg(a){for(var b=[],c="",d=0;0<=d&&d<a.length;d++)if("("===a[d]){var e=hg(a,d);c+=a.slice(d,e+1);d=e;}else","===a[d]?(b.push(c),c=""):c+=a[d];c&&b.push(c);return b}
function ng(a){if(void 0!==Qf)return Qf;if(void 0===a.__cssBuild){var b=a.getAttribute("css-build");if(b)a.__cssBuild=b;else{a:{b="template"===a.localName?a.content.firstChild:a.firstChild;if(b instanceof Comment&&(b=b.textContent.trim().split(":"),"css-build"===b[0])){b=b[1];break a}b="";}if(""!==b){var c="template"===a.localName?a.content.firstChild:a.firstChild;c.parentNode.removeChild(c);}a.__cssBuild=b;}}return a.__cssBuild||""}
function og(a){a=void 0===a?"":a;return ""!==a&&W?V?"shadow"===a:"shady"===a:!1}function pg(){}function qg(a,b){rg(sg,a,function(c){tg(c,b||"");});}function rg(a,b,c){b.nodeType===Node.ELEMENT_NODE&&c(b);var d;"template"===b.localName?d=(b.content||b._content||b).childNodes:d=b.children||b.childNodes;if(d)for(b=0;b<d.length;b++)rg(a,d[b],c);}
function tg(a,b,c){if(b)if(a.classList)c?(a.classList.remove("style-scope"),a.classList.remove(b)):(a.classList.add("style-scope"),a.classList.add(b));else if(a.getAttribute){var d=a.getAttribute("class");c?d&&(b=d.replace("style-scope","").replace(b,""),jg(a,b)):jg(a,(d?d+" ":"")+"style-scope "+b);}}function ug(a,b,c){rg(sg,a,function(d){tg(d,b,!0);tg(d,c);});}function vg(a,b){rg(sg,a,function(c){tg(c,b||"",!0);});}
function wg(a,b,c,d,e){var f=sg;e=void 0===e?"":e;""===e&&(V||"shady"===(void 0===d?"":d)?e=$f(b,c):(a=lg(a),e=xg(f,b,a.is,a.Y,c)+"\n\n"));return e.trim()}function xg(a,b,c,d,e){var f=yg(c,d);c=c?"."+c:"";return $f(b,function(g){g.c||(g.selector=g.B=zg(a,g,a.b,c,f),g.c=!0);e&&e(g,c,f);})}function yg(a,b){return b?"[is="+a+"]":a}
function zg(a,b,c,d,e){var f=mg(b.selector);if(!cg(b)){b=0;for(var g=f.length,h=void 0;b<g&&(h=f[b]);b++)f[b]=c.call(a,h,d,e);}return f.filter(function(k){return !!k}).join(",")}function Ag(a){return a.replace(Bg,function(b,c,d){-1<d.indexOf("+")?d=d.replace(/\+/g,"___"):-1<d.indexOf("___")&&(d=d.replace(/___/g,"+"));return ":"+c+"("+d+")"})}
function Cg(a){for(var b=[],c;c=a.match(Dg);){var d=c.index,e=hg(a,d);if(-1===e)throw Error(c.input+" selector missing ')'");c=a.slice(d,e+1);a=a.replace(c,"\ue000");b.push(c);}return {na:a,matches:b}}function Eg(a,b){var c=a.split("\ue000");return b.reduce(function(d,e,f){return d+e+c[f+1]},c[0])}
pg.prototype.b=function(a,b,c){var d=!1;a=a.trim();var e=Bg.test(a);e&&(a=a.replace(Bg,function(h,k,l){return ":"+k+"("+l.replace(/\s/g,"")+")"}),a=Ag(a));var f=Dg.test(a);if(f){var g=Cg(a);a=g.na;g=g.matches;}a=a.replace(Fg,":host $1");a=a.replace(Gg,function(h,k,l){d||(h=Hg(l,k,b,c),d=d||h.stop,k=h.Ha,l=h.value);return k+l});f&&(a=Eg(a,g));e&&(a=Ag(a));return a=a.replace(Ig,function(h,k,l,m){return '[dir="'+l+'"] '+k+m+", "+k+'[dir="'+l+'"]'+m})};
function Hg(a,b,c,d){var e=a.indexOf("::slotted");0<=a.indexOf(":host")?a=Jg(a,d):0!==e&&(a=c?Kg(a,c):a);c=!1;0<=e&&(b="",c=!0);if(c){var f=!0;c&&(a=a.replace(Lg,function(g,h){return " > "+h}));}return {value:a,Ha:b,stop:f}}function Kg(a,b){a=a.split(/(\[.+?\])/);for(var c=[],d=0;d<a.length;d++)if(1===d%2)c.push(a[d]);else{var e=a[d];if(""!==e||d!==a.length-1)e=e.split(":"),e[0]+=b,c.push(e.join(":"));}return c.join("")}
function Jg(a,b){var c=a.match(Mg);return (c=c&&c[2].trim()||"")?c[0].match(Ng)?a.replace(Mg,function(d,e,f){return b+f}):c.split(Ng)[0]===b?c:"should_not_match":a.replace(":host",b)}function Og(a){":root"===a.selector&&(a.selector="html");}pg.prototype.c=function(a){return a.match(":host")?"":a.match("::slotted")?this.b(a,":not(.style-scope)"):Kg(a.trim(),":not(.style-scope)")};ea.Object.defineProperties(pg.prototype,{a:{configurable:!0,enumerable:!0,get:function(){return "style-scope"}}});
var Bg=/:(nth[-\w]+)\(([^)]+)\)/,Gg=/(^|[\s>+~]+)((?:\[.+?\]|[^\s>+~=[])+)/g,Ng=/[[.:#*]/,Fg=/^(::slotted)/,Mg=/(:host)(?:\(((?:\([^)(]*\)|[^)(]*)+?)\))/,Lg=/(?:::slotted)(?:\(((?:\([^)(]*\)|[^)(]*)+?)\))/,Ig=/(.*):dir\((?:(ltr|rtl))\)(.*)/,Dg=/:(?:matches|any|-(?:webkit|moz)-any)/,sg=new pg;function Pg(a,b,c,d,e){this.I=a||null;this.b=b||null;this.la=c||[];this.G=null;this.cssBuild=e||"";this.Y=d||"";this.a=this.H=this.L=null;}function Qg(a){return a?a.__styleInfo:null}function Rg(a,b){return a.__styleInfo=b}Pg.prototype.c=function(){return this.I};Pg.prototype._getStyleRules=Pg.prototype.c;function Sg(a){var b=this.matches||this.matchesSelector||this.mozMatchesSelector||this.msMatchesSelector||this.oMatchesSelector||this.webkitMatchesSelector;return b&&b.call(this,a)}var Tg=/:host\s*>\s*/,Ug=navigator.userAgent.match("Trident");function Vg(){}function Wg(a){var b={},c=[],d=0;ag(a,function(f){Xg(f);f.index=d++;f=f.A.cssText;for(var g;g=Vf.exec(f);){var h=g[1];":"!==g[2]&&(b[h]=!0);}},function(f){c.push(f);});a.b=c;a=[];for(var e in b)a.push(e);return a}
function Xg(a){if(!a.A){var b={},c={};Yg(a,c)&&(b.K=c,a.rules=null);b.cssText=a.parsedCssText.replace(Yf,"").replace(Sf,"");a.A=b;}}function Yg(a,b){var c=a.A;if(c){if(c.K)return Object.assign(b,c.K),!0}else{c=a.parsedCssText;for(var d;a=Sf.exec(c);){d=(a[2]||a[3]).trim();if("inherit"!==d||"unset"!==d)b[a[1].trim()]=d;d=!0;}return d}}
function Zg(a,b,c){b&&(b=0<=b.indexOf(";")?$g(a,b,c):ig(b,function(d,e,f,g){if(!e)return d+g;(e=Zg(a,c[e],c))&&"initial"!==e?"apply-shim-inherit"===e&&(e="inherit"):e=Zg(a,c[f]||f,c)||f;return d+(e||"")+g}));return b&&b.trim()||""}
function $g(a,b,c){b=b.split(";");for(var d=0,e,f;d<b.length;d++)if(e=b[d]){Tf.lastIndex=0;if(f=Tf.exec(e))e=Zg(a,c[f[1]],c);else if(f=e.indexOf(":"),-1!==f){var g=e.substring(f);g=g.trim();g=Zg(a,g,c)||g;e=e.substring(0,f)+g;}b[d]=e&&e.lastIndexOf(";")===e.length-1?e.slice(0,-1):e||"";}return b.join(";")}
function ah(a,b){var c={},d=[];ag(a,function(e){e.A||Xg(e);var f=e.B||e.parsedSelector;b&&e.A.K&&f&&Sg.call(b,f)&&(Yg(e,c),e=e.index,f=parseInt(e/32,10),d[f]=(d[f]||0)|1<<e%32);},null,!0);return {K:c,key:d}}
function bh(a,b,c,d){b.A||Xg(b);if(b.A.K){var e=lg(a);a=e.is;e=e.Y;e=a?yg(a,e):"html";var f=b.parsedSelector;var g=!!f.match(Tg)||"html"===e&&-1<f.indexOf("html");var h=0===f.indexOf(":host")&&!g;"shady"===c&&(g=f===e+" > *."+e||-1!==f.indexOf("html"),h=!g&&0===f.indexOf(e));if(g||h)c=e,h&&(b.B||(b.B=zg(sg,b,sg.b,a?"."+a:"",e)),c=b.B||e),g&&"html"===e&&(c=b.B||b.u),d({na:c,Oa:h,bb:g});}}
function ch(a,b,c){var d={},e={};ag(b,function(f){bh(a,f,c,function(g){Sg.call(a._element||a,g.na)&&(g.Oa?Yg(f,d):Yg(f,e));});},null,!0);return {Ua:e,Ma:d}}
function dh(a,b,c,d){var e=lg(b),f=yg(e.is,e.Y),g=new RegExp("(?:^|[^.#[:])"+(b.extends?"\\"+f.slice(0,-1)+"\\]":f)+"($|[.:[\\s>+~])"),h=Qg(b);e=h.I;h=h.cssBuild;var k=eh(e,d);return wg(b,e,function(l){var m="";l.A||Xg(l);l.A.cssText&&(m=$g(a,l.A.cssText,c));l.cssText=m;if(!V&&!cg(l)&&l.cssText){var q=m=l.cssText;null==l.ra&&(l.ra=Wf.test(m));if(l.ra)if(null==l.da){l.da=[];for(var H in k)q=k[H],q=q(m),m!==q&&(m=q,l.da.push(H));}else{for(H=0;H<l.da.length;++H)q=k[l.da[H]],m=q(m);q=m;}l.cssText=q;l.B=
l.B||l.selector;m="."+d;H=mg(l.B);q=0;for(var E=H.length,r=void 0;q<E&&(r=H[q]);q++)H[q]=r.match(g)?r.replace(f,m):m+" "+r;l.selector=H.join(",");}},h)}function eh(a,b){a=a.b;var c={};if(!V&&a)for(var d=0,e=a[d];d<a.length;e=a[++d]){var f=e,g=b;f.f=new RegExp("\\b"+f.keyframesName+"(?!\\B|-)","g");f.a=f.keyframesName+"-"+g;f.B=f.B||f.selector;f.selector=f.B.replace(f.keyframesName,f.a);c[e.keyframesName]=fh(e);}return c}function fh(a){return function(b){return b.replace(a.f,a.a)}}
function gh(a,b){var c=hh,d=bg(a);a.textContent=$f(d,function(e){var f=e.cssText=e.parsedCssText;e.A&&e.A.cssText&&(f=f.replace(Kf,"").replace(Lf,""),e.cssText=$g(c,f,b));});}ea.Object.defineProperties(Vg.prototype,{a:{configurable:!0,enumerable:!0,get:function(){return "x-scope"}}});var hh=new Vg;var ih={},jh=window.customElements;if(jh&&!V&&!Rf){var kh=jh.define;jh.define=function(a,b,c){ih[a]||(ih[a]=gg(a));kh.call(jh,a,b,c);};}function lh(){this.cache={};}lh.prototype.store=function(a,b,c,d){var e=this.cache[a]||[];e.push({K:b,styleElement:c,H:d});100<e.length&&e.shift();this.cache[a]=e;};function mh(){}var nh=new RegExp(sg.a+"\\s*([^\\s]*)");function oh(a){return (a=(a.classList&&a.classList.value?a.classList.value:a.getAttribute("class")||"").match(nh))?a[1]:""}function ph(a){var b=kg(a).getRootNode();return b===a||b===a.ownerDocument?"":(a=b.host)?lg(a).is:""}
function qh(a){for(var b=0;b<a.length;b++){var c=a[b];if(c.target!==document.documentElement&&c.target!==document.head)for(var d=0;d<c.addedNodes.length;d++){var e=c.addedNodes[d];if(e.nodeType===Node.ELEMENT_NODE){var f=e.getRootNode(),g=oh(e);if(g&&f===e.ownerDocument&&("style"!==e.localName&&"template"!==e.localName||""===ng(e)))vg(e,g);else if(f instanceof ShadowRoot)for(f=ph(e),f!==g&&ug(e,g,f),e=window.ShadyDOM.nativeMethods.querySelectorAll.call(e,":not(."+sg.a+")"),g=0;g<e.length;g++){f=e[g];
var h=ph(f);h&&tg(f,h);}}}}}
if(!(V||window.ShadyDOM&&window.ShadyDOM.handlesDynamicScoping)){var rh=new MutationObserver(qh),sh=function(a){rh.observe(a,{childList:!0,subtree:!0});};if(window.customElements&&!window.customElements.polyfillWrapFlushCallback)sh(document);else{var th=function(){sh(document.body);};window.HTMLImports?window.HTMLImports.whenReady(th):requestAnimationFrame(function(){if("loading"===document.readyState){var a=function(){th();document.removeEventListener("readystatechange",a);};document.addEventListener("readystatechange",
a);}else th();});}mh=function(){qh(rh.takeRecords());};}var uh={};var vh=Promise.resolve();function wh(a){if(a=uh[a])a._applyShimCurrentVersion=a._applyShimCurrentVersion||0,a._applyShimValidatingVersion=a._applyShimValidatingVersion||0,a._applyShimNextVersion=(a._applyShimNextVersion||0)+1;}function xh(a){return a._applyShimCurrentVersion===a._applyShimNextVersion}function yh(a){a._applyShimValidatingVersion=a._applyShimNextVersion;a._validating||(a._validating=!0,vh.then(function(){a._applyShimCurrentVersion=a._applyShimNextVersion;a._validating=!1;}));}var zh={},Ah=new lh;function Y(){this.D={};this.c=document.documentElement;var a=new xf;a.rules=[];this.f=Rg(this.c,new Pg(a));this.u=!1;this.a=this.b=null;}w=Y.prototype;w.flush=function(){mh();};w.Ka=function(a){return bg(a)};w.Ya=function(a){return $f(a)};w.prepareTemplate=function(a,b,c){this.prepareTemplateDom(a,b);this.prepareTemplateStyles(a,b,c);};
w.prepareTemplateStyles=function(a,b,c){if(!a._prepared&&!Rf){V||ih[b]||(ih[b]=gg(b));a._prepared=!0;a.name=b;a.extends=c;uh[b]=a;var d=ng(a),e=og(d);c={is:b,extends:c};for(var f=[],g=a.content.querySelectorAll("style"),h=0;h<g.length;h++){var k=g[h];if(k.hasAttribute("shady-unscoped")){if(!V){var l=k.textContent;Zf.has(l)||(Zf.add(l),l=k.cloneNode(!0),document.head.appendChild(l));k.parentNode.removeChild(k);}}else f.push(k.textContent),k.parentNode.removeChild(k);}f=f.join("").trim()+(zh[b]||"");
Bh(this);if(!e){if(g=!d)g=Tf.test(f)||Sf.test(f),Tf.lastIndex=0,Sf.lastIndex=0;h=yf(f);g&&W&&this.b&&this.b.transformRules(h,b);a._styleAst=h;}g=[];W||(g=Wg(a._styleAst));if(!g.length||W)h=V?a.content:null,b=ih[b]||null,d=wg(c,a._styleAst,null,d,e?f:""),d=d.length?dg(d,c.is,h,b):null,a._style=d;a.a=g;}};w.Sa=function(a,b){zh[b]=a.join(" ");};w.prepareTemplateDom=function(a,b){if(!Rf){var c=ng(a);V||"shady"===c||a._domPrepared||(a._domPrepared=!0,qg(a.content,b));}};
function Ch(a){var b=lg(a),c=b.is;b=b.Y;var d=ih[c]||null,e=uh[c];if(e){c=e._styleAst;var f=e.a;e=ng(e);b=new Pg(c,d,f,b,e);Rg(a,b);return b}}function Dh(a){!a.a&&window.ShadyCSS&&window.ShadyCSS.CustomStyleInterface&&(a.a=window.ShadyCSS.CustomStyleInterface,a.a.transformCallback=function(b){a.xa(b);},a.a.validateCallback=function(){requestAnimationFrame(function(){(a.a.enqueued||a.u)&&a.flushCustomStyles();});});}
function Bh(a){!a.b&&window.ShadyCSS&&window.ShadyCSS.ApplyShim&&(a.b=window.ShadyCSS.ApplyShim,a.b.invalidCallback=wh);Dh(a);}
w.flushCustomStyles=function(){if(!Rf&&(Bh(this),this.a)){var a=this.a.processStyles();if(this.a.enqueued&&!og(this.f.cssBuild)){if(W){if(!this.f.cssBuild)for(var b=0;b<a.length;b++){var c=this.a.getStyleForCustomStyle(a[b]);if(c&&W&&this.b){var d=bg(c);Bh(this);this.b.transformRules(d);c.textContent=$f(d);}}}else{Eh(this,a);Fh(this,this.c,this.f);for(b=0;b<a.length;b++)(c=this.a.getStyleForCustomStyle(a[b]))&&gh(c,this.f.L);this.u&&this.styleDocument();}this.a.enqueued=!1;}}};
function Eh(a,b){b=b.map(function(c){return a.a.getStyleForCustomStyle(c)}).filter(function(c){return !!c});b.sort(function(c,d){c=d.compareDocumentPosition(c);return c&Node.DOCUMENT_POSITION_FOLLOWING?1:c&Node.DOCUMENT_POSITION_PRECEDING?-1:0});a.f.I.rules=b.map(function(c){return bg(c)});}
w.styleElement=function(a,b){if(Rf){if(b){Qg(a)||Rg(a,new Pg(null));var c=Qg(a);c.G=c.G||{};Object.assign(c.G,b);Gh(this,a,c);}}else if(c=Qg(a)||Ch(a))if(a!==this.c&&(this.u=!0),b&&(c.G=c.G||{},Object.assign(c.G,b)),W)Gh(this,a,c);else if(this.flush(),Fh(this,a,c),c.la&&c.la.length){b=lg(a).is;var d;a:{if(d=Ah.cache[b])for(var e=d.length-1;0<=e;e--){var f=d[e];b:{var g=c.la;for(var h=0;h<g.length;h++){var k=g[h];if(f.K[k]!==c.L[k]){g=!1;break b}}g=!0;}if(g){d=f;break a}}d=void 0;}g=d?d.styleElement:
null;e=c.H;(f=d&&d.H)||(f=this.D[b]=(this.D[b]||0)+1,f=b+"-"+f);c.H=f;f=c.H;h=hh;h=g?g.textContent||"":dh(h,a,c.L,f);k=Qg(a);var l=k.a;l&&!V&&l!==g&&(l._useCount--,0>=l._useCount&&l.parentNode&&l.parentNode.removeChild(l));V?k.a?(k.a.textContent=h,g=k.a):h&&(g=dg(h,f,a.shadowRoot,k.b)):g?g.parentNode||(Ug&&-1<h.indexOf("@media")&&(g.textContent=h),eg(g,null,k.b)):h&&(g=dg(h,f,null,k.b));g&&(g._useCount=g._useCount||0,k.a!=g&&g._useCount++,k.a=g);f=g;V||(g=c.H,k=h=a.getAttribute("class")||"",e&&(k=
h.replace(new RegExp("\\s*x-scope\\s*"+e+"\\s*","g")," ")),k+=(k?" ":"")+"x-scope "+g,h!==k&&jg(a,k));d||Ah.store(b,c.L,f,c.H);}};
function Gh(a,b,c){var d=lg(b).is;if(c.G){var e=c.G,f;for(f in e)null===f?b.style.removeProperty(f):b.style.setProperty(f,e[f]);}e=uh[d];if(!(!e&&b!==a.c||e&&""!==ng(e))&&e&&e._style&&!xh(e)){if(xh(e)||e._applyShimValidatingVersion!==e._applyShimNextVersion)Bh(a),a.b&&a.b.transformRules(e._styleAst,d),e._style.textContent=wg(b,c.I),yh(e);V&&(a=b.shadowRoot)&&(a=a.querySelector("style"))&&(a.textContent=wg(b,c.I));c.I=e._styleAst;}}
function Hh(a,b){return (b=kg(b).getRootNode().host)?Qg(b)||Ch(b)?b:Hh(a,b):a.c}function Fh(a,b,c){var d=Hh(a,b),e=Qg(d),f=e.L;d===a.c||f||(Fh(a,d,e),f=e.L);a=Object.create(f||null);d=ch(b,c.I,c.cssBuild);b=ah(e.I,b).K;Object.assign(a,d.Ma,b,d.Ua);b=c.G;for(var g in b)if((e=b[g])||0===e)a[g]=e;g=hh;b=Object.getOwnPropertyNames(a);for(e=0;e<b.length;e++)d=b[e],a[d]=Zg(g,a[d],a);c.L=a;}w.styleDocument=function(a){this.styleSubtree(this.c,a);};
w.styleSubtree=function(a,b){var c=kg(a),d=c.shadowRoot,e=a===this.c;(d||e)&&this.styleElement(a,b);if(a=e?c:d)for(a=Array.from(a.querySelectorAll("*")).filter(function(f){return kg(f).shadowRoot}),b=0;b<a.length;b++)this.styleSubtree(a[b]);};
w.xa=function(a){var b=this,c=ng(a);c!==this.f.cssBuild&&(this.f.cssBuild=c);if(!og(c)){var d=bg(a);ag(d,function(e){if(V)Og(e);else{var f=sg;e.selector=e.parsedSelector;Og(e);e.selector=e.B=zg(f,e,f.c,void 0,void 0);}W&&""===c&&(Bh(b),b.b&&b.b.transformRule(e));});W?a.textContent=$f(d):this.f.I.rules.push(d);}};w.getComputedStyleValue=function(a,b){var c;W||(c=(Qg(a)||Qg(Hh(this,a))).L[b]);return (c=c||window.getComputedStyle(a).getPropertyValue(b))?c.trim():""};
w.Xa=function(a,b){var c=kg(a).getRootNode(),d;b?d=("string"===typeof b?b:String(b)).split(/\s/):d=[];b=c.host&&c.host.localName;if(!b&&(c=a.getAttribute("class"))){c=c.split(/\s/);for(var e=0;e<c.length;e++)if(c[e]===sg.a){b=c[e+1];break}}b&&d.push(sg.a,b);W||(b=Qg(a))&&b.H&&d.push(hh.a,b.H);jg(a,d.join(" "));};w.Fa=function(a){return Qg(a)};w.Wa=function(a,b){tg(a,b);};w.Za=function(a,b){tg(a,b,!0);};w.Va=function(a){return ph(a)};w.Ia=function(a){return oh(a)};Y.prototype.flush=Y.prototype.flush;
Y.prototype.prepareTemplate=Y.prototype.prepareTemplate;Y.prototype.styleElement=Y.prototype.styleElement;Y.prototype.styleDocument=Y.prototype.styleDocument;Y.prototype.styleSubtree=Y.prototype.styleSubtree;Y.prototype.getComputedStyleValue=Y.prototype.getComputedStyleValue;Y.prototype.setElementClass=Y.prototype.Xa;Y.prototype._styleInfoForNode=Y.prototype.Fa;Y.prototype.transformCustomStyleForDocument=Y.prototype.xa;Y.prototype.getStyleAst=Y.prototype.Ka;Y.prototype.styleAstToString=Y.prototype.Ya;
Y.prototype.flushCustomStyles=Y.prototype.flushCustomStyles;Y.prototype.scopeNode=Y.prototype.Wa;Y.prototype.unscopeNode=Y.prototype.Za;Y.prototype.scopeForNode=Y.prototype.Va;Y.prototype.currentScopeForNode=Y.prototype.Ia;Y.prototype.prepareAdoptedCssText=Y.prototype.Sa;Object.defineProperties(Y.prototype,{nativeShadow:{get:function(){return V}},nativeCss:{get:function(){return W}}});var Z=new Y,Ih,Jh;window.ShadyCSS&&(Ih=window.ShadyCSS.ApplyShim,Jh=window.ShadyCSS.CustomStyleInterface);
window.ShadyCSS={ScopingShim:Z,prepareTemplate:function(a,b,c){Z.flushCustomStyles();Z.prepareTemplate(a,b,c);},prepareTemplateDom:function(a,b){Z.prepareTemplateDom(a,b);},prepareTemplateStyles:function(a,b,c){Z.flushCustomStyles();Z.prepareTemplateStyles(a,b,c);},styleSubtree:function(a,b){Z.flushCustomStyles();Z.styleSubtree(a,b);},styleElement:function(a){Z.flushCustomStyles();Z.styleElement(a);},styleDocument:function(a){Z.flushCustomStyles();Z.styleDocument(a);},flushCustomStyles:function(){Z.flushCustomStyles();},
getComputedStyleValue:function(a,b){return Z.getComputedStyleValue(a,b)},nativeCss:W,nativeShadow:V,cssBuild:Qf,disableRuntime:Rf};Ih&&(window.ShadyCSS.ApplyShim=Ih);Jh&&(window.ShadyCSS.CustomStyleInterface=Jh);(function(a){function b(r){""==r&&(f.call(this),this.i=!0);return r.toLowerCase()}function c(r){var F=r.charCodeAt(0);return 32<F&&127>F&&-1==[34,35,60,62,63,96].indexOf(F)?r:encodeURIComponent(r)}function d(r){var F=r.charCodeAt(0);return 32<F&&127>F&&-1==[34,35,60,62,96].indexOf(F)?r:encodeURIComponent(r)}function e(r,F,C){function N(ka){}var x=F||"scheme start",X=0,v="",pa=!1,fa=!1;a:for(;(void 0!=r[X-1]||0==X)&&!this.i;){var n=r[X];switch(x){case "scheme start":if(n&&q.test(n))v+=
n.toLowerCase(),x="scheme";else if(F){break a}else{v="";x="no scheme";continue}break;case "scheme":if(n&&H.test(n))v+=n.toLowerCase();else if(":"==n){this.h=v;v="";if(F)break a;void 0!==l[this.h]&&(this.C=!0);x="file"==this.h?"relative":this.C&&C&&C.h==this.h?"relative or authority":this.C?"authority first slash":"scheme data";}else if(F){break a}else{v="";X=0;x="no scheme";continue}break;case "scheme data":"?"==n?(this.o="?",
x="query"):"#"==n?(this.v="#",x="fragment"):void 0!=n&&"\t"!=n&&"\n"!=n&&"\r"!=n&&(this.ha+=c(n));break;case "no scheme":if(C&&void 0!==l[C.h]){x="relative";continue}else f.call(this),this.i=!0;break;case "relative or authority":if("/"==n&&"/"==r[X+1])x="authority ignore slashes";else{x="relative";continue}break;case "relative":this.C=!0;"file"!=this.h&&(this.h=C.h);if(void 0==n){this.j=C.j;this.m=C.m;this.l=C.l.slice();this.o=C.o;this.s=C.s;this.g=C.g;
break a}else if("/"==n||"\\"==n)x="relative slash";else if("?"==n)this.j=C.j,this.m=C.m,this.l=C.l.slice(),this.o="?",this.s=C.s,this.g=C.g,x="query";else if("#"==n)this.j=C.j,this.m=C.m,this.l=C.l.slice(),this.o=C.o,this.v="#",this.s=C.s,this.g=C.g,x="fragment";else{x=r[X+1];var I=r[X+2];if("file"!=this.h||!q.test(n)||":"!=x&&"|"!=x||void 0!=I&&"/"!=I&&"\\"!=I&&"?"!=I&&"#"!=I)this.j=C.j,this.m=C.m,this.s=C.s,this.g=C.g,this.l=C.l.slice(),this.l.pop();x=
"relative path";continue}break;case "relative slash":if("/"==n||"\\"==n)x="file"==this.h?"file host":"authority ignore slashes";else{"file"!=this.h&&(this.j=C.j,this.m=C.m,this.s=C.s,this.g=C.g);x="relative path";continue}break;case "authority first slash":if("/"==n)x="authority second slash";else{x="authority ignore slashes";continue}break;case "authority second slash":x="authority ignore slashes";if("/"!=n){continue}break;case "authority ignore slashes":if("/"!=n&&"\\"!=n){x="authority";continue}break;case "authority":if("@"==n){pa&&(v+="%40");pa=!0;for(n=0;n<v.length;n++)I=v[n],"\t"==I||"\n"==I||"\r"==I?N():":"==I&&null===this.g?this.g="":(I=c(I),null!==this.g?this.g+=I:this.s+=I);v="";}else if(void 0==n||"/"==n||"\\"==n||"?"==n||"#"==n){X-=v.length;v="";x="host";continue}else v+=n;break;case "file host":if(void 0==
n||"/"==n||"\\"==n||"?"==n||"#"==n){2!=v.length||!q.test(v[0])||":"!=v[1]&&"|"!=v[1]?(0!=v.length&&(this.j=b.call(this,v),v=""),x="relative path start"):x="relative path";continue}else"\t"==n||"\n"==n||"\r"==n?N():v+=n;break;case "host":case "hostname":if(":"!=n||fa)if(void 0==n||"/"==n||"\\"==n||"?"==n||"#"==n){this.j=b.call(this,v);v="";x="relative path start";if(F)break a;continue}else"\t"!=n&&"\n"!=n&&"\r"!=n?("["==n?fa=!0:"]"==n&&(fa=!1),v+=n):N();else if(this.j=b.call(this,v),v="",x="port","hostname"==F)break a;break;case "port":if(/[0-9]/.test(n))v+=n;else if(void 0==n||"/"==n||"\\"==n||"?"==n||"#"==n||F){""!=v&&(v=parseInt(v,10),v!=l[this.h]&&(this.m=v+""),v="");if(F)break a;x="relative path start";continue}else"\t"==n||"\n"==n||"\r"==n?N():(f.call(this),this.i=!0);break;case "relative path start":x="relative path";if("/"!=n&&"\\"!=n)continue;break;case "relative path":if(void 0!=
n&&"/"!=n&&"\\"!=n&&(F||"?"!=n&&"#"!=n))"\t"!=n&&"\n"!=n&&"\r"!=n&&(v+=c(n));else{if(I=m[v.toLowerCase()])v=I;".."==v?(this.l.pop(),"/"!=n&&"\\"!=n&&this.l.push("")):"."==v&&"/"!=n&&"\\"!=n?this.l.push(""):"."!=v&&("file"==this.h&&0==this.l.length&&2==v.length&&q.test(v[0])&&"|"==v[1]&&(v=v[0]+":"),this.l.push(v));v="";"?"==n?(this.o="?",x="query"):"#"==n&&(this.v="#",x="fragment");}break;case "query":F||"#"!=n?void 0!=n&&"\t"!=n&&"\n"!=n&&"\r"!=n&&(this.o+=
d(n)):(this.v="#",x="fragment");break;case "fragment":void 0!=n&&"\t"!=n&&"\n"!=n&&"\r"!=n&&(this.v+=n);}X++;}}function f(){this.s=this.ha=this.h="";this.g=null;this.m=this.j="";this.l=[];this.v=this.o="";this.C=this.i=!1;}function g(r,F){void 0===F||F instanceof g||(F=new g(String(F)));this.a=r;f.call(this);e.call(this,this.a.replace(/^[ \t\r\n\f]+|[ \t\r\n\f]+$/g,""),null,F);}var h=!1;try{var k=new URL("b","http://a");k.pathname="c%20d";h="http://a/c%20d"===k.href;}catch(r){}if(!h){var l=Object.create(null);
l.ftp=21;l.file=0;l.gopher=70;l.http=80;l.https=443;l.ws=80;l.wss=443;var m=Object.create(null);m["%2e"]=".";m[".%2e"]="..";m["%2e."]="..";m["%2e%2e"]="..";var q=/[a-zA-Z]/,H=/[a-zA-Z0-9\+\-\.]/;g.prototype={toString:function(){return this.href},get href(){if(this.i)return this.a;var r="";if(""!=this.s||null!=this.g)r=this.s+(null!=this.g?":"+this.g:"")+"@";return this.protocol+(this.C?"//"+r+this.host:"")+this.pathname+this.o+this.v},set href(r){f.call(this);e.call(this,r);},get protocol(){return this.h+
":"},set protocol(r){this.i||e.call(this,r+":","scheme start");},get host(){return this.i?"":this.m?this.j+":"+this.m:this.j},set host(r){!this.i&&this.C&&e.call(this,r,"host");},get hostname(){return this.j},set hostname(r){!this.i&&this.C&&e.call(this,r,"hostname");},get port(){return this.m},set port(r){!this.i&&this.C&&e.call(this,r,"port");},get pathname(){return this.i?"":this.C?"/"+this.l.join("/"):this.ha},set pathname(r){!this.i&&this.C&&(this.l=[],e.call(this,r,"relative path start"));},get search(){return this.i||
!this.o||"?"==this.o?"":this.o},set search(r){!this.i&&this.C&&(this.o="?","?"==r[0]&&(r=r.slice(1)),e.call(this,r,"query"));},get hash(){return this.i||!this.v||"#"==this.v?"":this.v},set hash(r){this.i||(r?(this.v="#","#"==r[0]&&(r=r.slice(1)),e.call(this,r,"fragment")):this.v="");},get origin(){var r;if(this.i||!this.h)return "";switch(this.h){case "data":case "file":case "javascript":case "mailto":return "null"}return (r=this.host)?this.h+"://"+r:""}};var E=a.URL;E&&(g.createObjectURL=function(r){return E.createObjectURL.apply(E,
arguments)},g.revokeObjectURL=function(r){E.revokeObjectURL(r);});a.URL=g;}})(window);Object.getOwnPropertyDescriptor(Node.prototype,"baseURI")||Object.defineProperty(Node.prototype,"baseURI",{get:function(){var a=(this.ownerDocument||this).querySelector("base[href]");return a&&a.href||window.location.href},configurable:!0,enumerable:!0});var Kh=document.createElement("style");Kh.textContent="body {transition: opacity ease-in 0.2s; } \nbody[unresolved] {opacity: 0; display: block; overflow: hidden; position: relative; } \n";var Lh=document.querySelector("head");Lh.insertBefore(Kh,Lh.firstChild);var Mh=window.customElements,Nh=!1,Oh=null;Mh.polyfillWrapFlushCallback&&Mh.polyfillWrapFlushCallback(function(a){Oh=a;Nh&&a();});function Ph(){window.HTMLTemplateElement.bootstrap&&window.HTMLTemplateElement.bootstrap(window.document);Oh&&Oh();Nh=!0;window.WebComponents.ready=!0;document.dispatchEvent(new CustomEvent("WebComponentsReady",{bubbles:!0}));}
"complete"!==document.readyState?(window.addEventListener("load",Ph),window.addEventListener("DOMContentLoaded",function(){window.removeEventListener("load",Ph);Ph();})):Ph();}).call(commonjsGlobal);
