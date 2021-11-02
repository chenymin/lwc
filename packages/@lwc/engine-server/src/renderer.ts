/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import {
    isUndefined,
    isNull,
    isBooleanAttribute,
    isGlobalHtmlAttribute,
    isAriaAttribute,
    create,
    StringToLowerCase,
    htmlPropertyToAttribute,
} from '@lwc/shared';

import { HostNode, HostElement, HostAttribute, HostNodeType } from './types';
import { classNameToTokenList, tokenListToClassName } from './utils/classes';

function unsupportedMethod(name: string): () => never {
    return function () {
        throw new TypeError(`"${name}" is not supported in this environment`);
    };
}

function createElement(name: string): HostElement {
    return {
        type: HostNodeType.Element,
        name,
        parent: null,
        shadowRoot: null,
        children: [],
        attributes: [],
        eventListeners: {},
    };
}

const registry: Record<string, CustomElementConstructor> = create(null);
const reverseRegistry: WeakMap<CustomElementConstructor, string> = new WeakMap();

function registerCustomElement(name: string, ctor: CustomElementConstructor) {
    if (name !== StringToLowerCase.call(name) || registry[name]) {
        throw new TypeError(`Invalid Registration`);
    }
    registry[name] = ctor;
    reverseRegistry.set(ctor, name);
}

class HTMLElement {
    constructor() {
        const { constructor } = this;
        const name = reverseRegistry.get(constructor as CustomElementConstructor);
        if (!name) {
            throw new TypeError(`Invalid Construction`);
        }
        return createElement(name);
    }
}

export const ssr = true;

export function isHydrating(): boolean {
    return false;
}

export const isNativeShadowDefined = false;
export const isSyntheticShadowDefined = false;

type N = HostNode;
type E = HostElement;

export function insert(node: N, parent: E, anchor: N | null) {
    if (node.parent !== null && node.parent !== parent) {
        const nodeIndex = node.parent.children.indexOf(node);
        node.parent.children.splice(nodeIndex, 1);
    }

    node.parent = parent;

    const anchorIndex = isNull(anchor) ? -1 : parent.children.indexOf(anchor);
    if (anchorIndex === -1) {
        parent.children.push(node);
    } else {
        parent.children.splice(anchorIndex, 0, node);
    }
}

export function remove(node: N, parent: E) {
    const nodeIndex = parent.children.indexOf(node);
    parent.children.splice(nodeIndex, 1);
}

export { createElement };

export function createText(content: string): HostNode {
    return {
        type: HostNodeType.Text,
        value: String(content),
        parent: null,
    };
}

export function createComment(content: string): HostNode {
    return {
        type: HostNodeType.Comment,
        value: content,
        parent: null,
    };
}

export function nextSibling(node: N) {
    const { parent } = node;

    if (isNull(parent)) {
        return null;
    }

    const nodeIndex = parent.children.indexOf(node);
    return (parent.children[nodeIndex + 1] as HostNode) || null;
}

export function attachShadow(element: E, config: ShadowRootInit) {
    element.shadowRoot = {
        type: HostNodeType.ShadowRoot,
        children: [],
        mode: config.mode,
        delegatesFocus: !!config.delegatesFocus,
    };

    return element.shadowRoot as any;
}

export function getProperty(node: N, key: string) {
    if (key in node) {
        return (node as any)[key];
    }

    if (node.type === HostNodeType.Element) {
        const attrName = htmlPropertyToAttribute(key);

        // Handle all the boolean properties.
        if (isBooleanAttribute(attrName, node.name)) {
            return getAttribute(node, attrName) ?? false;
        }

        // Handle global html attributes and AOM.
        if (isGlobalHtmlAttribute(attrName) || isAriaAttribute(attrName)) {
            return getAttribute(node, attrName);
        }

        // Handle special elements live bindings. The checked property is already handled above
        // in the boolean case.
        if (node.name === 'input' && key === 'value') {
            return getAttribute(node, 'value') ?? '';
        }
    }

    if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error(`Unexpected "${key}" property access from the renderer`);
    }
}

export function setProperty(node: N, key: string, value: any): void {
    if (key in node) {
        return ((node as any)[key] = value);
    }

    if (node.type === HostNodeType.Element) {
        const attrName = htmlPropertyToAttribute(key);

        if (key === 'innerHTML') {
            node.children = [
                {
                    type: HostNodeType.Raw,
                    parent: node,
                    value,
                },
            ];
            return;
        }

        // Handle all the boolean properties.
        if (isBooleanAttribute(attrName, node.name)) {
            return value === true
                ? setAttribute(node, attrName, '')
                : removeAttribute(node, attrName);
        }

        // Handle global html attributes and AOM.
        if (isGlobalHtmlAttribute(attrName) || isAriaAttribute(attrName)) {
            return setAttribute(node, attrName, value);
        }

        // Handle special elements live bindings. The checked property is already handled above
        // in the boolean case.
        if (node.name === 'input' && attrName === 'value') {
            return isNull(value) || isUndefined(value)
                ? removeAttribute(node, 'value')
                : setAttribute(node, 'value', value);
        }
    }

    if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error(`Unexpected attempt to set "${key}=${value}" property from the renderer`);
    }
}

