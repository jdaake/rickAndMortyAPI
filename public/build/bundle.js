
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        if (value != null || input.value) {
            input.value = value;
        }
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            callbacks.slice().forEach(fn => fn(event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_in_transition(node, fn, params) {
        let config = fn(node, params);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            add_render_callback(() => dispatch(node, true, 'start'));
            task = loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(1, 0);
                        dispatch(node, true, 'end');
                        cleanup();
                        return running = false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                delete_rule(node);
                if (is_function(config)) {
                    config = config();
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
    }
    function create_out_transition(node, fn, params) {
        let config = fn(node, params);
        let running = true;
        let animation_name;
        const group = outros;
        group.r += 1;
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 1, 0, duration, delay, easing, css);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            add_render_callback(() => dispatch(node, false, 'start'));
            loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(0, 1);
                        dispatch(node, false, 'end');
                        if (!--group.r) {
                            // this will result in `end()` being called,
                            // so we don't need to clean up here
                            run_all(group.c);
                        }
                        return false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(1 - t, t);
                    }
                }
                return running;
            });
        }
        if (is_function(config)) {
            wait().then(() => {
                // @ts-ignore
                config = config();
                go();
            });
        }
        else {
            go();
        }
        return {
            end(reset) {
                if (reset && config.tick) {
                    config.tick(1, 0);
                }
                if (running) {
                    if (animation_name)
                        delete_rule(node, animation_name);
                    running = false;
                }
            }
        };
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.21.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev("SvelteDOMSetProperty", { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fade(node, { delay = 0, duration = 400, easing = identity }) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }
    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 }) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
        };
    }

    /* src/Card.svelte generated by Svelte v3.21.0 */
    const file = "src/Card.svelte";

    function create_fragment(ctx) {
    	let div7;
    	let header;
    	let a;
    	let img;
    	let img_src_value;
    	let t0;
    	let div0;
    	let h3;
    	let t1;
    	let t2;
    	let div6;
    	let div5;
    	let div1;
    	let t3;
    	let t4;
    	let t5;
    	let hr0;
    	let t6;
    	let div2;
    	let t7;
    	let t8;
    	let t9;
    	let hr1;
    	let t10;
    	let div3;
    	let t11;
    	let t12;
    	let t13;
    	let hr2;
    	let t14;
    	let div4;
    	let t15;
    	let t16;

    	const block = {
    		c: function create() {
    			div7 = element("div");
    			header = element("header");
    			a = element("a");
    			img = element("img");
    			t0 = space();
    			div0 = element("div");
    			h3 = element("h3");
    			t1 = text(/*name*/ ctx[0]);
    			t2 = space();
    			div6 = element("div");
    			div5 = element("div");
    			div1 = element("div");
    			t3 = text("Status: ");
    			t4 = text(/*status*/ ctx[1]);
    			t5 = space();
    			hr0 = element("hr");
    			t6 = space();
    			div2 = element("div");
    			t7 = text("Species: ");
    			t8 = text(/*species*/ ctx[4]);
    			t9 = space();
    			hr1 = element("hr");
    			t10 = space();
    			div3 = element("div");
    			t11 = text("Gender: ");
    			t12 = text(/*gender*/ ctx[6]);
    			t13 = space();
    			hr2 = element("hr");
    			t14 = space();
    			div4 = element("div");
    			t15 = text("Origin: ");
    			t16 = text(/*origin*/ ctx[5]);
    			if (img.src !== (img_src_value = /*imgUrl*/ ctx[2])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", /*name*/ ctx[0]);
    			attr_dev(img, "class", "svelte-2m8pht");
    			add_location(img, file, 58, 6, 1389);
    			attr_dev(h3, "class", "svelte-2m8pht");
    			add_location(h3, file, 60, 8, 1498);
    			attr_dev(div0, "class", "uk-overlay uk-overlay-primary uk-position-bottom");
    			add_location(div0, file, 59, 6, 1427);
    			attr_dev(a, "href", /*linkImage*/ ctx[3]);
    			attr_dev(a, "class", "svelte-2m8pht");
    			add_location(a, file, 57, 4, 1362);
    			attr_dev(header, "class", "image uk-inline svelte-2m8pht");
    			attr_dev(header, "uk-lightbox", "transition: fade");
    			add_location(header, file, 56, 2, 1294);
    			add_location(div1, file, 66, 6, 1588);
    			add_location(hr0, file, 67, 6, 1622);
    			add_location(div2, file, 68, 6, 1635);
    			add_location(hr1, file, 69, 6, 1671);
    			add_location(div3, file, 70, 6, 1684);
    			add_location(hr2, file, 71, 6, 1718);
    			add_location(div4, file, 72, 6, 1731);
    			attr_dev(div5, "class", "details svelte-2m8pht");
    			add_location(div5, file, 65, 4, 1560);
    			add_location(div6, file, 64, 2, 1550);
    			attr_dev(div7, "class", "container svelte-2m8pht");
    			add_location(div7, file, 55, 0, 1268);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div7, anchor);
    			append_dev(div7, header);
    			append_dev(header, a);
    			append_dev(a, img);
    			append_dev(a, t0);
    			append_dev(a, div0);
    			append_dev(div0, h3);
    			append_dev(h3, t1);
    			append_dev(div7, t2);
    			append_dev(div7, div6);
    			append_dev(div6, div5);
    			append_dev(div5, div1);
    			append_dev(div1, t3);
    			append_dev(div1, t4);
    			append_dev(div5, t5);
    			append_dev(div5, hr0);
    			append_dev(div5, t6);
    			append_dev(div5, div2);
    			append_dev(div2, t7);
    			append_dev(div2, t8);
    			append_dev(div5, t9);
    			append_dev(div5, hr1);
    			append_dev(div5, t10);
    			append_dev(div5, div3);
    			append_dev(div3, t11);
    			append_dev(div3, t12);
    			append_dev(div5, t13);
    			append_dev(div5, hr2);
    			append_dev(div5, t14);
    			append_dev(div5, div4);
    			append_dev(div4, t15);
    			append_dev(div4, t16);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*imgUrl*/ 4 && img.src !== (img_src_value = /*imgUrl*/ ctx[2])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*name*/ 1) {
    				attr_dev(img, "alt", /*name*/ ctx[0]);
    			}

    			if (dirty & /*name*/ 1) set_data_dev(t1, /*name*/ ctx[0]);

    			if (dirty & /*linkImage*/ 8) {
    				attr_dev(a, "href", /*linkImage*/ ctx[3]);
    			}

    			if (dirty & /*status*/ 2) set_data_dev(t4, /*status*/ ctx[1]);
    			if (dirty & /*species*/ 16) set_data_dev(t8, /*species*/ ctx[4]);
    			if (dirty & /*gender*/ 64) set_data_dev(t12, /*gender*/ ctx[6]);
    			if (dirty & /*origin*/ 32) set_data_dev(t16, /*origin*/ ctx[5]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div7);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { name } = $$props;
    	let { status } = $$props;
    	let { imgUrl } = $$props;
    	let { linkImage } = $$props;
    	let { species } = $$props;
    	let { origin } = $$props;
    	let { gender } = $$props;
    	const writable_props = ["name", "status", "imgUrl", "linkImage", "species", "origin", "gender"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Card> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Card", $$slots, []);

    	$$self.$set = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    		if ("status" in $$props) $$invalidate(1, status = $$props.status);
    		if ("imgUrl" in $$props) $$invalidate(2, imgUrl = $$props.imgUrl);
    		if ("linkImage" in $$props) $$invalidate(3, linkImage = $$props.linkImage);
    		if ("species" in $$props) $$invalidate(4, species = $$props.species);
    		if ("origin" in $$props) $$invalidate(5, origin = $$props.origin);
    		if ("gender" in $$props) $$invalidate(6, gender = $$props.gender);
    	};

    	$$self.$capture_state = () => ({
    		fade,
    		fly,
    		name,
    		status,
    		imgUrl,
    		linkImage,
    		species,
    		origin,
    		gender
    	});

    	$$self.$inject_state = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    		if ("status" in $$props) $$invalidate(1, status = $$props.status);
    		if ("imgUrl" in $$props) $$invalidate(2, imgUrl = $$props.imgUrl);
    		if ("linkImage" in $$props) $$invalidate(3, linkImage = $$props.linkImage);
    		if ("species" in $$props) $$invalidate(4, species = $$props.species);
    		if ("origin" in $$props) $$invalidate(5, origin = $$props.origin);
    		if ("gender" in $$props) $$invalidate(6, gender = $$props.gender);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [name, status, imgUrl, linkImage, species, origin, gender];
    }

    class Card extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance, create_fragment, safe_not_equal, {
    			name: 0,
    			status: 1,
    			imgUrl: 2,
    			linkImage: 3,
    			species: 4,
    			origin: 5,
    			gender: 6
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Card",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*name*/ ctx[0] === undefined && !("name" in props)) {
    			console.warn("<Card> was created without expected prop 'name'");
    		}

    		if (/*status*/ ctx[1] === undefined && !("status" in props)) {
    			console.warn("<Card> was created without expected prop 'status'");
    		}

    		if (/*imgUrl*/ ctx[2] === undefined && !("imgUrl" in props)) {
    			console.warn("<Card> was created without expected prop 'imgUrl'");
    		}

    		if (/*linkImage*/ ctx[3] === undefined && !("linkImage" in props)) {
    			console.warn("<Card> was created without expected prop 'linkImage'");
    		}

    		if (/*species*/ ctx[4] === undefined && !("species" in props)) {
    			console.warn("<Card> was created without expected prop 'species'");
    		}

    		if (/*origin*/ ctx[5] === undefined && !("origin" in props)) {
    			console.warn("<Card> was created without expected prop 'origin'");
    		}

    		if (/*gender*/ ctx[6] === undefined && !("gender" in props)) {
    			console.warn("<Card> was created without expected prop 'gender'");
    		}
    	}

    	get name() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get status() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set status(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get imgUrl() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set imgUrl(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get linkImage() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set linkImage(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get species() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set species(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get origin() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set origin(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get gender() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set gender(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/ErrorAlert.svelte generated by Svelte v3.21.0 */
    const file$1 = "src/ErrorAlert.svelte";

    function create_fragment$1(ctx) {
    	let div;
    	let span;
    	let t0;
    	let h3;
    	let t2;
    	let p;
    	let div_intro;
    	let div_outro;
    	let current;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			span = element("span");
    			t0 = space();
    			h3 = element("h3");
    			h3.textContent = "No Characters Found!";
    			t2 = space();
    			p = element("p");
    			p.textContent = "There were no characters matching your criteria. Please try again.";
    			attr_dev(span, "class", "uk-alert-close");
    			attr_dev(span, "uk-close", "");
    			add_location(span, file$1, 15, 2, 264);
    			attr_dev(h3, "class", "svelte-2w6h2m");
    			add_location(h3, file$1, 16, 2, 343);
    			add_location(p, file$1, 17, 2, 375);
    			attr_dev(div, "uk-alert", "");
    			add_location(div, file$1, 11, 0, 162);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, div, anchor);
    			append_dev(div, span);
    			append_dev(div, t0);
    			append_dev(div, h3);
    			append_dev(div, t2);
    			append_dev(div, p);
    			current = true;
    			if (remount) dispose();
    			dispose = listen_dev(span, "click", /*click_handler*/ ctx[1], false, false, false);
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (div_outro) div_outro.end(1);
    				if (!div_intro) div_intro = create_in_transition(div, fade, { duration: 1500, delay: 1000 });
    				div_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (div_intro) div_intro.invalidate();
    			div_outro = create_out_transition(div, fade, { duration: 0, delay: 0 });
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching && div_outro) div_outro.end();
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { hasError } = $$props;
    	const writable_props = ["hasError"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<ErrorAlert> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("ErrorAlert", $$slots, []);
    	const click_handler = () => $$invalidate(0, hasError = false);

    	$$self.$set = $$props => {
    		if ("hasError" in $$props) $$invalidate(0, hasError = $$props.hasError);
    	};

    	$$self.$capture_state = () => ({ fade, hasError });

    	$$self.$inject_state = $$props => {
    		if ("hasError" in $$props) $$invalidate(0, hasError = $$props.hasError);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [hasError, click_handler];
    }

    class ErrorAlert extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { hasError: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ErrorAlert",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*hasError*/ ctx[0] === undefined && !("hasError" in props)) {
    			console.warn("<ErrorAlert> was created without expected prop 'hasError'");
    		}
    	}

    	get hasError() {
    		throw new Error("<ErrorAlert>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set hasError(value) {
    		throw new Error("<ErrorAlert>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.21.0 */

    const { console: console_1 } = globals;
    const file$2 = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[23] = list[i];
    	return child_ctx;
    }

    // (237:37) 
    function create_if_block_5(ctx) {
    	let section;
    	let h3;
    	let section_intro;
    	let section_outro;
    	let current;

    	const block = {
    		c: function create() {
    			section = element("section");
    			h3 = element("h3");
    			h3.textContent = "Get all Characters or Search for specific characters to get started.";
    			attr_dev(h3, "class", "svelte-yg8xh0");
    			add_location(h3, file$2, 238, 4, 5756);
    			attr_dev(section, "class", "svelte-yg8xh0");
    			add_location(section, file$2, 237, 2, 5708);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, h3);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (section_outro) section_outro.end(1);
    				if (!section_intro) section_intro = create_in_transition(section, fade, { delay: 500 });
    				section_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (section_intro) section_intro.invalidate();
    			section_outro = create_out_transition(section, fade, {});
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			if (detaching && section_outro) section_outro.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(237:37) ",
    		ctx
    	});

    	return block;
    }

    // (200:0) {#if hasCharacters}
    function create_if_block_3(ctx) {
    	let section0;
    	let t0;
    	let button;
    	let button_intro;
    	let button_outro;
    	let section0_intro;
    	let section0_outro;
    	let t2;
    	let section1;
    	let section1_intro;
    	let section1_outro;
    	let current;
    	let dispose;
    	let if_block = (/*previousPage*/ ctx[3] != "" || /*nextPage*/ ctx[2] != "") && create_if_block_4(ctx);
    	let each_value = /*characters*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			section0 = element("section");
    			if (if_block) if_block.c();
    			t0 = space();
    			button = element("button");
    			button.textContent = "Clear All Characters";
    			t2 = space();
    			section1 = element("section");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(button, "class", "uk-button uk-button-default svelte-yg8xh0");
    			add_location(button, file$2, 215, 4, 5071);
    			attr_dev(section0, "class", "svelte-yg8xh0");
    			add_location(section0, file$2, 200, 2, 4594);
    			attr_dev(section1, "class", "svelte-yg8xh0");
    			add_location(section1, file$2, 223, 2, 5273);
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, section0, anchor);
    			if (if_block) if_block.m(section0, null);
    			append_dev(section0, t0);
    			append_dev(section0, button);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, section1, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(section1, null);
    			}

    			current = true;
    			if (remount) dispose();
    			dispose = listen_dev(button, "click", /*resetCharacters*/ ctx[12], false, false, false);
    		},
    		p: function update(ctx, dirty) {
    			if (/*previousPage*/ ctx[3] != "" || /*nextPage*/ ctx[2] != "") {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_4(ctx);
    					if_block.c();
    					if_block.m(section0, t0);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*characters*/ 2) {
    				each_value = /*characters*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(section1, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (button_outro) button_outro.end(1);
    				if (!button_intro) button_intro = create_in_transition(button, fade, { delay: 1000 });
    				button_intro.start();
    			});

    			add_render_callback(() => {
    				if (section0_outro) section0_outro.end(1);
    				if (!section0_intro) section0_intro = create_in_transition(section0, fade, { delay: 1000 });
    				section0_intro.start();
    			});

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			add_render_callback(() => {
    				if (section1_outro) section1_outro.end(1);
    				if (!section1_intro) section1_intro = create_in_transition(section1, fade, { delay: 1000 });
    				section1_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (button_intro) button_intro.invalidate();
    			button_outro = create_out_transition(button, fade, { delay: 0 });
    			if (section0_intro) section0_intro.invalidate();
    			section0_outro = create_out_transition(section0, fade, { delay: 0 });
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			if (section1_intro) section1_intro.invalidate();
    			section1_outro = create_out_transition(section1, fade, { delay: 0 });
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section0);
    			if (if_block) if_block.d();
    			if (detaching && button_outro) button_outro.end();
    			if (detaching && section0_outro) section0_outro.end();
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(section1);
    			destroy_each(each_blocks, detaching);
    			if (detaching && section1_outro) section1_outro.end();
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(200:0) {#if hasCharacters}",
    		ctx
    	});

    	return block;
    }

    // (202:4) {#if previousPage != '' || nextPage != ''}
    function create_if_block_4(ctx) {
    	let button0;
    	let t0;
    	let t1;
    	let button1;
    	let t2;
    	let dispose;

    	const block = {
    		c: function create() {
    			button0 = element("button");
    			t0 = text("Previous Page");
    			t1 = space();
    			button1 = element("button");
    			t2 = text("Next Page");
    			attr_dev(button0, "class", "uk-button uk-button-default uk-margin-right svelte-yg8xh0");
    			button0.disabled = /*prevIsDisabled*/ ctx[9];
    			add_location(button0, file$2, 202, 6, 4707);
    			attr_dev(button1, "class", "uk-button uk-button-default uk-margin-right svelte-yg8xh0");
    			button1.disabled = /*nextIsDisabled*/ ctx[10];
    			add_location(button1, file$2, 208, 6, 4889);
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, button0, anchor);
    			append_dev(button0, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, button1, anchor);
    			append_dev(button1, t2);
    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(button0, "click", /*getPreviousPage*/ ctx[14], false, false, false),
    				listen_dev(button1, "click", /*getNextPage*/ ctx[13], false, false, false)
    			];
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*prevIsDisabled*/ 512) {
    				prop_dev(button0, "disabled", /*prevIsDisabled*/ ctx[9]);
    			}

    			if (dirty & /*nextIsDisabled*/ 1024) {
    				prop_dev(button1, "disabled", /*nextIsDisabled*/ ctx[10]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(button1);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(202:4) {#if previousPage != '' || nextPage != ''}",
    		ctx
    	});

    	return block;
    }

    // (225:4) {#each characters as character}
    function create_each_block(ctx) {
    	let current;

    	const card = new Card({
    			props: {
    				name: /*character*/ ctx[23].name,
    				status: /*character*/ ctx[23].status,
    				species: /*character*/ ctx[23].species,
    				gender: /*character*/ ctx[23].gender,
    				origin: /*character*/ ctx[23].origin.name,
    				imgUrl: /*character*/ ctx[23].image,
    				linkImage: /*character*/ ctx[23].image
    			},
    			$$inline: true
    		});

    	card.$on("click", /*click_handler*/ ctx[18]);

    	const block = {
    		c: function create() {
    			create_component(card.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(card, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const card_changes = {};
    			if (dirty & /*characters*/ 2) card_changes.name = /*character*/ ctx[23].name;
    			if (dirty & /*characters*/ 2) card_changes.status = /*character*/ ctx[23].status;
    			if (dirty & /*characters*/ 2) card_changes.species = /*character*/ ctx[23].species;
    			if (dirty & /*characters*/ 2) card_changes.gender = /*character*/ ctx[23].gender;
    			if (dirty & /*characters*/ 2) card_changes.origin = /*character*/ ctx[23].origin.name;
    			if (dirty & /*characters*/ 2) card_changes.imgUrl = /*character*/ ctx[23].image;
    			if (dirty & /*characters*/ 2) card_changes.linkImage = /*character*/ ctx[23].image;
    			card.$set(card_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(card.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(card.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(card, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(225:4) {#each characters as character}",
    		ctx
    	});

    	return block;
    }

    // (296:0) {#if hasCharacters}
    function create_if_block_1(ctx) {
    	let section;
    	let section_intro;
    	let section_outro;
    	let current;
    	let if_block = (/*previousPage*/ ctx[3] != "" || /*nextPage*/ ctx[2] != "") && create_if_block_2(ctx);

    	const block = {
    		c: function create() {
    			section = element("section");
    			if (if_block) if_block.c();
    			attr_dev(section, "class", "uk-margin-bottom svelte-yg8xh0");
    			add_location(section, file$2, 296, 2, 7543);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			if (if_block) if_block.m(section, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (/*previousPage*/ ctx[3] != "" || /*nextPage*/ ctx[2] != "") {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_2(ctx);
    					if_block.c();
    					if_block.m(section, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (section_outro) section_outro.end(1);
    				if (!section_intro) section_intro = create_in_transition(section, fade, { delay: 1000 });
    				section_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (section_intro) section_intro.invalidate();
    			section_outro = create_out_transition(section, fade, { delay: 0 });
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			if (if_block) if_block.d();
    			if (detaching && section_outro) section_outro.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(296:0) {#if hasCharacters}",
    		ctx
    	});

    	return block;
    }

    // (301:4) {#if previousPage != '' || nextPage != ''}
    function create_if_block_2(ctx) {
    	let button0;
    	let t0;
    	let t1;
    	let button1;
    	let t2;
    	let dispose;

    	const block = {
    		c: function create() {
    			button0 = element("button");
    			t0 = text("Previous Page");
    			t1 = space();
    			button1 = element("button");
    			t2 = text("Next Page");
    			attr_dev(button0, "class", "uk-button uk-button-default uk-margin-right svelte-yg8xh0");
    			button0.disabled = /*prevIsDisabled*/ ctx[9];
    			add_location(button0, file$2, 301, 6, 7693);
    			attr_dev(button1, "class", "uk-button uk-button-default uk-margin-right svelte-yg8xh0");
    			button1.disabled = /*nextIsDisabled*/ ctx[10];
    			add_location(button1, file$2, 307, 6, 7875);
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, button0, anchor);
    			append_dev(button0, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, button1, anchor);
    			append_dev(button1, t2);
    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(button0, "click", /*getPreviousPage*/ ctx[14], false, false, false),
    				listen_dev(button1, "click", /*getNextPage*/ ctx[13], false, false, false)
    			];
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*prevIsDisabled*/ 512) {
    				prop_dev(button0, "disabled", /*prevIsDisabled*/ ctx[9]);
    			}

    			if (dirty & /*nextIsDisabled*/ 1024) {
    				prop_dev(button1, "disabled", /*nextIsDisabled*/ ctx[10]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(button1);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(301:4) {#if previousPage != '' || nextPage != ''}",
    		ctx
    	});

    	return block;
    }

    // (319:0) {#if hasError}
    function create_if_block(ctx) {
    	let section;
    	let current;

    	const erroralert = new ErrorAlert({
    			props: { hasError: /*hasError*/ ctx[8] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			section = element("section");
    			create_component(erroralert.$$.fragment);
    			attr_dev(section, "class", "svelte-yg8xh0");
    			add_location(section, file$2, 319, 2, 8105);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			mount_component(erroralert, section, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const erroralert_changes = {};
    			if (dirty & /*hasError*/ 256) erroralert_changes.hasError = /*hasError*/ ctx[8];
    			erroralert.$set(erroralert_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(erroralert.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(erroralert.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			destroy_component(erroralert);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(319:0) {#if hasError}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div0;
    	let section;
    	let button0;
    	let t1;
    	let button1;
    	let t3;
    	let current_block_type_index;
    	let if_block0;
    	let t4;
    	let div5;
    	let div4;
    	let button2;
    	let t5;
    	let div1;
    	let h2;
    	let t7;
    	let div2;
    	let span0;
    	let t9;
    	let input0;
    	let t10;
    	let span1;
    	let t12;
    	let input1;
    	let t13;
    	let span2;
    	let t15;
    	let input2;
    	let t16;
    	let span3;
    	let t18;
    	let input3;
    	let t19;
    	let div3;
    	let button3;
    	let t21;
    	let button4;
    	let t23;
    	let t24;
    	let if_block2_anchor;
    	let current;
    	let dispose;
    	const if_block_creators = [create_if_block_3, create_if_block_5];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*hasCharacters*/ ctx[0]) return 0;
    		if (/*hasCharacters*/ ctx[0] || !/*hasError*/ ctx[8]) return 1;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type(ctx))) {
    		if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	let if_block1 = /*hasCharacters*/ ctx[0] && create_if_block_1(ctx);
    	let if_block2 = /*hasError*/ ctx[8] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			section = element("section");
    			button0 = element("button");
    			button0.textContent = "Get All Characters";
    			t1 = space();
    			button1 = element("button");
    			button1.textContent = "Search";
    			t3 = space();
    			if (if_block0) if_block0.c();
    			t4 = space();
    			div5 = element("div");
    			div4 = element("div");
    			button2 = element("button");
    			t5 = space();
    			div1 = element("div");
    			h2 = element("h2");
    			h2.textContent = "Search for your favorite Rick and Morty Characters!";
    			t7 = space();
    			div2 = element("div");
    			span0 = element("span");
    			span0.textContent = "Name:";
    			t9 = space();
    			input0 = element("input");
    			t10 = space();
    			span1 = element("span");
    			span1.textContent = "Status:";
    			t12 = space();
    			input1 = element("input");
    			t13 = space();
    			span2 = element("span");
    			span2.textContent = "Species:";
    			t15 = space();
    			input2 = element("input");
    			t16 = space();
    			span3 = element("span");
    			span3.textContent = "Gender:";
    			t18 = space();
    			input3 = element("input");
    			t19 = space();
    			div3 = element("div");
    			button3 = element("button");
    			button3.textContent = "Cancel";
    			t21 = space();
    			button4 = element("button");
    			button4.textContent = "Go";
    			t23 = space();
    			if (if_block1) if_block1.c();
    			t24 = space();
    			if (if_block2) if_block2.c();
    			if_block2_anchor = empty();
    			attr_dev(button0, "class", "uk-button uk-button-default uk-margin-right main-button svelte-yg8xh0");
    			add_location(button0, file$2, 185, 4, 4208);
    			attr_dev(button1, "class", "uk-button uk-button-default uk-margin-right main-button svelte-yg8xh0");
    			attr_dev(button1, "href", "#search-modal");
    			attr_dev(button1, "uk-toggle", "");
    			add_location(button1, file$2, 190, 4, 4361);
    			attr_dev(section, "class", "uk-margin-bottom  svelte-yg8xh0");
    			add_location(section, file$2, 184, 2, 4168);
    			attr_dev(div0, "class", "container svelte-yg8xh0");
    			add_location(div0, file$2, 183, 0, 4142);
    			attr_dev(button2, "class", "uk-modal-close-default svelte-yg8xh0");
    			attr_dev(button2, "type", "button");
    			attr_dev(button2, "uk-close", "");
    			add_location(button2, file$2, 248, 4, 6044);
    			attr_dev(h2, "class", "uk-modal-title svelte-yg8xh0");
    			add_location(h2, file$2, 250, 6, 6149);
    			attr_dev(div1, "class", "uk-modal-header");
    			add_location(div1, file$2, 249, 4, 6113);
    			attr_dev(span0, "for", "characterName");
    			attr_dev(span0, "class", "svelte-yg8xh0");
    			add_location(span0, file$2, 255, 6, 6298);
    			attr_dev(input0, "uk-tooltip", "Enter Character Name");
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "name", "characterName");
    			attr_dev(input0, "class", "svelte-yg8xh0");
    			add_location(input0, file$2, 256, 6, 6343);
    			attr_dev(span1, "for", "characterStatus");
    			attr_dev(span1, "class", "svelte-yg8xh0");
    			add_location(span1, file$2, 261, 6, 6485);
    			attr_dev(input1, "uk-tooltip", "Dead, alive, or unknown");
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "name", "characterStatus");
    			attr_dev(input1, "class", "svelte-yg8xh0");
    			add_location(input1, file$2, 262, 6, 6534);
    			attr_dev(span2, "for", "characterSpecies");
    			attr_dev(span2, "class", "svelte-yg8xh0");
    			add_location(span2, file$2, 267, 6, 6683);
    			attr_dev(input2, "uk-tooltip", "Human, robot, unknown, etc.");
    			attr_dev(input2, "type", "text");
    			attr_dev(input2, "name", "characterSpecies");
    			attr_dev(input2, "class", "svelte-yg8xh0");
    			add_location(input2, file$2, 268, 6, 6734);
    			attr_dev(span3, "for", "characterGender");
    			attr_dev(span3, "class", "svelte-yg8xh0");
    			add_location(span3, file$2, 273, 6, 6889);
    			attr_dev(input3, "uk-tooltip", "Male or Female");
    			attr_dev(input3, "type", "text");
    			attr_dev(input3, "name", "characterGender");
    			attr_dev(input3, "class", "svelte-yg8xh0");
    			add_location(input3, file$2, 274, 6, 6938);
    			attr_dev(div2, "class", "uk-modal-body");
    			add_location(div2, file$2, 254, 4, 6264);
    			attr_dev(button3, "class", "uk-button uk-button-default uk-modal-close svelte-yg8xh0");
    			attr_dev(button3, "type", "button");
    			add_location(button3, file$2, 281, 6, 7137);
    			attr_dev(button4, "class", "uk-button uk-button-default uk-modal-close svelte-yg8xh0");
    			attr_dev(button4, "type", "button");
    			add_location(button4, file$2, 284, 6, 7248);
    			attr_dev(div3, "class", "uk-modal-footer uk-text-right");
    			add_location(div3, file$2, 280, 4, 7087);
    			attr_dev(div4, "class", "uk-modal-dialog");
    			add_location(div4, file$2, 247, 2, 6010);
    			attr_dev(div5, "id", "search-modal");
    			attr_dev(div5, "uk-modal", "");
    			add_location(div5, file$2, 246, 0, 5975);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, section);
    			append_dev(section, button0);
    			append_dev(section, t1);
    			append_dev(section, button1);
    			insert_dev(target, t3, anchor);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].m(target, anchor);
    			}

    			insert_dev(target, t4, anchor);
    			insert_dev(target, div5, anchor);
    			append_dev(div5, div4);
    			append_dev(div4, button2);
    			append_dev(div4, t5);
    			append_dev(div4, div1);
    			append_dev(div1, h2);
    			append_dev(div4, t7);
    			append_dev(div4, div2);
    			append_dev(div2, span0);
    			append_dev(div2, t9);
    			append_dev(div2, input0);
    			set_input_value(input0, /*characterName*/ ctx[4]);
    			append_dev(div2, t10);
    			append_dev(div2, span1);
    			append_dev(div2, t12);
    			append_dev(div2, input1);
    			set_input_value(input1, /*characterStatus*/ ctx[5]);
    			append_dev(div2, t13);
    			append_dev(div2, span2);
    			append_dev(div2, t15);
    			append_dev(div2, input2);
    			set_input_value(input2, /*characterSpecies*/ ctx[6]);
    			append_dev(div2, t16);
    			append_dev(div2, span3);
    			append_dev(div2, t18);
    			append_dev(div2, input3);
    			set_input_value(input3, /*characterGender*/ ctx[7]);
    			append_dev(div4, t19);
    			append_dev(div4, div3);
    			append_dev(div3, button3);
    			append_dev(div3, t21);
    			append_dev(div3, button4);
    			insert_dev(target, t23, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, t24, anchor);
    			if (if_block2) if_block2.m(target, anchor);
    			insert_dev(target, if_block2_anchor, anchor);
    			current = true;
    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(button0, "click", /*getCharacters*/ ctx[11], false, false, false),
    				listen_dev(button1, "click", /*click_handler_1*/ ctx[17], false, false, false),
    				listen_dev(input0, "input", /*input0_input_handler*/ ctx[19]),
    				listen_dev(input1, "input", /*input1_input_handler*/ ctx[20]),
    				listen_dev(input2, "input", /*input2_input_handler*/ ctx[21]),
    				listen_dev(input3, "input", /*input3_input_handler*/ ctx[22]),
    				listen_dev(
    					button4,
    					"click",
    					function () {
    						if (is_function(/*searchCharacters*/ ctx[15](/*characterName*/ ctx[4], /*characterStatus*/ ctx[5], /*characterSpecies*/ ctx[6], /*characterGender*/ ctx[7]))) /*searchCharacters*/ ctx[15](/*characterName*/ ctx[4], /*characterStatus*/ ctx[5], /*characterSpecies*/ ctx[6], /*characterGender*/ ctx[7]).apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				)
    			];
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if (~current_block_type_index) {
    					if_blocks[current_block_type_index].p(ctx, dirty);
    				}
    			} else {
    				if (if_block0) {
    					group_outros();

    					transition_out(if_blocks[previous_block_index], 1, 1, () => {
    						if_blocks[previous_block_index] = null;
    					});

    					check_outros();
    				}

    				if (~current_block_type_index) {
    					if_block0 = if_blocks[current_block_type_index];

    					if (!if_block0) {
    						if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    						if_block0.c();
    					}

    					transition_in(if_block0, 1);
    					if_block0.m(t4.parentNode, t4);
    				} else {
    					if_block0 = null;
    				}
    			}

    			if (dirty & /*characterName*/ 16 && input0.value !== /*characterName*/ ctx[4]) {
    				set_input_value(input0, /*characterName*/ ctx[4]);
    			}

    			if (dirty & /*characterStatus*/ 32 && input1.value !== /*characterStatus*/ ctx[5]) {
    				set_input_value(input1, /*characterStatus*/ ctx[5]);
    			}

    			if (dirty & /*characterSpecies*/ 64 && input2.value !== /*characterSpecies*/ ctx[6]) {
    				set_input_value(input2, /*characterSpecies*/ ctx[6]);
    			}

    			if (dirty & /*characterGender*/ 128 && input3.value !== /*characterGender*/ ctx[7]) {
    				set_input_value(input3, /*characterGender*/ ctx[7]);
    			}

    			if (/*hasCharacters*/ ctx[0]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);

    					if (dirty & /*hasCharacters*/ 1) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block_1(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(t24.parentNode, t24);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}

    			if (/*hasError*/ ctx[8]) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);

    					if (dirty & /*hasError*/ 256) {
    						transition_in(if_block2, 1);
    					}
    				} else {
    					if_block2 = create_if_block(ctx);
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(if_block2_anchor.parentNode, if_block2_anchor);
    				}
    			} else if (if_block2) {
    				group_outros();

    				transition_out(if_block2, 1, 1, () => {
    					if_block2 = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(if_block1);
    			transition_in(if_block2);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			transition_out(if_block1);
    			transition_out(if_block2);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t3);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].d(detaching);
    			}

    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(div5);
    			if (detaching) detach_dev(t23);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(t24);
    			if (if_block2) if_block2.d(detaching);
    			if (detaching) detach_dev(if_block2_anchor);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let hasCharacters = false;
    	let characters = [];
    	let nextPage;
    	let previousPage;
    	let characterName;
    	let characterStatus;
    	let characterSpecies;
    	let characterGender;
    	let hasError = false;
    	let prevIsDisabled;
    	let nextIsDisabled;

    	function checkPages() {
    		if (!nextPage || nextPage == "") {
    			$$invalidate(10, nextIsDisabled = true);
    		} else {
    			$$invalidate(10, nextIsDisabled = false);
    		}

    		if (!previousPage || previousPage == "") {
    			$$invalidate(9, prevIsDisabled = true);
    		} else {
    			$$invalidate(9, prevIsDisabled = false);
    		}
    	}

    	async function getCharacters() {
    		$$invalidate(8, hasError = false);

    		await fetch(`https://rickandmortyapi.com/api/character/`).then(res => {
    			return res.json();
    		}).then(data => {
    			$$invalidate(1, characters = data.results);
    			$$invalidate(0, hasCharacters = true);
    			$$invalidate(2, nextPage = data.info.next ? data.info.next : "");
    			$$invalidate(3, previousPage = data.info.prev ? data.info.prev : "");
    		}).catch(err => {
    			console.log(err);
    		});

    		checkPages();
    	}

    	function resetCharacters() {
    		$$invalidate(1, characters = []);
    		$$invalidate(0, hasCharacters = false);
    		$$invalidate(8, hasError = false);
    	}

    	async function getNextPage() {
    		await fetch(nextPage).then(res => {
    			return res.json();
    		}).then(data => {
    			$$invalidate(1, characters = data.results);
    			$$invalidate(2, nextPage = data.info.next ? data.info.next : "");
    			$$invalidate(3, previousPage = data.info.prev ? data.info.prev : "");
    			$$invalidate(0, hasCharacters = true);
    		}).catch(err => {
    			console.log(err);
    		});

    		checkPages();
    	}

    	async function getPreviousPage() {
    		await fetch(previousPage).then(res => {
    			return res.json();
    		}).then(data => {
    			$$invalidate(1, characters = data.results);
    			$$invalidate(2, nextPage = data.info.next ? data.info.next : "");
    			$$invalidate(3, previousPage = data.info.prev ? data.info.prev : "");
    			$$invalidate(0, hasCharacters = true);
    		}).catch(err => {
    			console.log(err);
    		});

    		checkPages();
    	}

    	async function searchCharacters(name, status, species, gender) {
    		let hasName = !name ? "" : name;
    		let hasStatus = !status ? "" : status;
    		let hasSpecies = !species ? "" : species;
    		let hasGender = !gender ? "" : gender;
    		$$invalidate(8, hasError = false);

    		await fetch(`https://rickandmortyapi.com/api/character/?name=${hasName}&status=${hasStatus}&species=${hasSpecies}&gender=${hasGender}`).then(res => {
    			if (!res.ok) {
    				$$invalidate(0, hasCharacters = false);
    				$$invalidate(8, hasError = true);
    				return;
    			} else {
    				return res.json();
    			}
    		}).then(data => {
    			$$invalidate(1, characters = data.results);
    			$$invalidate(2, nextPage = data.info.next);
    			$$invalidate(3, previousPage = data.info.prev);
    			$$invalidate(0, hasCharacters = true);
    		}).catch(err => {
    			console.log(err);
    		});

    		checkPages();

    		// clear modal values
    		$$invalidate(4, characterName = "");

    		$$invalidate(5, characterStatus = "");
    		$$invalidate(6, characterSpecies = "");
    		$$invalidate(7, characterGender = "");
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);
    	const click_handler_1 = () => $$invalidate(8, hasError = false);

    	function click_handler(event) {
    		bubble($$self, event);
    	}

    	function input0_input_handler() {
    		characterName = this.value;
    		$$invalidate(4, characterName);
    	}

    	function input1_input_handler() {
    		characterStatus = this.value;
    		$$invalidate(5, characterStatus);
    	}

    	function input2_input_handler() {
    		characterSpecies = this.value;
    		$$invalidate(6, characterSpecies);
    	}

    	function input3_input_handler() {
    		characterGender = this.value;
    		$$invalidate(7, characterGender);
    	}

    	$$self.$capture_state = () => ({
    		Card,
    		ErrorAlert,
    		fade,
    		hasCharacters,
    		characters,
    		nextPage,
    		previousPage,
    		characterName,
    		characterStatus,
    		characterSpecies,
    		characterGender,
    		hasError,
    		prevIsDisabled,
    		nextIsDisabled,
    		checkPages,
    		getCharacters,
    		resetCharacters,
    		getNextPage,
    		getPreviousPage,
    		searchCharacters
    	});

    	$$self.$inject_state = $$props => {
    		if ("hasCharacters" in $$props) $$invalidate(0, hasCharacters = $$props.hasCharacters);
    		if ("characters" in $$props) $$invalidate(1, characters = $$props.characters);
    		if ("nextPage" in $$props) $$invalidate(2, nextPage = $$props.nextPage);
    		if ("previousPage" in $$props) $$invalidate(3, previousPage = $$props.previousPage);
    		if ("characterName" in $$props) $$invalidate(4, characterName = $$props.characterName);
    		if ("characterStatus" in $$props) $$invalidate(5, characterStatus = $$props.characterStatus);
    		if ("characterSpecies" in $$props) $$invalidate(6, characterSpecies = $$props.characterSpecies);
    		if ("characterGender" in $$props) $$invalidate(7, characterGender = $$props.characterGender);
    		if ("hasError" in $$props) $$invalidate(8, hasError = $$props.hasError);
    		if ("prevIsDisabled" in $$props) $$invalidate(9, prevIsDisabled = $$props.prevIsDisabled);
    		if ("nextIsDisabled" in $$props) $$invalidate(10, nextIsDisabled = $$props.nextIsDisabled);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		hasCharacters,
    		characters,
    		nextPage,
    		previousPage,
    		characterName,
    		characterStatus,
    		characterSpecies,
    		characterGender,
    		hasError,
    		prevIsDisabled,
    		nextIsDisabled,
    		getCharacters,
    		resetCharacters,
    		getNextPage,
    		getPreviousPage,
    		searchCharacters,
    		checkPages,
    		click_handler_1,
    		click_handler,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler,
    		input3_input_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    const app = new App({
      target: document.body,
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
