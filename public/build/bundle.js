
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
    function null_to_empty(value) {
        return value == null ? '' : value;
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
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = program.b - t;
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
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
    	let i;
    	let i_class_value;
    	let t1;
    	let t2;
    	let t3;
    	let div6;
    	let div5;
    	let div1;
    	let t4;
    	let t5;
    	let t6;
    	let hr0;
    	let t7;
    	let div2;
    	let t8;
    	let t9;
    	let t10;
    	let hr1;
    	let t11;
    	let div3;
    	let t12;
    	let t13;
    	let t14;
    	let hr2;
    	let t15;
    	let div4;
    	let t16;
    	let t17;

    	const block = {
    		c: function create() {
    			div7 = element("div");
    			header = element("header");
    			a = element("a");
    			img = element("img");
    			t0 = space();
    			div0 = element("div");
    			h3 = element("h3");
    			i = element("i");
    			t1 = space();
    			t2 = text(/*name*/ ctx[0]);
    			t3 = space();
    			div6 = element("div");
    			div5 = element("div");
    			div1 = element("div");
    			t4 = text("Status: ");
    			t5 = text(/*status*/ ctx[1]);
    			t6 = space();
    			hr0 = element("hr");
    			t7 = space();
    			div2 = element("div");
    			t8 = text("Species: ");
    			t9 = text(/*species*/ ctx[4]);
    			t10 = space();
    			hr1 = element("hr");
    			t11 = space();
    			div3 = element("div");
    			t12 = text("Gender: ");
    			t13 = text(/*gender*/ ctx[6]);
    			t14 = space();
    			hr2 = element("hr");
    			t15 = space();
    			div4 = element("div");
    			t16 = text("Origin: ");
    			t17 = text(/*origin*/ ctx[5]);
    			if (img.src !== (img_src_value = /*imgUrl*/ ctx[2])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", /*name*/ ctx[0]);
    			attr_dev(img, "class", "svelte-r5ajpf");
    			add_location(img, file, 62, 6, 1472);
    			attr_dev(i, "class", i_class_value = "" + (null_to_empty(/*statusClass*/ ctx[7]) + " svelte-r5ajpf"));
    			add_location(i, file, 65, 10, 1596);
    			attr_dev(h3, "class", "svelte-r5ajpf");
    			add_location(h3, file, 64, 8, 1581);
    			attr_dev(div0, "class", "uk-overlay uk-overlay-primary uk-position-bottom svelte-r5ajpf");
    			add_location(div0, file, 63, 6, 1510);
    			attr_dev(a, "href", /*linkImage*/ ctx[3]);
    			attr_dev(a, "class", "svelte-r5ajpf");
    			add_location(a, file, 61, 4, 1445);
    			attr_dev(header, "class", "image uk-inline svelte-r5ajpf");
    			attr_dev(header, "uk-lightbox", "transition: fade");
    			add_location(header, file, 60, 2, 1377);
    			add_location(div1, file, 73, 6, 1727);
    			add_location(hr0, file, 74, 6, 1761);
    			add_location(div2, file, 75, 6, 1774);
    			add_location(hr1, file, 76, 6, 1810);
    			add_location(div3, file, 77, 6, 1823);
    			add_location(hr2, file, 78, 6, 1857);
    			add_location(div4, file, 79, 6, 1870);
    			attr_dev(div5, "class", "details svelte-r5ajpf");
    			add_location(div5, file, 72, 4, 1699);
    			add_location(div6, file, 71, 2, 1689);
    			attr_dev(div7, "class", "container svelte-r5ajpf");
    			add_location(div7, file, 59, 0, 1351);
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
    			append_dev(h3, i);
    			append_dev(h3, t1);
    			append_dev(h3, t2);
    			append_dev(div7, t3);
    			append_dev(div7, div6);
    			append_dev(div6, div5);
    			append_dev(div5, div1);
    			append_dev(div1, t4);
    			append_dev(div1, t5);
    			append_dev(div5, t6);
    			append_dev(div5, hr0);
    			append_dev(div5, t7);
    			append_dev(div5, div2);
    			append_dev(div2, t8);
    			append_dev(div2, t9);
    			append_dev(div5, t10);
    			append_dev(div5, hr1);
    			append_dev(div5, t11);
    			append_dev(div5, div3);
    			append_dev(div3, t12);
    			append_dev(div3, t13);
    			append_dev(div5, t14);
    			append_dev(div5, hr2);
    			append_dev(div5, t15);
    			append_dev(div5, div4);
    			append_dev(div4, t16);
    			append_dev(div4, t17);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*imgUrl*/ 4 && img.src !== (img_src_value = /*imgUrl*/ ctx[2])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*name*/ 1) {
    				attr_dev(img, "alt", /*name*/ ctx[0]);
    			}

    			if (dirty & /*statusClass*/ 128 && i_class_value !== (i_class_value = "" + (null_to_empty(/*statusClass*/ ctx[7]) + " svelte-r5ajpf"))) {
    				attr_dev(i, "class", i_class_value);
    			}

    			if (dirty & /*name*/ 1) set_data_dev(t2, /*name*/ ctx[0]);

    			if (dirty & /*linkImage*/ 8) {
    				attr_dev(a, "href", /*linkImage*/ ctx[3]);
    			}

    			if (dirty & /*status*/ 2) set_data_dev(t5, /*status*/ ctx[1]);
    			if (dirty & /*species*/ 16) set_data_dev(t9, /*species*/ ctx[4]);
    			if (dirty & /*gender*/ 64) set_data_dev(t13, /*gender*/ ctx[6]);
    			if (dirty & /*origin*/ 32) set_data_dev(t17, /*origin*/ ctx[5]);
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
    	let { statusClass } = $$props;

    	const writable_props = [
    		"name",
    		"status",
    		"imgUrl",
    		"linkImage",
    		"species",
    		"origin",
    		"gender",
    		"statusClass"
    	];

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
    		if ("statusClass" in $$props) $$invalidate(7, statusClass = $$props.statusClass);
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
    		gender,
    		statusClass
    	});

    	$$self.$inject_state = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    		if ("status" in $$props) $$invalidate(1, status = $$props.status);
    		if ("imgUrl" in $$props) $$invalidate(2, imgUrl = $$props.imgUrl);
    		if ("linkImage" in $$props) $$invalidate(3, linkImage = $$props.linkImage);
    		if ("species" in $$props) $$invalidate(4, species = $$props.species);
    		if ("origin" in $$props) $$invalidate(5, origin = $$props.origin);
    		if ("gender" in $$props) $$invalidate(6, gender = $$props.gender);
    		if ("statusClass" in $$props) $$invalidate(7, statusClass = $$props.statusClass);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [name, status, imgUrl, linkImage, species, origin, gender, statusClass];
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
    			gender: 6,
    			statusClass: 7
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

    		if (/*statusClass*/ ctx[7] === undefined && !("statusClass" in props)) {
    			console.warn("<Card> was created without expected prop 'statusClass'");
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

    	get statusClass() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set statusClass(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Footer.svelte generated by Svelte v3.21.0 */

    const file$1 = "src/Footer.svelte";

    function create_fragment$1(ctx) {
    	let section;
    	let a0;
    	let i0;
    	let t0;
    	let a1;
    	let i1;
    	let t1;
    	let a2;
    	let i2;
    	let t2;
    	let a3;
    	let i3;
    	let section_class_value;

    	const block = {
    		c: function create() {
    			section = element("section");
    			a0 = element("a");
    			i0 = element("i");
    			t0 = space();
    			a1 = element("a");
    			i1 = element("i");
    			t1 = space();
    			a2 = element("a");
    			i2 = element("i");
    			t2 = space();
    			a3 = element("a");
    			i3 = element("i");
    			attr_dev(i0, "class", "fab fa-github svelte-moq7ac");
    			add_location(i0, file$1, 40, 4, 733);
    			attr_dev(a0, "href", "https://github.com/jdaake/rickAndMortyAPI");
    			attr_dev(a0, "target", "_blank");
    			add_location(a0, file$1, 39, 2, 660);
    			attr_dev(i1, "class", "fab fa-instagram svelte-moq7ac");
    			add_location(i1, file$1, 43, 4, 836);
    			attr_dev(a1, "href", "https://www.instagram.com/j.daake/");
    			attr_dev(a1, "target", "_blank");
    			add_location(a1, file$1, 42, 2, 770);
    			attr_dev(i2, "class", "fab fa-twitter svelte-moq7ac");
    			add_location(i2, file$1, 46, 4, 938);
    			attr_dev(a2, "href", "https://www.twitter.com/jdaake");
    			attr_dev(a2, "target", "_blank");
    			add_location(a2, file$1, 45, 2, 876);
    			attr_dev(i3, "class", "fab fa-linkedin svelte-moq7ac");
    			add_location(i3, file$1, 49, 4, 1041);
    			attr_dev(a3, "href", "https://www.linkedin.com/e/jdaake");
    			attr_dev(a3, "target", "_blank");
    			add_location(a3, file$1, 48, 2, 976);
    			attr_dev(section, "class", section_class_value = "" + (null_to_empty(/*positionClass*/ ctx[0]) + " svelte-moq7ac"));
    			add_location(section, file$1, 38, 0, 626);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, a0);
    			append_dev(a0, i0);
    			append_dev(section, t0);
    			append_dev(section, a1);
    			append_dev(a1, i1);
    			append_dev(section, t1);
    			append_dev(section, a2);
    			append_dev(a2, i2);
    			append_dev(section, t2);
    			append_dev(section, a3);
    			append_dev(a3, i3);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*positionClass*/ 1 && section_class_value !== (section_class_value = "" + (null_to_empty(/*positionClass*/ ctx[0]) + " svelte-moq7ac"))) {
    				attr_dev(section, "class", section_class_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
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
    	let { positionClass } = $$props;
    	const writable_props = ["positionClass"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Footer> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Footer", $$slots, []);

    	$$self.$set = $$props => {
    		if ("positionClass" in $$props) $$invalidate(0, positionClass = $$props.positionClass);
    	};

    	$$self.$capture_state = () => ({ positionClass });

    	$$self.$inject_state = $$props => {
    		if ("positionClass" in $$props) $$invalidate(0, positionClass = $$props.positionClass);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [positionClass];
    }

    class Footer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { positionClass: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Footer",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*positionClass*/ ctx[0] === undefined && !("positionClass" in props)) {
    			console.warn("<Footer> was created without expected prop 'positionClass'");
    		}
    	}

    	get positionClass() {
    		throw new Error("<Footer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set positionClass(value) {
    		throw new Error("<Footer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Banner.svelte generated by Svelte v3.21.0 */
    const file$2 = "src/Banner.svelte";

    function create_fragment$2(ctx) {
    	let section;
    	let div;
    	let img;
    	let img_src_value;
    	let div_transition;
    	let current;
    	let dispose;

    	const block = {
    		c: function create() {
    			section = element("section");
    			div = element("div");
    			img = element("img");
    			if (img.src !== (img_src_value = /*src*/ ctx[0])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "style", /*bgColor*/ ctx[1]);
    			attr_dev(img, "alt", "Rick and Morty");
    			add_location(img, file$2, 41, 4, 986);
    			attr_dev(div, "class", "banner");
    			add_location(div, file$2, 30, 2, 725);
    			attr_dev(section, "style", /*bgColor*/ ctx[1]);
    			attr_dev(section, "class", "svelte-m6mb35");
    			add_location(section, file$2, 29, 0, 697);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, section, anchor);
    			append_dev(section, div);
    			append_dev(div, img);
    			current = true;
    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(div, "mouseenter", /*mouseenter_handler*/ ctx[6], false, false, false),
    				listen_dev(div, "mouseleave", /*mouseleave_handler*/ ctx[7], false, false, false)
    			];
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*src*/ 1 && img.src !== (img_src_value = /*src*/ ctx[0])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (!current || dirty & /*bgColor*/ 2) {
    				attr_dev(img, "style", /*bgColor*/ ctx[1]);
    			}

    			if (!current || dirty & /*bgColor*/ 2) {
    				attr_dev(section, "style", /*bgColor*/ ctx[1]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, fade, { duration: 700, delay: 500 }, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div_transition) div_transition = create_bidirectional_transition(div, fade, { duration: 700, delay: 500 }, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			if (detaching && div_transition) div_transition.end();
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
    	let { src = "assets/banner.png" } = $$props;
    	let { bgColor = "background-color:black;" } = $$props;
    	let originalBgColor = "background-color:black;";
    	let invertBgColor = "background-color:white;";
    	let originalSrc = "assets/banner.png";
    	let invertSrc = "assets/invertRotateBanner.png";
    	const writable_props = ["src", "bgColor"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Banner> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Banner", $$slots, []);

    	const mouseenter_handler = () => {
    		$$invalidate(1, bgColor = invertBgColor);
    		$$invalidate(0, src = invertSrc);
    	};

    	const mouseleave_handler = () => {
    		$$invalidate(1, bgColor = originalBgColor);
    		$$invalidate(0, src = originalSrc);
    	};

    	$$self.$set = $$props => {
    		if ("src" in $$props) $$invalidate(0, src = $$props.src);
    		if ("bgColor" in $$props) $$invalidate(1, bgColor = $$props.bgColor);
    	};

    	$$self.$capture_state = () => ({
    		src,
    		bgColor,
    		originalBgColor,
    		invertBgColor,
    		originalSrc,
    		invertSrc,
    		fade
    	});

    	$$self.$inject_state = $$props => {
    		if ("src" in $$props) $$invalidate(0, src = $$props.src);
    		if ("bgColor" in $$props) $$invalidate(1, bgColor = $$props.bgColor);
    		if ("originalBgColor" in $$props) $$invalidate(2, originalBgColor = $$props.originalBgColor);
    		if ("invertBgColor" in $$props) $$invalidate(3, invertBgColor = $$props.invertBgColor);
    		if ("originalSrc" in $$props) $$invalidate(4, originalSrc = $$props.originalSrc);
    		if ("invertSrc" in $$props) $$invalidate(5, invertSrc = $$props.invertSrc);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		src,
    		bgColor,
    		originalBgColor,
    		invertBgColor,
    		originalSrc,
    		invertSrc,
    		mouseenter_handler,
    		mouseleave_handler
    	];
    }

    class Banner extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { src: 0, bgColor: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Banner",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get src() {
    		throw new Error("<Banner>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set src(value) {
    		throw new Error("<Banner>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get bgColor() {
    		throw new Error("<Banner>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set bgColor(value) {
    		throw new Error("<Banner>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/ErrorAlert.svelte generated by Svelte v3.21.0 */
    const file$3 = "src/ErrorAlert.svelte";

    function create_fragment$3(ctx) {
    	let div;
    	let span;
    	let t0;
    	let h2;
    	let t2;
    	let p;
    	let t4;
    	let section;
    	let img;
    	let img_src_value;
    	let div_intro;
    	let div_outro;
    	let current;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			span = element("span");
    			t0 = space();
    			h2 = element("h2");
    			h2.textContent = "No Characters Found!";
    			t2 = space();
    			p = element("p");
    			p.textContent = "There were no characters matching your criteria. Please try again.";
    			t4 = space();
    			section = element("section");
    			img = element("img");
    			attr_dev(span, "class", "uk-alert-close");
    			attr_dev(span, "uk-close", "");
    			add_location(span, file$3, 32, 2, 577);
    			attr_dev(h2, "class", "svelte-afrmxu");
    			add_location(h2, file$3, 33, 2, 629);
    			attr_dev(p, "class", "svelte-afrmxu");
    			add_location(p, file$3, 34, 2, 661);
    			attr_dev(img, "class", "uk-padding-left svelte-afrmxu");
    			if (img.src !== (img_src_value = "https://media.giphy.com/media/3ov9k1ZNTELhynEI2A/giphy.gif")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "");
    			add_location(img, file$3, 36, 4, 751);
    			attr_dev(section, "class", "svelte-afrmxu");
    			add_location(section, file$3, 35, 2, 737);
    			attr_dev(div, "class", "uk-background-default");
    			attr_dev(div, "uk-alert", "");
    			add_location(div, file$3, 27, 0, 443);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, div, anchor);
    			append_dev(div, span);
    			append_dev(div, t0);
    			append_dev(div, h2);
    			append_dev(div, t2);
    			append_dev(div, p);
    			append_dev(div, t4);
    			append_dev(div, section);
    			append_dev(section, img);
    			current = true;
    			if (remount) dispose();
    			dispose = listen_dev(span, "click", /*click_handler*/ ctx[1], false, false, false);
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (div_outro) div_outro.end(1);
    				if (!div_intro) div_intro = create_in_transition(div, fade, { duration: 700, delay: 700 });
    				div_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (div_intro) div_intro.invalidate();
    			div_outro = create_out_transition(div, fade, { duration: 700, delay: 0 });
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
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { hasError } = $$props;
    	const writable_props = ["hasError"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<ErrorAlert> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("ErrorAlert", $$slots, []);

    	function click_handler(event) {
    		bubble($$self, event);
    	}

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
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { hasError: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ErrorAlert",
    			options,
    			id: create_fragment$3.name
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
    const file$4 = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[37] = list[i];
    	return child_ctx;
    }

    // (358:37) 
    function create_if_block_4(ctx) {
    	let section0;
    	let h3;
    	let section0_intro;
    	let section0_outro;
    	let t1;
    	let section1;
    	let section1_intro;
    	let section1_outro;
    	let current;

    	const footer = new Footer({
    			props: { positionClass: "absolute" },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			section0 = element("section");
    			h3 = element("h3");
    			h3.textContent = "Search for your favorite Rick and Morty characters or Get All to browse.";
    			t1 = space();
    			section1 = element("section");
    			create_component(footer.$$.fragment);
    			attr_dev(h3, "class", "svelte-16paps3");
    			add_location(h3, file$4, 361, 4, 8792);
    			attr_dev(section0, "class", "svelte-16paps3");
    			add_location(section0, file$4, 358, 2, 8691);
    			attr_dev(section1, "class", "svelte-16paps3");
    			add_location(section1, file$4, 365, 2, 8901);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section0, anchor);
    			append_dev(section0, h3);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, section1, anchor);
    			mount_component(footer, section1, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (section0_outro) section0_outro.end(1);
    				if (!section0_intro) section0_intro = create_in_transition(section0, fade, { duration: 700, delay: 500 });
    				section0_intro.start();
    			});

    			transition_in(footer.$$.fragment, local);

    			add_render_callback(() => {
    				if (section1_outro) section1_outro.end(1);
    				if (!section1_intro) section1_intro = create_in_transition(section1, fade, { duration: 700, delay: 500 });
    				section1_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (section0_intro) section0_intro.invalidate();
    			section0_outro = create_out_transition(section0, fade, { duration: 700, delay: 0 });
    			transition_out(footer.$$.fragment, local);
    			if (section1_intro) section1_intro.invalidate();
    			section1_outro = create_out_transition(section1, fade, { duration: 700, delay: 0 });
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section0);
    			if (detaching && section0_outro) section0_outro.end();
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(section1);
    			destroy_component(footer);
    			if (detaching && section1_outro) section1_outro.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(358:37) ",
    		ctx
    	});

    	return block;
    }

    // (289:0) {#if hasCharacters}
    function create_if_block_1(ctx) {
    	let hr;
    	let hr_intro;
    	let hr_outro;
    	let t0;
    	let section0;
    	let t1;
    	let button;
    	let button_intro;
    	let button_outro;
    	let section0_intro;
    	let section0_outro;
    	let t3;
    	let section1;
    	let section1_intro;
    	let section1_outro;
    	let t4;
    	let section2;
    	let section2_intro;
    	let section2_outro;
    	let t5;
    	let current;
    	let dispose;
    	let if_block0 = (/*previousPage*/ ctx[3] != "" || /*nextPage*/ ctx[2] != "") && create_if_block_3(ctx);
    	let each_value = /*characters*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	let if_block1 = (/*previousPage*/ ctx[3] != "" || /*nextPage*/ ctx[2] != "") && create_if_block_2(ctx);

    	const footer = new Footer({
    			props: { positionClass: "relative" },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			hr = element("hr");
    			t0 = space();
    			section0 = element("section");
    			if (if_block0) if_block0.c();
    			t1 = space();
    			button = element("button");
    			button.textContent = "Clear All Characters";
    			t3 = space();
    			section1 = element("section");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t4 = space();
    			section2 = element("section");
    			if (if_block1) if_block1.c();
    			t5 = space();
    			create_component(footer.$$.fragment);
    			add_location(hr, file$4, 289, 2, 6562);
    			attr_dev(button, "class", "uk-button uk-button-default svelte-16paps3");
    			add_location(button, file$4, 309, 4, 7203);
    			attr_dev(section0, "class", "svelte-16paps3");
    			add_location(section0, file$4, 292, 2, 6658);
    			attr_dev(section1, "class", "margin-top svelte-16paps3");
    			add_location(section1, file$4, 318, 2, 7428);
    			attr_dev(section2, "class", "uk-margin-bottom bottom-nav svelte-16paps3");
    			add_location(section2, file$4, 335, 2, 7967);
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, hr, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, section0, anchor);
    			if (if_block0) if_block0.m(section0, null);
    			append_dev(section0, t1);
    			append_dev(section0, button);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, section1, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(section1, null);
    			}

    			insert_dev(target, t4, anchor);
    			insert_dev(target, section2, anchor);
    			if (if_block1) if_block1.m(section2, null);
    			insert_dev(target, t5, anchor);
    			mount_component(footer, target, anchor);
    			current = true;
    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(button, "click", /*resetCharacters*/ ctx[14], false, false, false),
    				listen_dev(button, "click", /*twitch*/ ctx[16], false, false, false)
    			];
    		},
    		p: function update(ctx, dirty) {
    			if (/*previousPage*/ ctx[3] != "" || /*nextPage*/ ctx[2] != "") {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_3(ctx);
    					if_block0.c();
    					if_block0.m(section0, t1);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (dirty[0] & /*characters*/ 2) {
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

    			if (/*previousPage*/ ctx[3] != "" || /*nextPage*/ ctx[2] != "") {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_2(ctx);
    					if_block1.c();
    					if_block1.m(section2, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (hr_outro) hr_outro.end(1);
    				if (!hr_intro) hr_intro = create_in_transition(hr, fade, { duration: 700, delay: 700 });
    				hr_intro.start();
    			});

    			add_render_callback(() => {
    				if (button_outro) button_outro.end(1);
    				if (!button_intro) button_intro = create_in_transition(button, fade, { delay: 700 });
    				button_intro.start();
    			});

    			add_render_callback(() => {
    				if (section0_outro) section0_outro.end(1);
    				if (!section0_intro) section0_intro = create_in_transition(section0, fade, { duration: 700, delay: 700 });
    				section0_intro.start();
    			});

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			add_render_callback(() => {
    				if (section1_outro) section1_outro.end(1);
    				if (!section1_intro) section1_intro = create_in_transition(section1, fade, { duration: 700, delay: 700 });
    				section1_intro.start();
    			});

    			add_render_callback(() => {
    				if (section2_outro) section2_outro.end(1);
    				if (!section2_intro) section2_intro = create_in_transition(section2, fade, { delay: 700 });
    				section2_intro.start();
    			});

    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (hr_intro) hr_intro.invalidate();
    			hr_outro = create_out_transition(hr, fade, { duration: 700, delay: 0 });
    			if (button_intro) button_intro.invalidate();
    			button_outro = create_out_transition(button, fade, { delay: 0 });
    			if (section0_intro) section0_intro.invalidate();
    			section0_outro = create_out_transition(section0, fade, { duration: 700, delay: 0 });
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			if (section1_intro) section1_intro.invalidate();
    			section1_outro = create_out_transition(section1, fade, { duration: 700, delay: 0 });
    			if (section2_intro) section2_intro.invalidate();
    			section2_outro = create_out_transition(section2, fade, { delay: 0 });
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(hr);
    			if (detaching && hr_outro) hr_outro.end();
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(section0);
    			if (if_block0) if_block0.d();
    			if (detaching && button_outro) button_outro.end();
    			if (detaching && section0_outro) section0_outro.end();
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(section1);
    			destroy_each(each_blocks, detaching);
    			if (detaching && section1_outro) section1_outro.end();
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(section2);
    			if (if_block1) if_block1.d();
    			if (detaching && section2_outro) section2_outro.end();
    			if (detaching) detach_dev(t5);
    			destroy_component(footer, detaching);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(289:0) {#if hasCharacters}",
    		ctx
    	});

    	return block;
    }

    // (296:4) {#if previousPage != '' || nextPage != ''}
    function create_if_block_3(ctx) {
    	let button0;
    	let i0;
    	let t;
    	let button1;
    	let i1;
    	let dispose;

    	const block = {
    		c: function create() {
    			button0 = element("button");
    			i0 = element("i");
    			t = space();
    			button1 = element("button");
    			i1 = element("i");
    			attr_dev(i0, "class", "fas fa-arrow-left");
    			add_location(i0, file$4, 300, 8, 6949);
    			attr_dev(button0, "class", "uk-button uk-button-default mainButton svelte-16paps3");
    			button0.disabled = /*prevIsDisabled*/ ctx[9];
    			add_location(button0, file$4, 296, 6, 6808);
    			attr_dev(i1, "class", "fas fa-arrow-right");
    			add_location(i1, file$4, 306, 8, 7140);
    			attr_dev(button1, "class", "uk-button uk-button-default mainButton svelte-16paps3");
    			button1.disabled = /*nextIsDisabled*/ ctx[10];
    			add_location(button1, file$4, 302, 6, 7003);
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, button0, anchor);
    			append_dev(button0, i0);
    			insert_dev(target, t, anchor);
    			insert_dev(target, button1, anchor);
    			append_dev(button1, i1);
    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(button0, "click", /*getPreviousPage*/ ctx[19], false, false, false),
    				listen_dev(button1, "click", /*getNextPage*/ ctx[18], false, false, false)
    			];
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*prevIsDisabled*/ 512) {
    				prop_dev(button0, "disabled", /*prevIsDisabled*/ ctx[9]);
    			}

    			if (dirty[0] & /*nextIsDisabled*/ 1024) {
    				prop_dev(button1, "disabled", /*nextIsDisabled*/ ctx[10]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(button1);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(296:4) {#if previousPage != '' || nextPage != ''}",
    		ctx
    	});

    	return block;
    }

    // (323:4) {#each characters as character}
    function create_each_block(ctx) {
    	let current;

    	const card = new Card({
    			props: {
    				name: /*character*/ ctx[37].name,
    				status: /*character*/ ctx[37].status,
    				species: /*character*/ ctx[37].species,
    				gender: /*character*/ ctx[37].gender,
    				origin: /*character*/ ctx[37].origin.name,
    				imgUrl: /*character*/ ctx[37].image,
    				linkImage: /*character*/ ctx[37].image,
    				statusClass: /*character*/ ctx[37].status == "Dead"
    				? "fas fa-skull-crossbones"
    				: ""
    			},
    			$$inline: true
    		});

    	card.$on("click", /*click_handler*/ ctx[28]);

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
    			if (dirty[0] & /*characters*/ 2) card_changes.name = /*character*/ ctx[37].name;
    			if (dirty[0] & /*characters*/ 2) card_changes.status = /*character*/ ctx[37].status;
    			if (dirty[0] & /*characters*/ 2) card_changes.species = /*character*/ ctx[37].species;
    			if (dirty[0] & /*characters*/ 2) card_changes.gender = /*character*/ ctx[37].gender;
    			if (dirty[0] & /*characters*/ 2) card_changes.origin = /*character*/ ctx[37].origin.name;
    			if (dirty[0] & /*characters*/ 2) card_changes.imgUrl = /*character*/ ctx[37].image;
    			if (dirty[0] & /*characters*/ 2) card_changes.linkImage = /*character*/ ctx[37].image;

    			if (dirty[0] & /*characters*/ 2) card_changes.statusClass = /*character*/ ctx[37].status == "Dead"
    			? "fas fa-skull-crossbones"
    			: "";

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
    		source: "(323:4) {#each characters as character}",
    		ctx
    	});

    	return block;
    }

    // (340:4) {#if previousPage != '' || nextPage != ''}
    function create_if_block_2(ctx) {
    	let button0;
    	let i0;
    	let t;
    	let button1;
    	let i1;
    	let dispose;

    	const block = {
    		c: function create() {
    			button0 = element("button");
    			i0 = element("i");
    			t = space();
    			button1 = element("button");
    			i1 = element("i");
    			attr_dev(i0, "class", "fas fa-arrow-left");
    			add_location(i0, file$4, 345, 8, 8308);
    			attr_dev(button0, "class", "uk-button uk-button-default svelte-16paps3");
    			button0.disabled = /*prevIsDisabled*/ ctx[9];
    			add_location(button0, file$4, 340, 6, 8127);
    			attr_dev(i1, "class", "fas fa-arrow-right");
    			add_location(i1, file$4, 352, 8, 8539);
    			attr_dev(button1, "class", "uk-button uk-button-default svelte-16paps3");
    			button1.disabled = /*nextIsDisabled*/ ctx[10];
    			add_location(button1, file$4, 347, 6, 8362);
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, button0, anchor);
    			append_dev(button0, i0);
    			insert_dev(target, t, anchor);
    			insert_dev(target, button1, anchor);
    			append_dev(button1, i1);
    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(button0, "click", /*getPreviousPage*/ ctx[19], false, false, false),
    				listen_dev(button0, "click", /*click_handler_3*/ ctx[29], false, false, false),
    				listen_dev(button1, "click", /*getNextPage*/ ctx[18], false, false, false),
    				listen_dev(button1, "click", /*click_handler_4*/ ctx[30], false, false, false)
    			];
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*prevIsDisabled*/ 512) {
    				prop_dev(button0, "disabled", /*prevIsDisabled*/ ctx[9]);
    			}

    			if (dirty[0] & /*nextIsDisabled*/ 1024) {
    				prop_dev(button1, "disabled", /*nextIsDisabled*/ ctx[10]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(button1);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(340:4) {#if previousPage != '' || nextPage != ''}",
    		ctx
    	});

    	return block;
    }

    // (434:0) {#if hasError}
    function create_if_block(ctx) {
    	let section0;
    	let t;
    	let section1;
    	let section1_intro;
    	let section1_outro;
    	let current;
    	const erroralert = new ErrorAlert({ $$inline: true });
    	erroralert.$on("click", /*click_handler_6*/ ctx[36]);

    	const footer = new Footer({
    			props: { positionClass: "relative" },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			section0 = element("section");
    			create_component(erroralert.$$.fragment);
    			t = space();
    			section1 = element("section");
    			create_component(footer.$$.fragment);
    			attr_dev(section0, "class", "svelte-16paps3");
    			add_location(section0, file$4, 434, 2, 10865);
    			attr_dev(section1, "class", "svelte-16paps3");
    			add_location(section1, file$4, 437, 2, 10945);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section0, anchor);
    			mount_component(erroralert, section0, null);
    			insert_dev(target, t, anchor);
    			insert_dev(target, section1, anchor);
    			mount_component(footer, section1, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(erroralert.$$.fragment, local);
    			transition_in(footer.$$.fragment, local);

    			add_render_callback(() => {
    				if (section1_outro) section1_outro.end(1);
    				if (!section1_intro) section1_intro = create_in_transition(section1, fade, { duration: 700, delay: 500 });
    				section1_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(erroralert.$$.fragment, local);
    			transition_out(footer.$$.fragment, local);
    			if (section1_intro) section1_intro.invalidate();
    			section1_outro = create_out_transition(section1, fade, { duration: 0, delay: 0 });
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section0);
    			destroy_component(erroralert);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(section1);
    			destroy_component(footer);
    			if (detaching && section1_outro) section1_outro.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(434:0) {#if hasError}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let t0;
    	let div0;
    	let section;
    	let button0;
    	let t2;
    	let button1;
    	let i;
    	let t3;
    	let div0_transition;
    	let t4;
    	let current_block_type_index;
    	let if_block0;
    	let t5;
    	let div5;
    	let div4;
    	let button2;
    	let t6;
    	let div1;
    	let h2;
    	let t8;
    	let div2;
    	let span0;
    	let t10;
    	let input0;
    	let t11;
    	let span1;
    	let t13;
    	let input1;
    	let t14;
    	let span2;
    	let t16;
    	let input2;
    	let t17;
    	let span3;
    	let t19;
    	let input3;
    	let t20;
    	let div3;
    	let button3;
    	let t22;
    	let button4;
    	let t24;
    	let if_block1_anchor;
    	let current;
    	let dispose;

    	const banner = new Banner({
    			props: {
    				src: /*src*/ ctx[11],
    				bgColor: /*bgColor*/ ctx[12]
    			},
    			$$inline: true
    		});

    	const if_block_creators = [create_if_block_1, create_if_block_4];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*hasCharacters*/ ctx[0]) return 0;
    		if (/*hasCharacters*/ ctx[0] || !/*hasError*/ ctx[8]) return 1;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type(ctx))) {
    		if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	let if_block1 = /*hasError*/ ctx[8] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			create_component(banner.$$.fragment);
    			t0 = space();
    			div0 = element("div");
    			section = element("section");
    			button0 = element("button");
    			button0.textContent = "Get All Characters";
    			t2 = space();
    			button1 = element("button");
    			i = element("i");
    			t3 = text("\n      Search");
    			t4 = space();
    			if (if_block0) if_block0.c();
    			t5 = space();
    			div5 = element("div");
    			div4 = element("div");
    			button2 = element("button");
    			t6 = space();
    			div1 = element("div");
    			h2 = element("h2");
    			h2.textContent = "Search for your favorite Rick and Morty Characters!";
    			t8 = space();
    			div2 = element("div");
    			span0 = element("span");
    			span0.textContent = "Name:";
    			t10 = space();
    			input0 = element("input");
    			t11 = space();
    			span1 = element("span");
    			span1.textContent = "Status:";
    			t13 = space();
    			input1 = element("input");
    			t14 = space();
    			span2 = element("span");
    			span2.textContent = "Species:";
    			t16 = space();
    			input2 = element("input");
    			t17 = space();
    			span3 = element("span");
    			span3.textContent = "Gender:";
    			t19 = space();
    			input3 = element("input");
    			t20 = space();
    			div3 = element("div");
    			button3 = element("button");
    			button3.textContent = "Cancel";
    			t22 = space();
    			button4 = element("button");
    			button4.textContent = "Go";
    			t24 = space();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    			attr_dev(button0, "class", "uk-button uk-button-default  svelte-16paps3");
    			add_location(button0, file$4, 270, 4, 6109);
    			attr_dev(i, "class", "fas fa-search");
    			add_location(i, file$4, 282, 6, 6464);
    			attr_dev(button1, "class", "uk-button uk-button-default margin-bottom svelte-16paps3");
    			attr_dev(button1, "href", "#search-modal");
    			attr_dev(button1, "uk-toggle", "");
    			add_location(button1, file$4, 276, 4, 6259);
    			attr_dev(section, "class", "uk-margin-bottom svelte-16paps3");
    			attr_dev(section, "id", "home");
    			add_location(section, file$4, 269, 2, 6060);
    			attr_dev(div0, "class", "container svelte-16paps3");
    			add_location(div0, file$4, 268, 0, 5986);
    			attr_dev(button2, "class", "uk-modal-close-default svelte-16paps3");
    			attr_dev(button2, "type", "button");
    			attr_dev(button2, "uk-close", "");
    			add_location(button2, file$4, 376, 4, 9238);
    			attr_dev(h2, "class", "uk-modal-title svelte-16paps3");
    			add_location(h2, file$4, 382, 6, 9389);
    			attr_dev(div1, "class", "uk-modal-header");
    			add_location(div1, file$4, 381, 4, 9353);
    			attr_dev(span0, "for", "characterName");
    			attr_dev(span0, "class", "svelte-16paps3");
    			add_location(span0, file$4, 387, 6, 9538);
    			input0.autofocus = /*autofocus*/ ctx[13];
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "name", "characterName");
    			attr_dev(input0, "class", "svelte-16paps3");
    			add_location(input0, file$4, 388, 6, 9583);
    			attr_dev(span1, "for", "characterStatus");
    			attr_dev(span1, "class", "svelte-16paps3");
    			add_location(span1, file$4, 393, 6, 9703);
    			attr_dev(input1, "uk-tooltip", "Dead, alive, or unknown");
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "name", "characterStatus");
    			attr_dev(input1, "class", "svelte-16paps3");
    			add_location(input1, file$4, 394, 6, 9752);
    			attr_dev(span2, "for", "characterSpecies");
    			attr_dev(span2, "class", "svelte-16paps3");
    			add_location(span2, file$4, 399, 6, 9901);
    			attr_dev(input2, "uk-tooltip", "Human, humanoid, robot, unknown, etc.");
    			attr_dev(input2, "type", "text");
    			attr_dev(input2, "name", "characterSpecies");
    			attr_dev(input2, "class", "svelte-16paps3");
    			add_location(input2, file$4, 400, 6, 9952);
    			attr_dev(span3, "for", "characterGender");
    			attr_dev(span3, "class", "svelte-16paps3");
    			add_location(span3, file$4, 405, 6, 10117);
    			attr_dev(input3, "uk-tooltip", "Male or Female");
    			attr_dev(input3, "type", "text");
    			attr_dev(input3, "name", "characterGender");
    			attr_dev(input3, "class", "svelte-16paps3");
    			add_location(input3, file$4, 406, 6, 10166);
    			attr_dev(div2, "class", "uk-modal-body");
    			add_location(div2, file$4, 386, 4, 9504);
    			attr_dev(button3, "class", "uk-button uk-button-default uk-modal-close svelte-16paps3");
    			attr_dev(button3, "type", "button");
    			add_location(button3, file$4, 413, 6, 10365);
    			attr_dev(button4, "class", "uk-button uk-button-default uk-modal-close svelte-16paps3");
    			attr_dev(button4, "type", "button");
    			add_location(button4, file$4, 419, 6, 10522);
    			attr_dev(div3, "class", "uk-modal-footer uk-text-right");
    			add_location(div3, file$4, 412, 4, 10315);
    			attr_dev(div4, "class", "uk-modal-dialog");
    			add_location(div4, file$4, 375, 2, 9204);
    			attr_dev(div5, "id", "search-modal");
    			attr_dev(div5, "uk-modal", "");
    			add_location(div5, file$4, 374, 0, 9169);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor, remount) {
    			mount_component(banner, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div0, anchor);
    			append_dev(div0, section);
    			append_dev(section, button0);
    			append_dev(section, t2);
    			append_dev(section, button1);
    			append_dev(button1, i);
    			append_dev(button1, t3);
    			insert_dev(target, t4, anchor);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].m(target, anchor);
    			}

    			insert_dev(target, t5, anchor);
    			insert_dev(target, div5, anchor);
    			append_dev(div5, div4);
    			append_dev(div4, button2);
    			append_dev(div4, t6);
    			append_dev(div4, div1);
    			append_dev(div1, h2);
    			append_dev(div4, t8);
    			append_dev(div4, div2);
    			append_dev(div2, span0);
    			append_dev(div2, t10);
    			append_dev(div2, input0);
    			set_input_value(input0, /*characterName*/ ctx[4]);
    			append_dev(div2, t11);
    			append_dev(div2, span1);
    			append_dev(div2, t13);
    			append_dev(div2, input1);
    			set_input_value(input1, /*characterStatus*/ ctx[5]);
    			append_dev(div2, t14);
    			append_dev(div2, span2);
    			append_dev(div2, t16);
    			append_dev(div2, input2);
    			set_input_value(input2, /*characterSpecies*/ ctx[6]);
    			append_dev(div2, t17);
    			append_dev(div2, span3);
    			append_dev(div2, t19);
    			append_dev(div2, input3);
    			set_input_value(input3, /*characterGender*/ ctx[7]);
    			append_dev(div4, t20);
    			append_dev(div4, div3);
    			append_dev(div3, button3);
    			append_dev(div3, t22);
    			append_dev(div3, button4);
    			insert_dev(target, t24, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, if_block1_anchor, anchor);
    			current = true;
    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(button0, "click", /*getCharacters*/ ctx[17], false, false, false),
    				listen_dev(button0, "click", /*twitch*/ ctx[16], false, false, false),
    				listen_dev(button1, "click", /*click_handler_1*/ ctx[26], false, false, false),
    				listen_dev(button1, "click", /*click_handler_2*/ ctx[27], false, false, false),
    				listen_dev(button2, "click", /*resetModal*/ ctx[15], false, false, false),
    				listen_dev(input0, "input", /*input0_input_handler*/ ctx[31]),
    				listen_dev(input1, "input", /*input1_input_handler*/ ctx[32]),
    				listen_dev(input2, "input", /*input2_input_handler*/ ctx[33]),
    				listen_dev(input3, "input", /*input3_input_handler*/ ctx[34]),
    				listen_dev(button3, "click", /*resetModal*/ ctx[15], false, false, false),
    				listen_dev(button4, "click", /*click_handler_5*/ ctx[35], false, false, false),
    				listen_dev(
    					button4,
    					"click",
    					function () {
    						if (is_function(/*searchCharacters*/ ctx[20](/*characterName*/ ctx[4], /*characterStatus*/ ctx[5], /*characterSpecies*/ ctx[6], /*characterGender*/ ctx[7]))) /*searchCharacters*/ ctx[20](/*characterName*/ ctx[4], /*characterStatus*/ ctx[5], /*characterSpecies*/ ctx[6], /*characterGender*/ ctx[7]).apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				)
    			];
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			const banner_changes = {};
    			if (dirty[0] & /*src*/ 2048) banner_changes.src = /*src*/ ctx[11];
    			if (dirty[0] & /*bgColor*/ 4096) banner_changes.bgColor = /*bgColor*/ ctx[12];
    			banner.$set(banner_changes);
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
    					if_block0.m(t5.parentNode, t5);
    				} else {
    					if_block0 = null;
    				}
    			}

    			if (!current || dirty[0] & /*autofocus*/ 8192) {
    				prop_dev(input0, "autofocus", /*autofocus*/ ctx[13]);
    			}

    			if (dirty[0] & /*characterName*/ 16 && input0.value !== /*characterName*/ ctx[4]) {
    				set_input_value(input0, /*characterName*/ ctx[4]);
    			}

    			if (dirty[0] & /*characterStatus*/ 32 && input1.value !== /*characterStatus*/ ctx[5]) {
    				set_input_value(input1, /*characterStatus*/ ctx[5]);
    			}

    			if (dirty[0] & /*characterSpecies*/ 64 && input2.value !== /*characterSpecies*/ ctx[6]) {
    				set_input_value(input2, /*characterSpecies*/ ctx[6]);
    			}

    			if (dirty[0] & /*characterGender*/ 128 && input3.value !== /*characterGender*/ ctx[7]) {
    				set_input_value(input3, /*characterGender*/ ctx[7]);
    			}

    			if (/*hasError*/ ctx[8]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);

    					if (dirty[0] & /*hasError*/ 256) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(banner.$$.fragment, local);

    			add_render_callback(() => {
    				if (!div0_transition) div0_transition = create_bidirectional_transition(div0, fade, { duration: 700, delay: 500 }, true);
    				div0_transition.run(1);
    			});

    			transition_in(if_block0);
    			transition_in(if_block1);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(banner.$$.fragment, local);
    			if (!div0_transition) div0_transition = create_bidirectional_transition(div0, fade, { duration: 700, delay: 500 }, false);
    			div0_transition.run(0);
    			transition_out(if_block0);
    			transition_out(if_block1);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(banner, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div0);
    			if (detaching && div0_transition) div0_transition.end();
    			if (detaching) detach_dev(t4);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].d(detaching);
    			}

    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(div5);
    			if (detaching) detach_dev(t24);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(if_block1_anchor);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
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
    	let src;
    	let bgColor;
    	let originalBgColor = "background-color:black;";
    	let invertBgColor = "background-color:white;";
    	let originalSrc = "assets/banner.png";
    	let invertSrc = "assets/invertRotateBanner.png";
    	let autofocus;

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

    	function resetCharacters() {
    		$$invalidate(1, characters = []);
    		$$invalidate(0, hasCharacters = false);
    		$$invalidate(8, hasError = false);
    	}

    	function resetModal() {
    		$$invalidate(4, characterName = "");
    		$$invalidate(5, characterStatus = "");
    		$$invalidate(6, characterSpecies = "");
    		$$invalidate(7, characterGender = "");
    		$$invalidate(13, autofocus = "");
    	}

    	function twitch() {
    		setTimeout(
    			() => {
    				$$invalidate(11, src = invertSrc);
    				$$invalidate(12, bgColor = invertBgColor);
    			},
    			100
    		);

    		setTimeout(
    			() => {
    				$$invalidate(11, src = originalSrc);
    				$$invalidate(12, bgColor = originalBgColor);
    			},
    			200
    		);

    		setTimeout(
    			() => {
    				$$invalidate(11, src = invertSrc);
    				$$invalidate(12, bgColor = invertBgColor);
    			},
    			300
    		);

    		setTimeout(
    			() => {
    				$$invalidate(11, src = originalSrc);
    				$$invalidate(12, bgColor = originalBgColor);
    			},
    			400
    		);

    		setTimeout(
    			() => {
    				$$invalidate(11, src = invertSrc);
    				$$invalidate(12, bgColor = invertBgColor);
    			},
    			500
    		);

    		setTimeout(
    			() => {
    				$$invalidate(11, src = originalSrc);
    				$$invalidate(12, bgColor = originalBgColor);
    			},
    			600
    		);

    		setTimeout(
    			() => {
    				$$invalidate(11, src = invertSrc);
    				$$invalidate(12, bgColor = invertBgColor);
    			},
    			700
    		);

    		setTimeout(
    			() => {
    				$$invalidate(11, src = originalSrc);
    				$$invalidate(12, bgColor = originalBgColor);
    			},
    			800
    		);

    		setTimeout(
    			() => {
    				$$invalidate(11, src = invertSrc);
    				$$invalidate(12, bgColor = invertBgColor);
    			},
    			900
    		);

    		setTimeout(
    			() => {
    				$$invalidate(11, src = originalSrc);
    				$$invalidate(12, bgColor = originalBgColor);
    			},
    			1000
    		);

    		setTimeout(
    			() => {
    				$$invalidate(11, src = invertSrc);
    				$$invalidate(12, bgColor = invertBgColor);
    			},
    			1100
    		);

    		setTimeout(
    			() => {
    				$$invalidate(11, src = originalSrc);
    				$$invalidate(12, bgColor = originalBgColor);
    			},
    			1200
    		);
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
    			twitch();
    		}).catch(err => {
    			console.log(err);
    		});

    		checkPages();
    		resetModal();
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);
    	const click_handler_1 = () => $$invalidate(8, hasError = false);
    	const click_handler_2 = () => $$invalidate(13, autofocus = "autofocus");

    	function click_handler(event) {
    		bubble($$self, event);
    	}

    	const click_handler_3 = () => location.href = "#home";
    	const click_handler_4 = () => location.href = "#home";

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

    	const click_handler_5 = () => {
    		$$invalidate(13, autofocus = "");
    	};

    	const click_handler_6 = () => $$invalidate(8, hasError = false);

    	$$self.$capture_state = () => ({
    		Card,
    		Footer,
    		Banner,
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
    		src,
    		bgColor,
    		originalBgColor,
    		invertBgColor,
    		originalSrc,
    		invertSrc,
    		autofocus,
    		checkPages,
    		resetCharacters,
    		resetModal,
    		twitch,
    		getCharacters,
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
    		if ("src" in $$props) $$invalidate(11, src = $$props.src);
    		if ("bgColor" in $$props) $$invalidate(12, bgColor = $$props.bgColor);
    		if ("originalBgColor" in $$props) originalBgColor = $$props.originalBgColor;
    		if ("invertBgColor" in $$props) invertBgColor = $$props.invertBgColor;
    		if ("originalSrc" in $$props) originalSrc = $$props.originalSrc;
    		if ("invertSrc" in $$props) invertSrc = $$props.invertSrc;
    		if ("autofocus" in $$props) $$invalidate(13, autofocus = $$props.autofocus);
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
    		src,
    		bgColor,
    		autofocus,
    		resetCharacters,
    		resetModal,
    		twitch,
    		getCharacters,
    		getNextPage,
    		getPreviousPage,
    		searchCharacters,
    		originalBgColor,
    		invertBgColor,
    		originalSrc,
    		invertSrc,
    		checkPages,
    		click_handler_1,
    		click_handler_2,
    		click_handler,
    		click_handler_3,
    		click_handler_4,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler,
    		input3_input_handler,
    		click_handler_5,
    		click_handler_6
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {}, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    const app = new App({
      target: document.body,
      intro: true,
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