export function setText(node: N, content: string) {
    if (node.type === HostNodeType.Text) {
        node.value = content;
    } else if (node.type === HostNodeType.Element) {
        node.children = [
            {
                type: HostNodeType.Text,
                parent: node,
                value: content,
            },
        ];
    }
}

export function getAttribute(element: E, name: string, namespace?: string | null) {
    const attribute = element.attributes.find(
        (attr) => attr.name === name && attr.namespace === namespace
    );
    return attribute ? attribute.value : null;
}

export function setAttribute(element: E, name: string, value: string, namespace?: string | null) {
    const attribute = element.attributes.find(
        (attr) => attr.name === name && attr.namespace === namespace
    );

    if (isUndefined(namespace)) {
        namespace = null;
    }

    if (isUndefined(attribute)) {
        element.attributes.push({
            name,
            namespace,
            value: String(value),
        });
    } else {
        attribute.value = value;
    }
}

export function removeAttribute(element: E, name: string, namespace?: string | null) {
    element.attributes = element.attributes.filter(
        (attr) => attr.name !== name && attr.namespace !== namespace
    );
}

export function getClassList(element: E) {
    function getClassAttribute(): HostAttribute {
        let classAttribute = element.attributes.find(
            (attr) => attr.name === 'class' && isNull(attr.namespace)
        );

        if (isUndefined(classAttribute)) {
            classAttribute = {
                name: 'class',
                namespace: null,
                value: '',
            };
            element.attributes.push(classAttribute);
        }

        return classAttribute;
    }

    return {
        add(...names: string[]): void {
            const classAttribute = getClassAttribute();

            const tokenList = classNameToTokenList(classAttribute.value);
            names.forEach((name) => tokenList.add(name));
            classAttribute.value = tokenListToClassName(tokenList);
        },
        remove(...names: string[]): void {
            const classAttribute = getClassAttribute();

            const tokenList = classNameToTokenList(classAttribute.value);
            names.forEach((name) => tokenList.delete(name));
            classAttribute.value = tokenListToClassName(tokenList);
        },
    } as DOMTokenList;
}

export function setCSSStyleProperty(element: E, name: string, value: string, important: boolean) {
    const styleAttribute = element.attributes.find(
        (attr) => attr.name === 'style' && isNull(attr.namespace)
    );

    const serializedProperty = `${name}: ${value}${important ? ' !important' : ''}`;

    if (isUndefined(styleAttribute)) {
        element.attributes.push({
            name: 'style',
            namespace: null,
            value: serializedProperty,
        });
    } else {
        styleAttribute.value += `; ${serializedProperty}`;
    }
}

export function isConnected(node: HostNode) {
    return !isNull(node.parent);
}

export function insertGlobalStylesheet() {
    // Noop on SSR (for now). This need to be reevaluated whenever we will implement support for
    // synthetic shadow.
}

export function insertStylesheet() {
    // Noop on SSR (for now). This need to be reevaluated whenever we will implement support for
    // synthetic shadow.
}

export function addEventListener() {
    // Noop on SSR.
}

export function removeEventListener() {
    // Noop on SSR.
}

export const dispatchEvent = unsupportedMethod('dispatchEvent');
export const getBoundingClientRect = unsupportedMethod('getBoundingClientRect');
export const querySelector = unsupportedMethod('querySelector');
export const querySelectorAll = unsupportedMethod('querySelectorAll');
export const getElementsByTagName = unsupportedMethod('getElementsByTagName');
export const getElementsByClassName = unsupportedMethod('getElementsByClassName');
export const getChildren = unsupportedMethod('getChildren');
export const getChildNodes = unsupportedMethod('getChildNodes');
export const getFirstChild = unsupportedMethod('getFirstChild');
export const getFirstElementChild = unsupportedMethod('getFirstElementChild');
export const getLastChild = unsupportedMethod('getLastChild');
export const getLastElementChild = unsupportedMethod('getLastElementChild');

export function defineCustomElement(
    name: string,
    constructor: CustomElementConstructor,
    _options?: ElementDefinitionOptions
) {
    registerCustomElement(name, constructor);
}

export function getCustomElement(name: string): CustomElementConstructor | undefined {
    return registry[name];
}

export { HTMLElement };

export function assertInstanceOfHTMLElement() {
    /* noop */
}
