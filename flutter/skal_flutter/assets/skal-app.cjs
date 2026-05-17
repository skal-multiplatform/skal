// @bun @bytecode @bun-cjs
(function(exports, require, module, __filename, __dirname) {// ../flutter/skal_flutter/assets/skal-app.js
(function() {
  var ee = { context: undefined, registry: undefined, effects: undefined, done: false, getContextId() {
    return Kt(this.context.count);
  }, getNextContextId() {
    return Kt(this.context.count++);
  } };
  function Kt(t) {
    const n = String(t), i = n.length - 1;
    return ee.context.id + (i ? String.fromCharCode(96 + i) : "") + n;
  }
  function pt(t) {
    ee.context = t;
  }
  function Ur() {
    return { ...ee.context, id: ee.getNextContextId(), count: 0 };
  }
  var Xr = (t, n) => t === n, St = Symbol("solid-proxy"), Yr = typeof Proxy == "function", Kr = Symbol("solid-track"), et = { equals: Xr }, Jt = null, jt = ir, ae = 1, Be = 2, qt = { owned: null, cleanups: null, context: null, owner: null }, X = null, $ = null, Me = null, Ce = null, K = null, q = null, re = null, tt = 0;
  function rt(t, n) {
    const i = K, l = X, u = t.length === 0, g = n === undefined ? l : n, m = u ? qt : { owned: null, cleanups: null, context: g ? g.context : null, owner: g }, p = u ? t : () => t(() => $e(() => be(m)));
    X = m, K = null;
    try {
      return he(p, true);
    } finally {
      K = i, X = l;
    }
  }
  function W(t, n) {
    n = n ? Object.assign({}, et, n) : et;
    const i = { value: t, observers: null, observerSlots: null, comparator: n.equals || undefined }, l = (u) => (typeof u == "function" && ($ && $.running && $.sources.has(i) ? u = u(i.tValue) : u = u(i.value)), rr(i, u));
    return [tr.bind(i), l];
  }
  function _e(t, n, i) {
    const l = mt(t, n, false, ae);
    Me && $ && $.running ? q.push(l) : He(l);
  }
  function Zt(t, n, i) {
    jt = Qr;
    const l = mt(t, n, false, ae), u = wt && jr(wt);
    u && (l.suspense = u), (!i || !i.render) && (l.user = true), re ? re.push(l) : He(l);
  }
  function nt(t, n, i) {
    i = i ? Object.assign({}, et, i) : et;
    const l = mt(t, n, true, 0);
    return l.observers = null, l.observerSlots = null, l.comparator = i.equals || undefined, Me && $ && $.running ? (l.tState = ae, q.push(l)) : He(l), tr.bind(l);
  }
  function $e(t) {
    if (!Ce && K === null)
      return t();
    const n = K;
    K = null;
    try {
      return Ce ? Ce.untrack(t) : t();
    } finally {
      K = n;
    }
  }
  function Qt(t) {
    return X === null || (X.cleanups === null ? X.cleanups = [t] : X.cleanups.push(t)), t;
  }
  function Jr(t) {
    if ($ && $.running)
      return t(), $.done;
    const n = K, i = X;
    return Promise.resolve().then(() => {
      K = n, X = i;
      let l;
      return (Me || wt) && (l = $ || ($ = { sources: new Set, effects: [], promises: new Set, disposed: new Set, queue: new Set, running: true }), l.done || (l.done = new Promise((u) => l.resolve = u)), l.running = true), he(t, false), K = X = null, l ? l.done : undefined;
    });
  }
  var [to, er] = W(false);
  function jr(t) {
    let n;
    return X && X.context && (n = X.context[t.id]) !== undefined ? n : t.defaultValue;
  }
  var wt;
  function tr() {
    const t = $ && $.running;
    if (this.sources && (t ? this.tState : this.state))
      if ((t ? this.tState : this.state) === ae)
        He(this);
      else {
        const n = q;
        q = null, he(() => it(this), false), q = n;
      }
    if (K) {
      const n = this.observers ? this.observers.length : 0;
      K.sources ? (K.sources.push(this), K.sourceSlots.push(n)) : (K.sources = [this], K.sourceSlots = [n]), this.observers ? (this.observers.push(K), this.observerSlots.push(K.sources.length - 1)) : (this.observers = [K], this.observerSlots = [K.sources.length - 1]);
    }
    return t && $.sources.has(this) ? this.tValue : this.value;
  }
  function rr(t, n, i) {
    let l = $ && $.running && $.sources.has(t) ? t.tValue : t.value;
    if (!t.comparator || !t.comparator(l, n)) {
      if ($) {
        const u = $.running;
        (u || !i && $.sources.has(t)) && ($.sources.add(t), t.tValue = n), u || (t.value = n);
      } else
        t.value = n;
      t.observers && t.observers.length && he(() => {
        for (let u = 0;u < t.observers.length; u += 1) {
          const g = t.observers[u], m = $ && $.running;
          m && $.disposed.has(g) || ((m ? !g.tState : !g.state) && (g.pure ? q.push(g) : re.push(g), g.observers && or(g)), m ? g.tState = ae : g.state = ae);
        }
        if (q.length > 1e6)
          throw q = [], new Error;
      }, false);
    }
    return n;
  }
  function He(t) {
    if (!t.fn)
      return;
    be(t);
    const n = tt;
    nr(t, $ && $.running && $.sources.has(t) ? t.tValue : t.value, n), $ && !$.running && $.sources.has(t) && queueMicrotask(() => {
      he(() => {
        $ && ($.running = true), K = X = t, nr(t, t.tValue, n), K = X = null;
      }, false);
    });
  }
  function nr(t, n, i) {
    let l;
    const u = X, g = K;
    K = X = t;
    try {
      l = t.fn(n);
    } catch (m) {
      return t.pure && ($ && $.running ? (t.tState = ae, t.tOwned && t.tOwned.forEach(be), t.tOwned = undefined) : (t.state = ae, t.owned && t.owned.forEach(be), t.owned = null)), t.updatedAt = i + 1, Rt(m);
    } finally {
      K = g, X = u;
    }
    (!t.updatedAt || t.updatedAt <= i) && (t.updatedAt != null && ("observers" in t) ? rr(t, l, true) : $ && $.running && t.pure ? ($.sources.has(t) || (t.value = l), $.sources.add(t), t.tValue = l) : t.value = l, t.updatedAt = i);
  }
  function mt(t, n, i, l = ae, u) {
    const g = { fn: t, state: l, updatedAt: null, owned: null, sources: null, sourceSlots: null, cleanups: null, value: n, owner: X, context: X ? X.context : null, pure: i };
    if ($ && $.running && (g.state = 0, g.tState = l), X === null || X !== qt && ($ && $.running && X.pure ? X.tOwned ? X.tOwned.push(g) : X.tOwned = [g] : X.owned ? X.owned.push(g) : X.owned = [g]), Ce && g.fn) {
      const m = g.fn, [p, y] = W(undefined, { equals: false }), C = Ce.factory(m, y);
      Qt(() => C.dispose());
      let x;
      const T = () => Jr(y).then(() => {
        x && (x.dispose(), x = undefined);
      });
      g.fn = (N) => (p(), $ && $.running ? (x || (x = Ce.factory(m, T)), x.track(N)) : C.track(N));
    }
    return g;
  }
  function Ge(t) {
    const n = $ && $.running;
    if ((n ? t.tState : t.state) === 0)
      return;
    if ((n ? t.tState : t.state) === Be)
      return it(t);
    if (t.suspense && $e(t.suspense.inFallback))
      return t.suspense.effects.push(t);
    const i = [t];
    for (;(t = t.owner) && (!t.updatedAt || t.updatedAt < tt); ) {
      if (n && $.disposed.has(t))
        return;
      (n ? t.tState : t.state) && i.push(t);
    }
    for (let l = i.length - 1;l >= 0; l--) {
      if (t = i[l], n) {
        let u = t, g = i[l + 1];
        for (;(u = u.owner) && u !== g; )
          if ($.disposed.has(u))
            return;
      }
      if ((n ? t.tState : t.state) === ae)
        He(t);
      else if ((n ? t.tState : t.state) === Be) {
        const u = q;
        q = null, he(() => it(t, i[0]), false), q = u;
      }
    }
  }
  function he(t, n) {
    if (q)
      return t();
    let i = false;
    n || (q = []), re ? i = true : re = [], tt++;
    try {
      const l = t();
      return qr(i), l;
    } catch (l) {
      i || (re = null), q = null, Rt(l);
    }
  }
  function qr(t) {
    if (q && (Me && $ && $.running ? Zr(q) : ir(q), q = null), t)
      return;
    let n;
    if ($) {
      if (!$.promises.size && !$.queue.size) {
        const { sources: l, disposed: u } = $;
        re.push.apply(re, $.effects), n = $.resolve;
        for (const g of re)
          "tState" in g && (g.state = g.tState), delete g.tState;
        $ = null, he(() => {
          for (const g of u)
            be(g);
          for (const g of l) {
            if (g.value = g.tValue, g.owned)
              for (let m = 0, p = g.owned.length;m < p; m++)
                be(g.owned[m]);
            g.tOwned && (g.owned = g.tOwned), delete g.tValue, delete g.tOwned, g.tState = 0;
          }
          er(false);
        }, false);
      } else if ($.running) {
        $.running = false, $.effects.push.apply($.effects, re), re = null, er(true);
        return;
      }
    }
    const i = re;
    re = null, i.length && he(() => jt(i), false), n && n();
  }
  function ir(t) {
    for (let n = 0;n < t.length; n++)
      Ge(t[n]);
  }
  function Zr(t) {
    for (let n = 0;n < t.length; n++) {
      const i = t[n], l = $.queue;
      l.has(i) || (l.add(i), Me(() => {
        l.delete(i), he(() => {
          $.running = true, Ge(i);
        }, false), $ && ($.running = false);
      }));
    }
  }
  function Qr(t) {
    let n, i = 0;
    for (n = 0;n < t.length; n++) {
      const l = t[n];
      l.user ? t[i++] = l : Ge(l);
    }
    if (ee.context) {
      if (ee.count) {
        ee.effects || (ee.effects = []), ee.effects.push(...t.slice(0, i));
        return;
      }
      pt();
    }
    for (ee.effects && (ee.done || !ee.count) && (t = [...ee.effects, ...t], i += ee.effects.length, delete ee.effects), n = 0;n < i; n++)
      Ge(t[n]);
  }
  function it(t, n) {
    const i = $ && $.running;
    i ? t.tState = 0 : t.state = 0;
    for (let l = 0;l < t.sources.length; l += 1) {
      const u = t.sources[l];
      if (u.sources) {
        const g = i ? u.tState : u.state;
        g === ae ? u !== n && (!u.updatedAt || u.updatedAt < tt) && Ge(u) : g === Be && it(u, n);
      }
    }
  }
  function or(t) {
    const n = $ && $.running;
    for (let i = 0;i < t.observers.length; i += 1) {
      const l = t.observers[i];
      (n ? !l.tState : !l.state) && (n ? l.tState = Be : l.state = Be, l.pure ? q.push(l) : re.push(l), l.observers && or(l));
    }
  }
  function be(t) {
    let n;
    if (t.sources)
      for (;t.sources.length; ) {
        const i = t.sources.pop(), l = t.sourceSlots.pop(), u = i.observers;
        if (u && u.length) {
          const g = u.pop(), m = i.observerSlots.pop();
          l < u.length && (g.sourceSlots[m] = l, u[l] = g, i.observerSlots[l] = m);
        }
      }
    if (t.tOwned) {
      for (n = t.tOwned.length - 1;n >= 0; n--)
        be(t.tOwned[n]);
      delete t.tOwned;
    }
    if ($ && $.running && t.pure)
      ar(t, true);
    else if (t.owned) {
      for (n = t.owned.length - 1;n >= 0; n--)
        be(t.owned[n]);
      t.owned = null;
    }
    if (t.cleanups) {
      for (n = t.cleanups.length - 1;n >= 0; n--)
        t.cleanups[n]();
      t.cleanups = null;
    }
    $ && $.running ? t.tState = 0 : t.state = 0;
  }
  function ar(t, n) {
    if (n || (t.tState = 0, $.disposed.add(t)), t.owned)
      for (let i = 0;i < t.owned.length; i++)
        ar(t.owned[i]);
  }
  function en(t) {
    return t instanceof Error ? t : new Error(typeof t == "string" ? t : "Unknown error", { cause: t });
  }
  function lr(t, n, i) {
    try {
      for (const l of n)
        l(t);
    } catch (l) {
      Rt(l, i && i.owner || null);
    }
  }
  function Rt(t, n = X) {
    const i = Jt && n && n.context && n.context[Jt], l = en(t);
    if (!i)
      throw l;
    re ? re.push({ fn() {
      lr(l, i, n);
    }, state: ae }) : lr(l, i, n);
  }
  var tn = Symbol("fallback");
  function sr(t) {
    for (let n = 0;n < t.length; n++)
      t[n]();
  }
  function rn(t, n, i = {}) {
    let l = [], u = [], g = [], m = 0, p = n.length > 1 ? [] : null;
    return Qt(() => sr(g)), () => {
      let y = t() || [], C = y.length, x, T;
      return y[Kr], $e(() => {
        let _, b, v, I, B, S, E, a, h;
        if (C === 0)
          m !== 0 && (sr(g), g = [], l = [], u = [], m = 0, p && (p = [])), i.fallback && (l = [tn], u[0] = rt((F) => (g[0] = F, i.fallback())), m = 1);
        else if (m === 0) {
          for (u = new Array(C), T = 0;T < C; T++)
            l[T] = y[T], u[T] = rt(N);
          m = C;
        } else {
          for (v = new Array(C), I = new Array(C), p && (B = new Array(C)), S = 0, E = Math.min(m, C);S < E && l[S] === y[S]; S++)
            ;
          for (E = m - 1, a = C - 1;E >= S && a >= S && l[E] === y[a]; E--, a--)
            v[a] = u[E], I[a] = g[E], p && (B[a] = p[E]);
          for (_ = new Map, b = new Array(a + 1), T = a;T >= S; T--)
            h = y[T], x = _.get(h), b[T] = x === undefined ? -1 : x, _.set(h, T);
          for (x = S;x <= E; x++)
            h = l[x], T = _.get(h), T !== undefined && T !== -1 ? (v[T] = u[x], I[T] = g[x], p && (B[T] = p[x]), T = b[T], _.set(h, T)) : g[x]();
          for (T = S;T < C; T++)
            T in v ? (u[T] = v[T], g[T] = I[T], p && (p[T] = B[T], p[T](T))) : u[T] = rt(N);
          u = u.slice(0, m = C), l = y.slice(0);
        }
        return u;
      });
      function N(_) {
        if (g[T] = _, p) {
          const [b, v] = W(T);
          return p[T] = v, n(y[T], b);
        }
        return n(y[T]);
      }
    };
  }
  var nn = false;
  function on(t, n) {
    if (nn && ee.context) {
      const i = ee.context;
      pt(Ur());
      const l = $e(() => t(n || {}));
      return pt(i), l;
    }
    return $e(() => t(n || {}));
  }
  function ot() {
    return true;
  }
  var an = { get(t, n, i) {
    return n === St ? i : t.get(n);
  }, has(t, n) {
    return n === St ? true : t.has(n);
  }, set: ot, deleteProperty: ot, getOwnPropertyDescriptor(t, n) {
    return { configurable: true, enumerable: true, get() {
      return t.get(n);
    }, set: ot, deleteProperty: ot };
  }, ownKeys(t) {
    return t.keys();
  } };
  function Tt(t) {
    return (t = typeof t == "function" ? t() : t) ? t : {};
  }
  function ln() {
    for (let t = 0, n = this.length;t < n; ++t) {
      const i = this[t]();
      if (i !== undefined)
        return i;
    }
  }
  function cr(...t) {
    let n = false;
    for (let m = 0;m < t.length; m++) {
      const p = t[m];
      n = n || !!p && St in p, t[m] = typeof p == "function" ? (n = true, nt(p)) : p;
    }
    if (Yr && n)
      return new Proxy({ get(m) {
        for (let p = t.length - 1;p >= 0; p--) {
          const y = Tt(t[p])[m];
          if (y !== undefined)
            return y;
        }
      }, has(m) {
        for (let p = t.length - 1;p >= 0; p--)
          if (m in Tt(t[p]))
            return true;
        return false;
      }, keys() {
        const m = [];
        for (let p = 0;p < t.length; p++)
          m.push(...Object.keys(Tt(t[p])));
        return [...new Set(m)];
      } }, an);
    const i = {}, l = Object.create(null);
    for (let m = t.length - 1;m >= 0; m--) {
      const p = t[m];
      if (!p)
        continue;
      const y = Object.getOwnPropertyNames(p);
      for (let C = y.length - 1;C >= 0; C--) {
        const x = y[C];
        if (x === "__proto__" || x === "constructor")
          continue;
        const T = Object.getOwnPropertyDescriptor(p, x);
        if (!l[x])
          l[x] = T.get ? { enumerable: true, configurable: true, get: ln.bind(i[x] = [T.get.bind(p)]) } : T.value !== undefined ? T : undefined;
        else {
          const N = i[x];
          N && (T.get ? N.push(T.get.bind(p)) : T.value !== undefined && N.push(() => T.value));
        }
      }
    }
    const u = {}, g = Object.keys(l);
    for (let m = g.length - 1;m >= 0; m--) {
      const p = g[m], y = l[p];
      y && y.get ? Object.defineProperty(u, p, y) : u[p] = y ? y.value : undefined;
    }
    return u;
  }
  function Q(t) {
    const n = "fallback" in t && { fallback: () => t.fallback };
    return nt(rn(() => t.each, t.children, n || undefined));
  }
  var sn = (t) => nt(() => t());
  function cn({ createElement: t, createTextNode: n, isTextNode: i, replaceText: l, insertNode: u, removeNode: g, setProperty: m, getParentNode: p, getFirstChild: y, getNextSibling: C }) {
    function x(S, E, a, h) {
      if (a !== undefined && !h && (h = []), typeof E != "function")
        return T(S, E, h, a);
      _e((F) => T(S, E(), F, a), h);
    }
    function T(S, E, a, h, F) {
      for (;typeof a == "function"; )
        a = a();
      if (E === a)
        return a;
      const R = typeof E, P = h !== undefined;
      if (R === "string" || R === "number")
        if (R === "number" && (E = E.toString()), P) {
          let D = a[0];
          D && i(D) ? l(D, E) : D = n(E), a = b(S, a, h, D);
        } else
          a !== "" && typeof a == "string" ? l(y(S), a = E) : (b(S, a, h, n(E)), a = E);
      else if (E == null || R === "boolean")
        a = b(S, a, h);
      else {
        if (R === "function")
          return _e(() => {
            let D = E();
            for (;typeof D == "function"; )
              D = D();
            a = T(S, D, a, h);
          }), () => a;
        if (Array.isArray(E)) {
          const D = [];
          if (N(D, E, F))
            return _e(() => a = T(S, D, a, h, true)), () => a;
          if (D.length === 0) {
            const te = b(S, a, h);
            if (P)
              return a = te;
          } else
            Array.isArray(a) ? a.length === 0 ? v(S, D, h) : _(S, a, D) : a == null || a === "" ? v(S, D) : _(S, P && a || [y(S)], D);
          a = D;
        } else {
          if (Array.isArray(a)) {
            if (P)
              return a = b(S, a, h, E);
            b(S, a, null, E);
          } else
            a == null || a === "" || !y(S) ? u(S, E) : I(S, E, y(S));
          a = E;
        }
      }
      return a;
    }
    function N(S, E, a) {
      let h = false;
      for (let F = 0, R = E.length;F < R; F++) {
        let P = E[F], D;
        if (!(P == null || P === true || P === false))
          if (Array.isArray(P))
            h = N(S, P) || h;
          else if ((D = typeof P) == "string" || D === "number")
            S.push(n(P));
          else if (D === "function")
            if (a) {
              for (;typeof P == "function"; )
                P = P();
              h = N(S, Array.isArray(P) ? P : [P]) || h;
            } else
              S.push(P), h = true;
          else
            S.push(P);
      }
      return h;
    }
    function _(S, E, a) {
      let h = a.length, F = E.length, R = h, P = 0, D = 0, te = C(E[F - 1]), Z = null;
      for (;P < F || D < R; ) {
        if (E[P] === a[D]) {
          P++, D++;
          continue;
        }
        for (;E[F - 1] === a[R - 1]; )
          F--, R--;
        if (F === P) {
          const le = R < h ? D ? C(a[D - 1]) : a[R - D] : te;
          for (;D < R; )
            u(S, a[D++], le);
        } else if (R === D)
          for (;P < F; )
            (!Z || !Z.has(E[P])) && g(S, E[P]), P++;
        else if (E[P] === a[R - 1] && a[D] === E[F - 1]) {
          const le = C(E[--F]);
          u(S, a[D++], C(E[P++])), u(S, a[--R], le), E[F] = a[R];
        } else {
          if (!Z) {
            Z = new Map;
            let Fe = D;
            for (;Fe < R; )
              Z.set(a[Fe], Fe++);
          }
          const le = Z.get(E[P]);
          if (le != null)
            if (D < le && le < R) {
              let Fe = P, je = 1, qe;
              for (;++Fe < F && Fe < R && !((qe = Z.get(E[Fe])) == null || qe !== le + je); )
                je++;
              if (je > le - D) {
                const Gt = E[P];
                for (;D < le; )
                  u(S, a[D++], Gt);
              } else
                I(S, a[D++], E[P++]);
            } else
              P++;
          else
            g(S, E[P++]);
        }
      }
    }
    function b(S, E, a, h) {
      if (a === undefined) {
        let R;
        for (;R = y(S); )
          g(S, R);
        return h && u(S, h), "";
      }
      const F = h || n("");
      if (E.length) {
        let R = false;
        for (let P = E.length - 1;P >= 0; P--) {
          const D = E[P];
          if (F !== D) {
            const te = p(D) === S;
            !R && !P ? te ? I(S, F, D) : u(S, F, a) : te && g(S, D);
          } else
            R = true;
        }
      } else
        u(S, F, a);
      return [F];
    }
    function v(S, E, a) {
      for (let h = 0, F = E.length;h < F; h++)
        u(S, E[h], a);
    }
    function I(S, E, a) {
      u(S, E, a), g(S, a);
    }
    function B(S, E, a = {}, h) {
      return E || (E = {}), h || _e(() => a.children = T(S, E.children, a.children)), _e(() => E.ref && E.ref(S)), _e(() => {
        for (const F in E) {
          if (F === "children" || F === "ref")
            continue;
          const R = E[F];
          R !== a[F] && (m(S, F, R, a[F]), a[F] = R);
        }
      }), a;
    }
    return { render(S, E) {
      let a;
      return rt((h) => {
        a = h, x(E, S());
      }), a;
    }, insert: x, spread(S, E, a) {
      typeof E == "function" ? _e((h) => B(S, E(), h, a)) : B(S, E, undefined, a);
    }, createElement: t, createTextNode: n, insertNode: u, setProp(S, E, a, h) {
      return m(S, E, a, h), a;
    }, mergeProps: cr, effect: _e, memo: sn, createComponent: on, use(S, E, a) {
      return $e(() => S(E, a));
    } };
  }
  function un(t) {
    const n = cn(t);
    return n.mergeProps = cr, n;
  }
  var ur = 6 * 1024 * 1024, fn = 64, ro = fn, fr = 4 * 1024 * 1024, Oe = 64 + fr, Pt = 768 * 1024, xt = Oe + Pt, dn = 256 * 1024, Ct = xt + dn, dr = Oe + Pt, hn = 0, gn = 8, Fn = 12, _n = 16, bn = 24, vn = 28, En = 32, pn = 40, Sn = 44, wn = gn >> 2, mn = Fn >> 2, Rn = bn >> 2, hr = vn >> 2, Tn = pn >> 2;
  Sn >> 2;
  var Pn = hn >> 3, xn = _n >> 3, Cn = En >> 3, no = 1, io = 2, oo = 3, ao = 4, lo = 16, so = 17, co = 20, uo = 21, fo = 22, ho = 23, go = 24, Fo = 25, _o = 26, bo = 27, vo = 28, Eo = 29, po = 30, So = 31, wo = 32, mo = 33, Ro = 34, To = 35, Po = 36, xo = 37, Co = 38, $o = 39, Oo = 0, Ao = 1, yo = 2, ko = 3, Io = 4, No = 5, Do = 6, zo = 7, Lo = 9, Wo = 10, Vo = 11, Bo = 12, Mo = 13, Ho = 14, Go = 15, Uo = 16, Xo = 17, Yo = 18, Ko = 19, Jo = 20, jo = 21, qo = 22, Zo = 23, Qo = 24, ea = 25, ta = 26, ra = 27, na = 28, ia = 29, oa = 30, aa = 31, la = 32, sa = 33, ca = 34, ua = 35, fa = 36, da = 37, ha = 38, ga = 39, Fa = 40, _a = 41, ba = 42, va = 43, Ea = 44, pa = 45, Sa = 46, wa = 47, ma = 48, Ra = 1, Ta = 2, Pa = 3, xa = 4, Ca = 5, $a = 6, Oa = 7, Aa = 8, ya = 9, ka = 10, Ia = 11, Na = 12, Da = 13, za = 14, La = 15, Wa = 16, Va = 17, Ba = 18, Ma = 19, Ha = 20, Ga = 21, Ua = 22, Xa = 23, Ya = 0, Ka = 1, Ja = 2, ja = 3, qa = 4, Za = 5, Qa = 6, el = 7, tl = 0, rl = 1, nl = 2, il = 3, ol = 4, al = 5, ll = 6, sl = 7, cl = 8, ul = 9, fl = 10, dl = 11, hl = 12, gl = 13, Fl = 14, _l = 15, bl = 16, vl = 32, El = 33, pl = 34, Sl = 35, wl = 36, ml = 37, Rl = 64, Tl = 65, Pl = 66, xl = 67, Cl = 68, $l = 69, Ol = 70, Al = 71, yl = 72, kl = 73, Il = 74, Nl = 75, Dl = 96, zl = 97, Ll = 98, Wl = 99, Vl = 128, Bl = 129, Ml = 130, Hl = 131, Gl = 132, Ul = 133, Xl = 134, Yl = 135, Kl = 136, Jl = 137, jl = 160, ql = 161, Zl = 162, Ql = 163, es = 164, ts = 165, rs = 166, ns = 167, is = 168, os = 169, as = 170, ls = 171, ss = 172, cs = 173, us = 174, fs = 175, ds = 176, hs = 177, gs = 178, Fs = 179, _s = 180, bs = 181, vs = 182, Es = -1, $n = 2147483646, On = 2147483645, pe = globalThis.__skal_acquireBridge();
  if (!pe || pe.byteLength !== ur)
    throw new Error(`Skal: bridge buffer not available (got ${pe && pe.byteLength})`);
  var gr = new Uint8Array(pe), ie = new Uint32Array(pe), $t = new BigInt64Array(pe), An = new TextEncoder, Ue = 16, yn = 64 + fr >> 2, kn = 16384, In = yn - 4, at = 0n, ve = Ue, Ae = Oe, lt = Ue;
  function Ot() {
    ie[wn] = ve - Ue << 2, ie[mn] = Ae - Oe, at += 1n, Atomics.store($t, Pn, at), lt = ve;
  }
  function Fr() {
    Ot();
    const t = at, n = performance.now() + 5000;
    for (;!(Atomics.load($t, Cn) >= t); )
      if (performance.now() > n) {
        console.warn("Skal: drain spin timeout \u2014 UI thread slow; ring will overwrite");
        break;
      }
    ve = Ue, Ae = Oe, lt = Ue;
  }
  function Y(t, n, i, l) {
    let u = ve;
    u >= In && (Fr(), u = ve), ie[u] = t >>> 0, ie[u + 1] = n >>> 0, ie[u + 2] = i >>> 0, ie[u + 3] = l >>> 0, ve = u + 4, ve - lt >= kn && Ot();
  }
  var Se = 0, we = 0;
  function ye(t) {
    Ae + t.length * 3 > dr && Fr();
    const n = Ae - Oe, i = gr.subarray(Ae, dr), { read: l, written: u } = An.encodeInto(t, i);
    if (l !== t.length)
      throw new Error(`Skal: string too large for heap (${t.length} code units > ${Pt} bytes)`);
    Ae += u, Se = n, we = u;
  }
  function st(t, n) {
    ye(n), Y(20, t, Se, we);
  }
  var At = false;
  function Nn() {
    At = false, ve !== lt && Ot();
  }
  function H() {
    At || (At = true, queueMicrotask(Nn));
  }
  var fe = 1024, k = new Int8Array(256);
  k.fill(-1), k[0] = 0, k[1] = 1, k[2] = 2, k[3] = 3, k[4] = 4, k[5] = 5, k[6] = 6, k[7] = 7, k[8] = 8, k[9] = 9, k[32] = 10, k[33] = 11, k[34] = 12, k[35] = 13, k[36] = 14, k[37] = 15, k[64] = 16, k[65] = 17, k[66] = 18, k[67] = 19, k[68] = 20, k[69] = 21, k[70] = 22, k[96] = 23, k[97] = 24, k[128] = 25, k[129] = 26, k[130] = 27, k[131] = 28, k[160] = 29, k[161] = 30, k[162] = 31, k[10] = 32, k[11] = 33, k[12] = 34, k[13] = 35, k[14] = 36, k[15] = 37, k[16] = 38, k[132] = 39, k[133] = 40, k[134] = 41, k[135] = 42, k[136] = 43, k[163] = 44, k[164] = 45, k[165] = 46, k[166] = 47, k[71] = 48, k[98] = 49, k[137] = 50, k[72] = 51, k[167] = 52, k[168] = 53, k[169] = 54, k[170] = 55, k[171] = 56, k[172] = 57, k[173] = 58, k[174] = 59, k[73] = 60, k[99] = 61, k[175] = 62, k[74] = 63;
  var oe = 64, ct = new Int32Array(fe * oe), Xe = new Float32Array(fe * oe), ut = new Array(fe * oe), Ye = new Uint8Array(fe * oe), ke = 6, Ie = new Float32Array(fe * ke);
  Ie.fill(NaN);
  var ft = new Map, _r = [], Dn = 0;
  function zn() {
    const t = fe * 2, n = fe * oe, i = t * oe, l = fe * ke, u = t * ke, g = new Int32Array(i);
    g.set(ct), ct = g;
    const m = new Uint8Array(i);
    m.set(Ye), Ye = m;
    const p = new Float32Array(i);
    p.set(Xe), p.fill(NaN, n), Xe = p;
    const y = new Float32Array(u);
    y.set(Ie), y.fill(NaN, l), Ie = y, ut.length = i, fe = t;
  }
  function dt(t) {
    let n = ft.get(t);
    if (n === undefined) {
      n = _r.pop(), n === undefined && (n = Dn++), n >= fe && zn(), ft.set(t, n);
      const i = n * oe;
      Ye.fill(0, i, i + oe), Xe.fill(NaN, i, i + oe);
      for (let l = i;l < i + oe; l++)
        ut[l] = undefined;
    }
    return n;
  }
  var br = new Map, vr = new Map, Er = new Map, Ne = new Map;
  function Ln(t) {
    const n = ft.get(t);
    if (n !== undefined) {
      ft.delete(t), _r.push(n);
      const i = n * ke;
      Ie.fill(NaN, i, i + ke);
    }
    br.delete(t), vr.delete(t), Er.delete(t), ni(t);
  }
  var ce = 0, Ee = 0, De = new Float32Array(1), Ke = new Uint32Array(De.buffer);
  function ne(t, n, i) {
    const l = i | 0, u = k[n];
    if (u < 0) {
      Y(16, t, n, l), ce++;
      return;
    }
    const g = dt(t) * oe + u;
    if (Ye[g] !== 0 && ct[g] === l) {
      Ee++;
      return;
    }
    ct[g] = l, Ye[g] = 1, Y(16, t, n, l), ce++;
  }
  function pr(t, n, i) {
    const l = k[n];
    if (l < 0) {
      De[0] = i, Y(17, t, n, Ke[0]), ce++;
      return;
    }
    const u = dt(t) * oe + l;
    if (Xe[u] === i) {
      Ee++;
      return;
    }
    Xe[u] = i, De[0] = i, Y(17, t, n, Ke[0]), ce++;
  }
  function Wn(t, n, i) {
    const l = k[n];
    if (l < 0) {
      ye(i == null ? "" : String(i)), Y(22, t, (n & 255) << 24 | Se & 16777215, we), ce++;
      return;
    }
    const u = dt(t) * oe + l;
    if (ut[u] === i) {
      Ee++;
      return;
    }
    ut[u] = i, ye(i == null ? "" : String(i)), Y(22, t, (n & 255) << 24 | Se & 16777215, we), ce++;
  }
  function ze(t, n, i, l) {
    const u = dt(t) * ke + i;
    if (Ie[u] === l) {
      Ee++;
      return;
    }
    Ie[u] = l, De[0] = l, Y(n, t, 0, Ke[0]), ce++;
  }
  function Vn(t, n) {
    ze(t, 32, 0, n);
  }
  function Bn(t, n) {
    ze(t, 33, 1, n);
  }
  function Mn(t, n) {
    ze(t, 34, 2, n);
  }
  function Hn(t, n) {
    ze(t, 35, 3, n);
  }
  function Gn(t, n) {
    ze(t, 36, 4, n);
  }
  function Un(t, n) {
    ze(t, 37, 5, n);
  }
  var Xn = { material: 0, cupertino: 1, adaptive: 2 }, Yn = { light: 0, dark: 1 };
  function Kn(t, n) {
    Y(38, typeof t == "string" ? Xn[t] ?? 0 : t | 0, typeof n == "string" ? Yn[n] ?? 0 : n | 0, 0), H();
  }
  function Jn(t) {
    Y(39, t, 0, 0), H();
  }
  function Sr(t) {
    return Le(1, "showDialog", [JSON.stringify(t || {})]);
  }
  function jn(t) {
    return Le(1, "showActionSheet", [JSON.stringify(t || {})]);
  }
  function wr(t) {
    return Le(1, "showSnackbar", [JSON.stringify(typeof t == "string" ? { message: t } : t || {})]);
  }
  function qn(t) {
    return Le(1, "showDatePicker", [JSON.stringify(t || {})]);
  }
  function Zn(t) {
    return Le(1, "showTimePicker", [JSON.stringify(t || {})]);
  }
  var mr = new Map;
  function Qn(t) {
    let n = 2166136261;
    for (let i = 0;i < t.length; i++)
      n ^= t.charCodeAt(i), n = Math.imul(n, 16777619) >>> 0;
    return n;
  }
  function me(t) {
    let n = mr.get(t);
    return n !== undefined || (n = Qn(t), ye(t), Y(23, n, Se, we), mr.set(t, n)), n;
  }
  function ei(t, n) {
    Y(4, t, me(n), 0);
  }
  function yt(t, n) {
    let i = t.get(n);
    return i === undefined && (i = new Map, t.set(n, i)), i;
  }
  function Rr(t, n, i) {
    const l = me(n), u = i >>> 0, g = yt(br, t);
    if (g.get(l) === u) {
      Ee++;
      return;
    }
    g.set(l, u), Y(24, t, l, u), ce++;
  }
  function Tr(t, n, i) {
    const l = me(n), u = yt(vr, t);
    if (u.get(l) === i) {
      Ee++;
      return;
    }
    u.set(l, i), De[0] = i, Y(25, t, l, Ke[0]), ce++;
  }
  function Pr(t, n, i) {
    const l = me(n), u = i == null ? "" : String(i), g = yt(Er, t);
    if (g.get(l) === u) {
      Ee++;
      return;
    }
    g.set(l, u), ye(u);
    const m = Se & 16777215, p = we & 255;
    Y(26, t, l, m << 8 | p), ce++;
  }
  function ti(t, n, i) {
    Y(27, t, me(n), i);
  }
  var Je = new Map, de = new Map, xr = 1;
  function Cr(t, n) {
    for (let i = 0;i < n.length; i++) {
      const l = n[i];
      if (typeof l == "number")
        Number.isInteger(l) ? Y(29, t, 1, l | 0) : (De[0] = l, Y(29, t, 2, Ke[0]));
      else if (typeof l == "boolean")
        Y(29, t, 3, l ? 1 : 0);
      else if (typeof l == "string") {
        ye(l);
        const u = Se >>> 0;
        Y(29, t, 4 | (we & 16777215) << 8, u);
      } else
        Y(29, t, 0, 0);
    }
  }
  function Le(t, n, i) {
    const l = me(n), u = xr++;
    return Cr(u, i), Y(28, t, l, u), H(), new Promise((g, m) => {
      Je.set(u, { resolve: g, reject: m });
    });
  }
  function ri(t, n, i, l, u) {
    const g = me(n), m = xr++;
    Cr(m, i), Y(30, t, g, m), H(), de.set(m, { nodeId: t, onValue: l, onError: u && u.onError, onDone: u && u.onDone });
    let p = Ne.get(t);
    return p === undefined && (p = new Set, Ne.set(t, p)), p.add(m), function() {
      if (!de.has(m))
        return;
      de.delete(m);
      const C = Ne.get(t);
      C && (C.delete(m), C.size === 0 && Ne.delete(t)), Y(31, m, 0, 0), H();
    };
  }
  function ni(t) {
    const n = Ne.get(t);
    if (n !== undefined) {
      for (const i of n)
        de.has(i) && (de.delete(i), Y(31, i, 0, 0));
      Ne.delete(t), H();
    }
  }
  var kt = new Map, ii = 1;
  function It(t) {
    const n = ii++;
    return kt.set(n, t), n;
  }
  function $r(t, n, i) {
    Y(21, t, n, i);
  }
  var Nt = 0n, Re = null, Or = ur - Ct, Dt = Ct >> 2, oi = Ct + Or >> 2, ai = Or / 16 | 0, Ar = new ArrayBuffer(4), zt = new Float32Array(Ar), Lt = new Uint32Array(Ar), li = new TextDecoder("utf-8");
  function Wt(t, n) {
    return n === 0 ? "" : li.decode(gr.subarray(xt + t, xt + t + n));
  }
  function Vt(t, n) {
    ie[Tn] = t + n;
  }
  globalThis.__skal_drainEvents = function() {
    const t = Atomics.load($t, xn);
    if (t === Nt)
      return;
    const n = Dt + (ie[Rn] >> 2);
    let i = Dt + (ie[hr] >> 2);
    const l = oi, u = Dt;
    let g = ai;
    for (;i !== n && g-- > 0; ) {
      const m = ie[i + 0], p = m & 255, y = m >>> 8 & 255, C = ie[i + 1], x = ie[i + 2], T = ie[i + 3];
      let N, _ = false;
      if (y === 1)
        N = x | 0, _ = true;
      else if (y === 2)
        Lt[0] = x, N = zt[0], _ = true;
      else if (y === 3)
        N = x !== 0, _ = true;
      else if (y === 4)
        N = Wt(T, x), _ = true, Vt(T, x);
      else if (y === 5) {
        const b = Wt(T, x);
        try {
          N = JSON.parse(b);
        } catch {
          N = b;
        }
        _ = true, Vt(T, x);
      } else if (y === 6) {
        const b = Wt(T, x);
        try {
          N = JSON.parse(b);
        } catch {
          N = [];
        }
        _ = true, Vt(T, x);
      } else if (y === 7) {
        Lt[0] = x;
        const b = zt[0];
        Lt[0] = T, N = [b, zt[0]], _ = true;
      }
      if (p === 3) {
        const b = Je.get(C);
        if (b) {
          Je.delete(C);
          try {
            b.resolve(_ ? N : undefined);
          } catch (v) {
            Re = v && (v.stack || v.message || String(v)) || "unknown";
          }
        }
      } else if (p === 4) {
        const b = Je.get(C);
        if (b) {
          Je.delete(C);
          try {
            const v = typeof N == "string" ? N : `skal RPC error (status ${N})`;
            b.reject(new Error(v));
          } catch (v) {
            Re = v && (v.stack || v.message || String(v)) || "unknown";
          }
        }
      } else if (p === 5) {
        const b = de.get(C);
        if (b)
          try {
            b.onValue(_ ? N : undefined);
          } catch (v) {
            Re = v && (v.stack || v.message || String(v)) || "unknown";
          }
      } else if (p === 6) {
        const b = de.get(C);
        if (b) {
          de.delete(C);
          try {
            b.onDone && b.onDone();
          } catch (v) {
            Re = v && (v.stack || v.message || String(v)) || "unknown";
          }
        }
      } else if (p === 7) {
        const b = de.get(C);
        if (b) {
          de.delete(C);
          try {
            b.onError && b.onError(new Error(typeof N == "string" ? N : "skal stream error"));
          } catch (v) {
            Re = v && (v.stack || v.message || String(v)) || "unknown";
          }
        }
      } else {
        const b = kt.get(C);
        if (b)
          try {
            _ ? (y === 6 || y === 7) && Array.isArray(N) ? b(...N) : b(N) : b();
          } catch (v) {
            Re = v && (v.stack || v.message || String(v)) || "unknown";
          }
      }
      i += 4, i >= l && (i = u);
    }
    ie[hr] = i - u << 2, Nt = t;
  }, globalThis.skalStatus = () => JSON.stringify({ handlerCount: kt.size, opSeq: Number(at), lastEventSeq: Number(Nt), lastHandlerError: Re, propWrites: ce, propSkips: Ee });
  var ps = 1, si = 2;
  function yr() {
    return si++;
  }
  var ci = { box: 0, column: 1, scrollView: 5, listView: 6, reorderableListView: 7, row: 2, text: 3, button: 4, image: 9, stack: 10, switch: 11, slider: 12, checkbox: 13, activityIndicator: 14, progressBar: 15, lazyGrid: 16, wrap: 17, safeArea: 18, richText: 19, textInput: 20, navigator: 21, screen: 22, tabs: 23, tab: 24, animatedList: 25, crossFade: 26, hero: 27, listTile: 28, pageView: 29, dismissible: 30, customScrollView: 31, sliverAppBar: 32, sliverList: 33, sliverGrid: 34, canvas: 35, dragItem: 36, dropZone: 37, radio: 38, chip: 39, segmentedButton: 40, expansionTile: 41, dropdown: 42, stepper: 43, step: 44, drawer: 45, bottomSheet: 46, backdropFilter: 47, interactiveViewer: 48 };
  function ui() {
    const t = [], n = { _cmds: t, fillStyle(i) {
      return t.push(["fillStyle", Bt(i)]), n;
    }, strokeStyle(i) {
      return t.push(["strokeStyle", Bt(i)]), n;
    }, lineWidth(i) {
      return t.push(["lineWidth", +i || 0]), n;
    }, fillRect(i, l, u, g) {
      return t.push(["fillRect", +i, +l, +u, +g]), n;
    }, strokeRect(i, l, u, g) {
      return t.push(["strokeRect", +i, +l, +u, +g]), n;
    }, circle(i, l, u) {
      return t.push(["circle", +i, +l, +u]), n;
    }, line(i, l, u, g) {
      return t.push(["line", +i, +l, +u, +g]), n;
    }, beginPath() {
      return t.push(["beginPath"]), n;
    }, moveTo(i, l) {
      return t.push(["moveTo", +i, +l]), n;
    }, lineTo(i, l) {
      return t.push(["lineTo", +i, +l]), n;
    }, closePath() {
      return t.push(["closePath"]), n;
    }, fill() {
      return t.push(["fill"]), n;
    }, stroke() {
      return t.push(["stroke"]), n;
    }, fontSize(i) {
      return t.push(["fontSize", +i || 14]), n;
    }, fillText(i, l, u) {
      return t.push(["fillText", String(i), +l, +u]), n;
    } };
    return n;
  }
  var fi = { padding: [0, "u32"], paddingTop: [1, "u32"], paddingRight: [2, "u32"], paddingBottom: [3, "u32"], paddingLeft: [4, "u32"], width: [5, "dim"], height: [6, "dim"], weight: [7, "f32"], alignment: [8, "u32"], gap: [9, "u32"], axis: [10, "u32"], top: [11, "u32"], right: [12, "u32"], bottom: [13, "u32"], left: [14, "u32"], crossAxisCount: [15, "u32"], aspectRatio: [16, "f32"], background: [32, "color"], color: [33, "color"], cornerRadius: [34, "u32"], borderWidth: [35, "u32"], borderColor: [36, "color"], shadow: [37, "u32"], fontSize: [64, "u32"], fontWeight: [65, "u32"], fontFamily: [66, "u32"], textAlign: [67, "u32"], lineHeight: [68, "u32"], maxLines: [69, "u32"], textOverflow: [70, "u32"], src: [96, "str"], contentScale: [97, "u32"], placeholder: [128, "str"], value: [129, "str"], keyboardType: [130, "u32"], secureEntry: [131, "u32"], checked: [132, "u32"], min: [134, "f32"], max: [135, "f32"], progress: [136, "f32"], initialSize: [176, "f32"], minSize: [177, "f32"], maxSize: [178, "f32"], presentation: [166, "u32"], title: [71, "str"], icon: [98, "str"], leadingIcon: [98, "str"], subtitle: [73, "str"], trailingIcon: [99, "str"], activeTab: [137, "u32"], tag: [72, "str"], transition: [171, "u32"], enabled: [160, "u32"], focusable: [161, "u32"], visible: [162, "u32"], draggable: [172, "u32"], spring: [173, "u32"], release: [174, "u32"], sliverMode: [175, "u32"], dragData: [74, "str"], scrollbar: [179, "u32"], blurRadius: [180, "u32"], minScale: [181, "f32"], maxScale: [182, "f32"], semanticLabel: [75, "str"] }, di = { opacity: Vn, translationX: Bn, translationY: Mn, scaleX: Hn, scaleY: Gn, rotation: Un }, hi = { onClick: 1, onclick: 1, onTap: 1, onLongPress: 8, onDoubleTap: 9, onChange: 2, onSubmit: 10, onReorder: 11, onPop: 12, onDismiss: 20, onPanStart: 13, onPanUpdate: 14, onPanEnd: 15, onScaleStart: 16, onScaleUpdate: 17, onScaleEnd: 18, onDrop: 21, onHover: 22, onKey: 23 }, gi = { linear: 0, easeIn: 1, easeOut: 2, easeInOut: 3, bounce: 4, elastic: 5, fastOutSlowIn: 6 }, Fi = { gentle: 1, bouncy: 2, stiff: 3 };
  function Bt(t) {
    if (typeof t == "number")
      return t | 0;
    if (typeof t != "string")
      return 0;
    let n = t.trim();
    n.startsWith("#") && (n = n.slice(1));
    let i = 0, l = 0, u = 0, g = 255;
    return n.length === 3 ? (i = parseInt(n[0] + n[0], 16), l = parseInt(n[1] + n[1], 16), u = parseInt(n[2] + n[2], 16)) : n.length === 4 ? (i = parseInt(n[0] + n[0], 16), l = parseInt(n[1] + n[1], 16), u = parseInt(n[2] + n[2], 16), g = parseInt(n[3] + n[3], 16)) : n.length === 6 ? (i = parseInt(n.slice(0, 2), 16), l = parseInt(n.slice(2, 4), 16), u = parseInt(n.slice(4, 6), 16)) : n.length === 8 && (g = parseInt(n.slice(0, 2), 16), i = parseInt(n.slice(2, 4), 16), l = parseInt(n.slice(4, 6), 16), u = parseInt(n.slice(6, 8), 16)), (g & 255) << 24 | (i & 255) << 16 | (l & 255) << 8 | u & 255 | 0;
  }
  function _i(t) {
    return typeof t == "number" ? t | 0 : t === "fill" ? $n : t === "wrap" ? On : -1;
  }
  function bi(t) {
    if (Array.isArray(t))
      return true;
    const n = Object.getPrototypeOf(t);
    return n === Object.prototype || n === null;
  }
  function vi(t, n, i) {
    if (i == null)
      return;
    if (n === "ref" && i && typeof i.__skalBind == "function") {
      i.__skalBind(t.id);
      return;
    }
    const l = typeof i;
    if (l === "object" && bi(i)) {
      Pr(t.id, n, JSON.stringify(i)), H();
      return;
    }
    if (l === "function") {
      const u = It(i);
      ti(t.id, n, u), H();
      return;
    }
    if (l === "number") {
      Number.isInteger(i) && i >= 0 && i <= 4294967295 && Rr(t.id, n, i | 0), Tr(t.id, n, i), H();
      return;
    }
    if (l === "string") {
      Pr(t.id, n, i), H();
      return;
    }
    if (l === "boolean") {
      Rr(t.id, n, i ? 1 : 0), H();
      return;
    }
  }
  function Ei(t) {
    const n = [t];
    for (;n.length > 0; ) {
      const i = n.pop();
      Ln(i.id);
      let l = i.firstChild;
      for (;l; )
        n.push(l), l = l.nextSibling;
    }
  }
  var ht = class {
    constructor(t, n, i = false, l = false) {
      this.tag = t, this.id = n, this.isText = i, this.isCustom = l, this.parent = null, this.firstChild = null, this.lastChild = null, this.nextSibling = null, this.prevSibling = null, this.text = "";
    }
  }, pi = un({ createElement(t) {
    const n = yr(), i = ci[t];
    return i !== undefined ? (Y(1, n, i, 0), H(), new ht(t, n, false, false)) : (ei(n, t), H(), new ht(t, n, false, true));
  }, createTextNode(t) {
    const n = yr();
    Y(1, n, 3, 0);
    const i = t == null ? "" : String(t);
    i.length > 0 && st(n, i), H();
    const l = new ht("#text", n, true);
    return l.text = i, l;
  }, replaceText(t, n) {
    const i = n == null ? "" : String(n);
    t.text !== i && (t.text = i, st(t.id, i), H());
  }, setProperty(t, n, i, l) {
    if (t.isCustom) {
      vi(t, n, i);
      return;
    }
    if (n === "onRefresh") {
      if (typeof i == "function") {
        const p = t.id, y = i, x = It(async () => {
          try {
            await y();
          } finally {
            Jn(p);
          }
        });
        $r(t.id, 19, x), H();
      }
      return;
    }
    if (n === "draw" && typeof i == "function") {
      const p = i, y = t;
      Zt(() => {
        const C = ui();
        try {
          p(C);
        } catch {}
        const x = JSON.stringify(C._cmds);
        x !== y._skalCanvasProgram && (y._skalCanvasProgram = x, st(y.id, x), H());
      });
      return;
    }
    const u = hi[n];
    if (u !== undefined) {
      if (typeof i == "function") {
        const p = It(i);
        $r(t.id, u, p), H();
      }
      return;
    }
    if (n === "value" && t.tag === "slider") {
      pr(t.id, 133, Number(i) || 0), H();
      return;
    }
    if (n === "draggable" && typeof i == "string") {
      ne(t.id, 172, { free: 1, both: 1, horizontal: 2, x: 2, vertical: 3, y: 3 }[i] ?? 0), H();
      return;
    }
    if (n === "spring" && typeof i == "string") {
      ne(t.id, 173, { gentle: 1, bouncy: 2, stiff: 3, wobbly: 2 }[i] ?? 0), H();
      return;
    }
    if (n === "release" && typeof i == "string") {
      ne(t.id, 174, { none: 0, glide: 1, friction: 1, springback: 2, spring: 2 }[i.toLowerCase()] ?? 0), H();
      return;
    }
    if (n === "sliverMode" && typeof i == "string") {
      ne(t.id, 175, { normal: 0, pinned: 1, floating: 2, both: 3 }[i.toLowerCase()] ?? 0), H();
      return;
    }
    if (n === "animate" && i && typeof i == "object") {
      if (ne(t.id, 163, i.duration | 0), i.curve != null) {
        const p = typeof i.curve == "string" ? gi[i.curve] ?? 0 : i.curve | 0;
        ne(t.id, 164, p);
      }
      if (i.delay != null && ne(t.id, 165, i.delay | 0), i.repeat != null && ne(t.id, 167, i.repeat ? 1 : 0), i.reverse != null && ne(t.id, 168, i.reverse ? 1 : 0), i.loop != null && ne(t.id, 169, i.loop | 0), i.spring != null) {
        const p = typeof i.spring == "string" ? Fi[i.spring] ?? 0 : i.spring ? 2 : 0;
        ne(t.id, 170, p);
      }
      H();
      return;
    }
    if (n === "label" && (t.tag === "button" || t.tag === "text" || t.tag === "chip")) {
      const p = i == null ? "" : String(i);
      st(t.id, p), H();
      return;
    }
    const g = di[n];
    if (g !== undefined) {
      typeof i == "number" && (g(t.id, i), H());
      return;
    }
    const m = fi[n];
    if (m !== undefined) {
      const [p, y] = m;
      if (i == null)
        return;
      switch (y) {
        case "u32":
          typeof i == "number" ? (ne(t.id, p, i | 0), H()) : typeof i == "boolean" && (ne(t.id, p, i ? 1 : 0), H());
          return;
        case "f32":
          typeof i == "number" && (pr(t.id, p, i), H());
          return;
        case "str":
          Wn(t.id, p, String(i)), H();
          return;
        case "color":
          ne(t.id, p, Bt(i)), H();
          return;
        case "dim":
          ne(t.id, p, _i(i)), H();
          return;
      }
      return;
    }
    if (n === "style" && i && typeof i == "object") {
      for (const p in i)
        this.setProperty(t, p, i[p]);
      return;
    }
  }, insertNode(t, n, i) {
    if (n === i)
      return;
    if (n.parent) {
      const u = n.parent;
      n.prevSibling ? n.prevSibling.nextSibling = n.nextSibling : u.firstChild === n && (u.firstChild = n.nextSibling), n.nextSibling ? n.nextSibling.prevSibling = n.prevSibling : u.lastChild === n && (u.lastChild = n.prevSibling), n.prevSibling = null, n.nextSibling = null;
    }
    const l = i ? i.id : 0;
    Y(3, t.id, n.id, l), H(), n.parent = t, i ? (n.nextSibling = i, n.prevSibling = i.prevSibling, i.prevSibling ? i.prevSibling.nextSibling = n : t.firstChild = n, i.prevSibling = n) : (n.prevSibling = t.lastChild, n.nextSibling = null, t.lastChild ? t.lastChild.nextSibling = n : t.firstChild = n, t.lastChild = n);
  }, removeNode(t, n) {
    Y(2, n.id, 0, 0), Ei(n), H(), n.prevSibling ? n.prevSibling.nextSibling = n.nextSibling : t.firstChild = n.nextSibling, n.nextSibling ? n.nextSibling.prevSibling = n.prevSibling : t.lastChild = n.prevSibling, n.parent = null, n.prevSibling = null, n.nextSibling = null;
  }, isTextNode(t) {
    return t.isText;
  }, getParentNode(t) {
    return t.parent;
  }, getFirstChild(t) {
    return t.firstChild;
  }, getNextSibling(t) {
    return t.nextSibling;
  } }), { render: Si, effect: z, memo: Mt, createComponent: O, createElement: o, createTextNode: Ss, insertNode: f, insert: A, spread: ws, setProp: e, mergeProps: ms, use: wi } = pi;
  Y(1, 1, 0, 0), H();
  var mi = new ht("box", 1, false);
  function Ri() {
    let t = 0;
    const n = function() {};
    return n.__skalBind = (i) => {
      t = i;
    }, new Proxy(n, { apply(i, l, u) {
      const g = u[0];
      g && typeof g.id == "number" && (t = g.id);
    }, get(i, l) {
      if (l === "__skalBind" || typeof l == "symbol")
        return n[l];
      if (typeof l == "string" && l.endsWith("$") && l.length > 1) {
        const u = l.slice(0, -1);
        return (...g) => {
          if (t === 0)
            throw new Error(`skal ref: cannot call .${String(l)}() before the host mounts. Move the call into a JSX event handler.`);
          const m = g[g.length - 1];
          if (typeof m != "function")
            throw new TypeError(`skal ref: .${String(l)}() requires a callback as its last argument (got ${typeof m})`);
          const p = g.slice(0, -1);
          return ri(t, u, p, m);
        };
      }
      return (...u) => t === 0 ? Promise.reject(new Error(`skal ref: cannot call .${String(l)}() before the host mounts. Move the call into a JSX event handler.`)) : Le(t, l, u);
    } });
  }
  function Ht(t, n, i) {
    const l = (b) => {
      const v = t[b];
      return typeof v == "function" ? v : v && v.component || null;
    }, u = (b) => {
      const v = t[b];
      return v && typeof v == "object" ? v.title : undefined;
    }, g = (b) => {
      const v = t[b];
      return v && typeof v == "object" ? v.transition : undefined;
    }, m = (b) => b === "fade" ? 1 : b === "none" ? 2 : typeof b == "number" ? b : 0, p = !!(i && i.linking), y = typeof window < "u", C = () => {
      if (!y)
        return null;
      const b = (window.location.hash || "").replace(/^#\/?/, "").split("?")[0];
      return b && t[b] ? b : null;
    };
    let x = typeof n == "string" ? n : n && n.name || Object.keys(t)[0];
    if (p) {
      const b = C();
      b && (x = b);
    }
    const [T, N] = W([{ name: x, params: {}, title: u(x), transition: g(x) }]), _ = { stack: T, navigate(b, v, I) {
      N([...T(), { name: b, params: v || {}, presentation: I && I.presentation, title: (I && I.title) !== undefined ? I.title : u(b), transition: (I && I.transition) !== undefined ? I.transition : g(b) }]);
    }, back() {
      const b = T();
      b.length > 1 && N(b.slice(0, -1));
    }, replace(b, v, I) {
      N([...T().slice(0, -1), { name: b, params: v || {}, title: (I && I.title) !== undefined ? I.title : u(b), transition: (I && I.transition) !== undefined ? I.transition : g(b) }]);
    }, reset(b, v) {
      N([{ name: b, params: v || {}, title: u(b), transition: g(b) }]);
    }, canGoBack() {
      return T().length > 1;
    } };
    return p && y && Zt(() => {
      const b = T(), v = "#/" + b[b.length - 1].name;
      window.location.hash !== v && window.history.replaceState({}, "", v);
    }), _.View = () => (() => {
      var b = o("navigator");
      return e(b, "onPop", () => _.back()), A(b, O(Q, { get each() {
        return T();
      }, children: (v) => {
        const I = l(v.name);
        return (() => {
          var B = o("screen");
          return A(B, I ? O(I, { get params() {
            return v.params || {};
          }, router: _ }) : null), z((S) => {
            var E = v.presentation === "modal" ? 1 : 0, a = v.title || "", h = m(v.transition);
            return E !== S.e && (S.e = e(B, "presentation", E, S.e)), a !== S.t && (S.t = e(B, "title", a, S.t)), h !== S.a && (S.a = e(B, "transition", h, S.a)), S;
          }, { e: undefined, t: undefined, a: undefined }), B;
        })();
      } })), b;
    })(), _;
  }
  var Ti = "#FFFFFFFF", Pi = "#FFE5E5EA", kr = "#FF1C1C1E", ge = "#FF0A84FF", Te = "#FF34C759", We = "#FFFF9F0A", gt = "#FFFF3B30", Ve = "#FF5E5CE6";
  function V(t) {
    return (() => {
      var n = o("column"), i = o("text");
      return f(n, i), e(n, "background", "#FFFFFFFF"), e(n, "cornerRadius", 14), e(n, "padding", 16), e(n, "gap", 12), e(n, "borderWidth", 1), e(n, "borderColor", "#FFE5E5EA"), e(i, "fontSize", 15), e(i, "fontWeight", 800), e(i, "color", "#FF1C1C1E"), A(n, () => t.children, null), z((l) => e(i, "label", t.title, l)), n;
    })();
  }
  function xi(t) {
    const n = ["Inbox", "Starred", "Drafts", "Archive"];
    return [(() => {
      var i = o("column");
      return e(i, "background", "#FFF2F2F7"), e(i, "padding", 16), e(i, "gap", 8), e(i, "height", "fill"), A(i, O(Q, { each: n, children: (l) => (() => {
        var u = o("box"), g = o("text");
        return f(u, g), e(u, "background", "#FFFFFFFF"), e(u, "cornerRadius", 8), e(u, "padding", 12), e(u, "onTap", () => t.router.navigate("detail", { name: l }, { title: l })), e(g, "label", `${l}   \u203A`), e(g, "fontSize", 14), e(g, "color", "#FF1C1C1E"), u;
      })() })), i;
    })(), (() => {
      var i = o("drawer"), l = o("box"), u = o("text");
      return f(i, l), e(i, "background", "#FFFFFFFF"), f(l, u), e(l, "padding", 20), e(l, "background", "#FF0A84FF"), e(u, "label", "Mail"), e(u, "fontSize", 20), e(u, "fontWeight", 800), e(u, "color", "#FFFFFF"), A(i, O(Q, { each: n, children: (g) => (() => {
        var m = o("box"), p = o("text");
        return f(m, p), e(m, "padding", 14), e(p, "label", g), e(p, "fontSize", 14), e(p, "color", "#FF1C1C1E"), m;
      })() }), null), i;
    })()];
  }
  function Ci(t) {
    return (() => {
      var n = o("column"), i = o("text"), l = o("text");
      return f(n, i), f(n, l), e(n, "background", "#FFF2F2F7"), e(n, "padding", 16), e(n, "gap", 10), e(n, "height", "fill"), e(i, "fontSize", 20), e(i, "fontWeight", 800), e(i, "color", "#FF1C1C1E"), e(l, "label", "The AppBar's \u2039 back button (and the system back / swipe gesture) all pop this route. The list screen behind stayed mounted \u2014 back is instant, no re-render, scroll preserved."), e(l, "fontSize", 13), e(l, "color", "#FF8E8E93"), z((u) => e(i, "label", t.name, u)), n;
    })();
  }
  var $i = [ge, Te, We, Ve];
  function Oi() {
    const [t, n] = W(false), [i, l] = W(false), [u, g] = W(false), [m, p] = W(0), [y, C] = W("0, 0"), [x, T] = W(false), [N, _] = W(["Alpha", "Beta", "Gamma"]);
    let b = 3;
    const v = Ht({ gallery: (I) => (() => {
      var B = o("column"), S = o("text"), E = o("row");
      return f(B, S), f(B, E), e(B, "background", "#FFF2F2F7"), e(B, "padding", 16), e(B, "gap", 12), e(B, "height", "fill"), e(S, "label", "Tap a swatch \u2014 it flies to the detail screen."), e(S, "fontSize", 13), e(S, "color", "#FF8E8E93"), e(E, "gap", 12), A(E, O(Q, { each: $i, children: (a) => (() => {
        var h = o("hero"), F = o("box");
        return f(h, F), e(h, "tag", `hero-${a}`), e(F, "width", 56), e(F, "height", 56), e(F, "background", a), e(F, "cornerRadius", 12), e(F, "onTap", () => I.router.navigate("detail", { color: a })), h;
      })() })), B;
    })(), detail: { component: (I) => (() => {
      var B = o("column"), S = o("hero"), E = o("box"), a = o("text");
      return f(B, S), f(B, a), e(B, "background", "#FFF2F2F7"), e(B, "padding", 16), e(B, "gap", 12), e(B, "height", "fill"), f(S, E), e(E, "width", "fill"), e(E, "height", 180), e(E, "cornerRadius", 20), e(a, "label", "The swatch flew here from the gallery \u2014 a shared-element transition, GPU-composited host-side."), e(a, "fontSize", 13), e(a, "color", "#FF8E8E93"), z((h) => {
        var F = `hero-${I.params.color}`, R = I.params.color;
        return F !== h.e && (h.e = e(S, "tag", F, h.e)), R !== h.t && (h.t = e(E, "background", R, h.t)), h;
      }, { e: undefined, t: undefined }), B;
    })(), title: "Detail", transition: "fade" } }, "gallery");
    return (() => {
      var I = o("scrollView"), B = o("text"), S = o("text"), E = o("text");
      return f(I, B), f(I, S), f(I, E), e(I, "background", "#FFF2F2F7"), e(I, "padding", 16), e(I, "gap", 14), e(B, "label", "Animations"), e(B, "fontSize", 24), e(B, "fontWeight", 800), e(B, "color", "#FF1C1C1E"), e(S, "label", "Host-side motion \u2014 JS flips one signal, Flutter runs the whole tween. Zero per-frame bridge traffic. See ANIMATION.md for the full plan."), e(S, "fontSize", 13), e(S, "color", "#FF8E8E93"), A(I, O(V, { title: "Implicit hot-prop tween \u2014 the animate prop", get children() {
        return [(() => {
          var a = o("row"), h = o("box");
          return f(a, h), e(a, "gap", 8), e(h, "width", 64), e(h, "height", 64), e(h, "background", "#FF0A84FF"), e(h, "cornerRadius", 14), e(h, "animate", { duration: 450, curve: "easeInOut" }), z((F) => {
            var R = t() ? 0.3 : 1, P = t() ? 1.4 : 1, D = t() ? 1.4 : 1, te = t() ? 0.5 : 0, Z = t() ? 70 : 0;
            return R !== F.e && (F.e = e(h, "opacity", R, F.e)), P !== F.t && (F.t = e(h, "scaleX", P, F.t)), D !== F.a && (F.a = e(h, "scaleY", D, F.a)), te !== F.o && (F.o = e(h, "rotation", te, F.o)), Z !== F.i && (F.i = e(h, "translationX", Z, F.i)), F;
          }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined }), a;
        })(), (() => {
          var a = o("button");
          return e(a, "onClick", () => n(!t())), z((h) => e(a, "label", t() ? "Reset" : "Animate", h)), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "opacity + scale + rotation + translation tween together \u2014 JS only flips one signal; the whole tween runs host-side."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), E), A(I, O(V, { title: "Cold-prop tween \u2014 colour \xB7 radius \xB7 padding", get children() {
        return [(() => {
          var a = o("box"), h = o("text");
          return f(a, h), e(a, "animate", { duration: 400, curve: "easeInOut" }), e(a, "width", "fill"), e(h, "label", "AnimatedContainer tweens these host-side"), e(h, "fontSize", 12), e(h, "color", "#FFFFFFFF"), z((F) => {
            var R = i() ? gt : ge, P = i() ? 32 : 8, D = i() ? 28 : 12;
            return R !== F.e && (F.e = e(a, "background", R, F.e)), P !== F.t && (F.t = e(a, "cornerRadius", P, F.t)), D !== F.a && (F.a = e(a, "padding", D, F.a)), F;
          }, { e: undefined, t: undefined, a: undefined }), a;
        })(), (() => {
          var a = o("button");
          return e(a, "onClick", () => l(!i())), z((h) => e(a, "label", i() ? "Reset" : "Animate", h)), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "background, cornerRadius and padding are cold props \u2014 the host's AnimatedContainer tweens them; JS writes each value once."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), E), A(I, O(V, { title: "Looping \u2014 repeat \xB7 reverse", get children() {
        return [(() => {
          var a = o("row"), h = o("box"), F = o("box"), R = o("box");
          return f(a, h), f(a, F), f(a, R), e(a, "gap", 20), e(h, "width", 44), e(h, "height", 44), e(h, "background", "#FF5E5CE6"), e(h, "cornerRadius", 22), e(h, "animate", { duration: 800, curve: "easeInOut", repeat: true, reverse: true }), e(h, "scaleX", 1.35), e(h, "scaleY", 1.35), e(F, "width", 44), e(F, "height", 44), e(F, "background", "#FF34C759"), e(F, "cornerRadius", 10), e(F, "animate", { duration: 1400, repeat: true }), e(F, "rotation", 6.2832), e(R, "width", 44), e(R, "height", 44), e(R, "background", "#FFFF9F0A"), e(R, "cornerRadius", 22), e(R, "animate", { duration: 900, curve: "easeInOut", repeat: true, reverse: true }), e(R, "opacity", 0.25), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "A pulse, a spin and a breathe \u2014 each loops forever host-side; JS set the endpoints once and never touches them again."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), E), A(I, O(V, { title: "Spring physics \u2014 animate.spring", get children() {
        return [(() => {
          var a = o("column"), h = o("box"), F = o("box"), R = o("box");
          return f(a, h), f(a, F), f(a, R), e(a, "gap", 10), e(h, "width", 48), e(h, "height", 48), e(h, "background", "#FF0A84FF"), e(h, "cornerRadius", 10), e(h, "animate", { duration: 700, spring: "gentle" }), e(F, "width", 48), e(F, "height", 48), e(F, "background", "#FF34C759"), e(F, "cornerRadius", 10), e(F, "animate", { duration: 700, spring: "bouncy" }), e(R, "width", 48), e(R, "height", 48), e(R, "background", "#FFFF9F0A"), e(R, "cornerRadius", 10), e(R, "animate", { duration: 700, spring: "stiff" }), z((P) => {
            var D = u() ? 150 : 0, te = u() ? 150 : 0, Z = u() ? 150 : 0;
            return D !== P.e && (P.e = e(h, "translationX", D, P.e)), te !== P.t && (P.t = e(F, "translationX", te, P.t)), Z !== P.a && (P.a = e(R, "translationX", Z, P.a)), P;
          }, { e: undefined, t: undefined, a: undefined }), a;
        })(), (() => {
          var a = o("button");
          return e(a, "onClick", () => g(!u())), z((h) => e(a, "label", u() ? "Back" : "Spring", h)), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "gentle \xB7 bouncy \xB7 stiff \u2014 three spring-like curves; bouncy overshoots and wobbles into place."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), E), A(I, O(V, { title: "Physics \u2014 real SpringSimulation (spring)", get children() {
        return [(() => {
          var a = o("column"), h = o("box"), F = o("box"), R = o("box");
          return f(a, h), f(a, F), f(a, R), e(a, "gap", 12), e(h, "width", 52), e(h, "height", 52), e(h, "background", "#FF0A84FF"), e(h, "cornerRadius", 12), e(h, "spring", "gentle"), e(F, "width", 52), e(F, "height", 52), e(F, "background", "#FF34C759"), e(F, "cornerRadius", 12), e(F, "spring", "bouncy"), e(R, "width", 52), e(R, "height", 52), e(R, "background", "#FFFF9F0A"), e(R, "cornerRadius", 12), e(R, "spring", "stiff"), z((P) => {
            var D = m(), te = m(), Z = m();
            return D !== P.e && (P.e = e(h, "translationX", D, P.e)), te !== P.t && (P.t = e(F, "translationX", te, P.t)), Z !== P.a && (P.a = e(R, "translationX", Z, P.a)), P;
          }, { e: undefined, t: undefined, a: undefined }), a;
        })(), (() => {
          var a = o("button");
          return e(a, "onClick", () => p(m() === 0 ? 175 : 0)), z((h) => e(a, "label", m() === 0 ? "Spring" : "Back", h)), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "A real SpringSimulation drives these \u2014 not a curve. Tap fast: the box retargets from its CURRENT position and velocity mid-flight, with no dead-stop restart. gentle settles, bouncy overshoots, stiff snaps."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), E), A(I, O(V, { title: "Physics \u2014 release momentum (draggable + release)", get children() {
        return [(() => {
          var a = o("box"), h = o("box"), F = o("text");
          return f(a, h), e(a, "height", 150), e(a, "background", "#FFEFEFF4"), e(a, "cornerRadius", 12), f(h, F), e(h, "draggable", true), e(h, "release", "glide"), e(h, "width", 60), e(h, "height", 60), e(h, "background", "#FF0A84FF"), e(h, "cornerRadius", 14), e(h, "onPanEnd", (R, P) => C(`${R.toFixed(0)}, ${P.toFixed(0)}`)), e(F, "label", "glide"), e(F, "fontSize", 11), e(F, "color", "#FFFFFFFF"), a;
        })(), (() => {
          var a = o("text");
          return e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), z((h) => e(a, "label", `Throw the blue box \u2014 friction carries it on after you let go and decelerates it to rest. Resting at ${y()}.`, h)), a;
        })(), (() => {
          var a = o("box"), h = o("box"), F = o("text");
          return f(a, h), e(a, "height", 150), e(a, "background", "#FFEFEFF4"), e(a, "cornerRadius", 12), f(h, F), e(h, "draggable", true), e(h, "release", "springBack"), e(h, "width", 60), e(h, "height", 60), e(h, "background", "#FF5E5CE6"), e(h, "cornerRadius", 14), e(F, "label", "spring"), e(F, "fontSize", 11), e(F, "color", "#FFFFFFFF"), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "Throw the purple box \u2014 a SpringSimulation springs it home to the origin, seeded with your fling velocity (throw harder \u2192 springs back harder). All host-side: zero per-frame bridge traffic."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), E), A(I, O(V, { title: "Cross-fade \u2014 CrossFade", get children() {
        return [(() => {
          var a = o("box"), h = o("crossFade");
          return f(a, h), e(a, "height", 92), A(h, (() => {
            var F = Mt(() => !!x());
            return () => F() ? (() => {
              var R = o("box"), P = o("text");
              return f(R, P), e(R, "width", "fill"), e(R, "height", 92), e(R, "background", "#FF5E5CE6"), e(R, "cornerRadius", 12), e(R, "padding", 16), e(P, "label", "Panel B"), e(P, "fontSize", 16), e(P, "fontWeight", 800), e(P, "color", "#FFFFFFFF"), R;
            })() : (() => {
              var R = o("box"), P = o("text");
              return f(R, P), e(R, "width", "fill"), e(R, "height", 92), e(R, "background", "#FF0A84FF"), e(R, "cornerRadius", 12), e(R, "padding", 16), e(P, "label", "Panel A"), e(P, "fontSize", 16), e(P, "fontWeight", 800), e(P, "color", "#FFFFFFFF"), R;
            })();
          })()), a;
        })(), (() => {
          var a = o("button");
          return e(a, "label", "Swap panel"), e(a, "onClick", () => T(!x())), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "AnimatedSwitcher fades the old child out as the new fades in \u2014 the outgoing element is retained through the fade."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), E), A(I, O(V, { title: "Animated list \u2014 AnimatedList", get children() {
        return [(() => {
          var a = o("animatedList");
          return e(a, "gap", 8), A(a, O(Q, { get each() {
            return N();
          }, children: (h) => (() => {
            var F = o("box"), R = o("text");
            return f(F, R), e(F, "background", "#FFEFEFF4"), e(F, "cornerRadius", 8), e(F, "padding", 12), e(R, "label", h), e(R, "fontSize", 13), e(R, "color", "#FF1C1C1E"), F;
          })() })), a;
        })(), (() => {
          var a = o("row"), h = o("button"), F = o("button");
          return f(a, h), f(a, F), e(a, "gap", 8), e(h, "label", "Add"), e(h, "onClick", () => _([...N(), `Item ${++b}`])), e(F, "label", "Remove"), e(F, "onClick", () => _(N().slice(0, -1))), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "Add \u2192 a row fades + expands in; Remove \u2192 it collapses + fades out. Both host-side, via deferred teardown."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), E), A(I, O(V, { title: "Shared element \u2014 Hero", get children() {
        return [(() => {
          var a = o("box");
          return e(a, "height", 300), e(a, "borderWidth", 1), e(a, "borderColor", "#FFE5E5EA"), e(a, "cornerRadius", 8), A(a, O(v.View, {})), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "A Hero with a matching tag on each screen flies between them across the navigator push \u2014 the navigator is a real Flutter Navigator."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), E), e(E, "label", "\u2014 end of animations \u2014"), e(E, "fontSize", 12), e(E, "color", "#FF8E8E93"), I;
    })();
  }
  function Ai() {
    const [t, n] = W("material"), [i, l] = W(false), [u, g] = W(true), [m, p] = W(false), [y, C] = W(40), [x, T] = W(""), [N, _] = W("none yet"), [b, v] = W(0), [I, B] = W(["Item one", "Item two", "Item three", "Item four"]);
    let S = 0;
    const [E, a] = W([]), [h, F] = W([]), [R, P] = W("M"), [D, te] = W([]), [Z, le] = W(0), [Fe, je] = W(false), [qe, Gt] = W(0), [Lr, Vi] = W(0), [Ut, Bi] = W(false), [Mi, Hi] = W("\u2014"), [Gi, Ui] = W("0, 0"), [Xi, Xt] = W("\u2014"), [Ft, Yi] = W(1);
    let Wr = 1;
    const [Ki, _t] = W("\u2014 try a dialog button \u2014"), [Ji, Vr] = W("\u2014 no date / time picked \u2014"), [Br, ji] = W(["First item", "Second item", "Third item", "Fourth item"]), qi = Ht({ list: { component: (ue) => O(xi, { get router() {
      return ue.router;
    } }), title: "Mailboxes" }, detail: (ue) => O(Ci, { get name() {
      return ue.params.name;
    }, get router() {
      return ue.router;
    } }) }, "list"), [Mr, Zi] = W(0), Yt = (ue, M) => {
      n(ue), l(M), Kn(ue, M ? 1 : 0);
    }, Qi = Ht({ home: { component: (ue) => eo(ue.router) }, animations: { component: () => O(Oi, {}), title: "Animations" } }, "home");
    function eo(ue) {
      return (() => {
        var M = o("scrollView"), Ze = o("text"), bt = o("text"), U = o("text");
        return f(M, Ze), f(M, bt), f(M, U), e(M, "background", "#FFF2F2F7"), e(M, "padding", 16), e(M, "gap", 14), e(M, "scrollbar", true), e(Ze, "label", "Skal \u2014 Component Demo"), e(Ze, "fontSize", 24), e(Ze, "fontWeight", 800), e(Ze, "color", "#FF1C1C1E"), e(bt, "label", "Every fast-path widget, plus animation, the design system, and dialogs."), e(bt, "fontSize", 13), e(bt, "color", "#FF8E8E93"), A(M, O(V, { title: "Design system \u2014 setDesign()", get children() {
          return [(() => {
            var r = o("text");
            return e(r, "fontSize", 13), e(r, "color", "#FF8E8E93"), z((s) => e(r, "label", `active: ${t()} \xB7 ${i() ? "dark" : "light"}`, s)), r;
          })(), (() => {
            var r = o("row"), s = o("button"), c = o("button"), d = o("button");
            return f(r, s), f(r, c), f(r, d), e(r, "gap", 8), e(s, "label", "Material"), e(s, "onClick", () => Yt("material", i())), e(c, "label", "Cupertino"), e(c, "onClick", () => Yt("cupertino", i())), e(d, "onClick", () => Yt(t(), !i())), z((w) => e(d, "label", i() ? "Light mode" : "Dark mode", w)), r;
          })(), (() => {
            var r = o("text");
            return e(r, "label", "Buttons, switches, sliders, the text field & spinner all swap Material\u2194Cupertino."), e(r, "fontSize", 11), e(r, "color", "#FF8E8E93"), r;
          })()];
        } }), U), A(M, O(V, { title: "Layout \u2014 box \xB7 row \xB7 wrap", get children() {
          return [(() => {
            var r = o("row"), s = o("box"), c = o("box"), d = o("box");
            return f(r, s), f(r, c), f(r, d), e(r, "gap", 8), e(s, "width", 56), e(s, "height", 56), e(s, "background", "#FF0A84FF"), e(s, "cornerRadius", 10), e(c, "width", 56), e(c, "height", 56), e(c, "background", "#FF34C759"), e(c, "cornerRadius", 10), e(d, "width", 56), e(d, "height", 56), e(d, "background", "#FFFF9F0A"), e(d, "cornerRadius", 10), r;
          })(), (() => {
            var r = o("text");
            return e(r, "label", "Wrap \u2014 children flow onto new runs:"), e(r, "fontSize", 11), e(r, "color", "#FF8E8E93"), r;
          })(), (() => {
            var r = o("wrap");
            return e(r, "gap", 6), A(r, O(Q, { each: ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa"], children: (s) => (() => {
              var c = o("box"), d = o("text");
              return f(c, d), e(c, "background", "#FFEFEFF4"), e(c, "cornerRadius", 12), e(c, "paddingLeft", 10), e(c, "paddingRight", 10), e(c, "paddingTop", 6), e(c, "paddingBottom", 6), e(d, "label", s), e(d, "fontSize", 12), e(d, "color", "#FF1C1C1E"), c;
            })() })), r;
          })()];
        } }), U), A(M, O(V, { title: "Stack \u2014 overlap + positioned children", get children() {
          var r = o("stack"), s = o("box"), c = o("box"), d = o("text"), w = o("box");
          return f(r, s), f(r, c), f(r, w), e(r, "width", "fill"), e(r, "height", 120), e(s, "width", "fill"), e(s, "height", 120), e(s, "background", "#FF5E5CE6"), e(s, "cornerRadius", 12), f(c, d), e(c, "top", 10), e(c, "left", 10), e(c, "background", "#FFFFFFFF"), e(c, "cornerRadius", 8), e(c, "paddingLeft", 10), e(c, "paddingRight", 10), e(c, "paddingTop", 4), e(c, "paddingBottom", 4), e(d, "label", "top \xB7 left"), e(d, "fontSize", 11), e(d, "color", "#FF1C1C1E"), e(w, "bottom", 10), e(w, "right", 10), e(w, "width", 30), e(w, "height", 30), e(w, "background", "#FFFF3B30"), e(w, "cornerRadius", 15), r;
        } }), U), A(M, O(V, { title: "Text & RichText", get children() {
          return [(() => {
            var r = o("text");
            return e(r, "label", "Styled text \u2014 18sp, weight 700."), e(r, "fontSize", 18), e(r, "fontWeight", 700), e(r, "color", "#FF1C1C1E"), r;
          })(), (() => {
            var r = o("richText"), s = o("text"), c = o("text"), d = o("text"), w = o("text"), L = o("text");
            return f(r, s), f(r, c), f(r, d), f(r, w), f(r, L), e(s, "label", "Rich text "), e(s, "fontSize", 16), e(s, "color", "#FF1C1C1E"), e(c, "label", "mixes "), e(c, "fontSize", 16), e(c, "color", "#FF0A84FF"), e(c, "fontWeight", 800), e(d, "label", "size, "), e(d, "fontSize", 22), e(d, "color", "#FFFF3B30"), e(d, "fontWeight", 700), e(w, "label", "weight "), e(w, "fontSize", 16), e(w, "color", "#FF34C759"), e(w, "fontWeight", 800), e(L, "label", "and colour inline."), e(L, "fontSize", 16), e(L, "color", "#FF1C1C1E"), r;
          })()];
        } }), U), A(M, O(V, { title: "Image \u2014 network \xB7 BoxFit \xB7 rounded", get children() {
          return [(() => {
            var r = o("image");
            return e(r, "src", "https://picsum.photos/seed/skal/640/360"), e(r, "width", "fill"), e(r, "height", 160), e(r, "contentScale", 1), e(r, "cornerRadius", 12), r;
          })(), (() => {
            var r = o("text");
            return e(r, "label", "contentScale=1 (cover); cornerRadius clips the pixels. Requires network."), e(r, "fontSize", 11), e(r, "color", "#FF8E8E93"), r;
          })()];
        } }), U), A(M, O(V, { title: "Scrolling \u2014 horizontal list \xB7 lazy grid \xB7 reorderable", get children() {
          return [(() => {
            var r = o("text");
            return e(r, "label", "listView axis=1 (horizontal, virtualized):"), e(r, "fontSize", 11), e(r, "color", "#FF8E8E93"), r;
          })(), (() => {
            var r = o("listView");
            return e(r, "axis", 1), e(r, "height", 66), e(r, "gap", 8), A(r, O(Q, { each: [ge, Te, We, Ve, gt, "#FF00C7BE", "#FFAF52DE", "#FFFFD60A"], children: (s) => (() => {
              var c = o("box");
              return e(c, "width", 66), e(c, "height", 50), e(c, "background", s), e(c, "cornerRadius", 10), c;
            })() })), r;
          })(), (() => {
            var r = o("text");
            return e(r, "label", "lazyGrid \u2014 crossAxisCount=4:"), e(r, "fontSize", 11), e(r, "color", "#FF8E8E93"), r;
          })(), (() => {
            var r = o("lazyGrid");
            return e(r, "crossAxisCount", 4), e(r, "aspectRatio", 1), e(r, "gap", 8), e(r, "height", 150), A(r, O(Q, { get each() {
              return Array.from({ length: 12 }, (s, c) => c);
            }, children: (s) => (() => {
              var c = o("box");
              return e(c, "background", s % 3 === 0 ? ge : s % 3 === 1 ? Te : We), e(c, "cornerRadius", 8), c;
            })() })), r;
          })(), (() => {
            var r = o("text");
            return e(r, "label", "reorderableListView \u2014 drag a row to reorder:"), e(r, "fontSize", 11), e(r, "color", "#FF8E8E93"), r;
          })(), (() => {
            var r = o("reorderableListView");
            return e(r, "height", 200), e(r, "gap", 6), e(r, "onReorder", (s, c) => {
              const d = Br().slice(), [w] = d.splice(s, 1);
              d.splice(c, 0, w), ji(d);
            }), A(r, O(Q, { get each() {
              return Br();
            }, children: (s) => (() => {
              var c = o("box"), d = o("text");
              return f(c, d), e(c, "background", "#FFEFEFF4"), e(c, "cornerRadius", 8), e(c, "padding", 12), e(d, "label", s), e(d, "fontSize", 13), e(d, "color", "#FF1C1C1E"), c;
            })() })), r;
          })()];
        } }), U), A(M, O(V, { title: "Controls \u2014 switch \xB7 checkbox \xB7 slider \xB7 text field", get children() {
          return [(() => {
            var r = o("row"), s = o("switch"), c = o("text");
            return f(r, s), f(r, c), e(r, "gap", 12), e(s, "onChange", (d) => g(d)), e(c, "fontSize", 13), e(c, "color", "#FF1C1C1E"), z((d) => {
              var w = u(), L = u() ? "switch: on" : "switch: off";
              return w !== d.e && (d.e = e(s, "checked", w, d.e)), L !== d.t && (d.t = e(c, "label", L, d.t)), d;
            }, { e: undefined, t: undefined }), r;
          })(), (() => {
            var r = o("row"), s = o("checkbox"), c = o("text");
            return f(r, s), f(r, c), e(r, "gap", 12), e(s, "onChange", (d) => p(d)), e(c, "fontSize", 13), e(c, "color", "#FF1C1C1E"), z((d) => {
              var w = m(), L = m() ? "checkbox: checked" : "checkbox: unchecked";
              return w !== d.e && (d.e = e(s, "checked", w, d.e)), L !== d.t && (d.t = e(c, "label", L, d.t)), d;
            }, { e: undefined, t: undefined }), r;
          })(), (() => {
            var r = o("slider");
            return e(r, "min", 0), e(r, "max", 100), e(r, "onChange", (s) => C(s)), z((s) => e(r, "value", y(), s)), r;
          })(), (() => {
            var r = o("text");
            return e(r, "fontSize", 13), e(r, "color", "#FF1C1C1E"), z((s) => e(r, "label", `slider: ${Math.round(y())}`, s)), r;
          })(), (() => {
            var r = o("textInput");
            return e(r, "placeholder", "Type your name\u2026"), e(r, "onChange", (s) => T(s)), e(r, "onSubmit", (s) => wr(`Submitted: ${s}`)), z((s) => e(r, "value", x(), s)), r;
          })(), (() => {
            var r = o("text");
            return e(r, "fontSize", 13), e(r, "color", "#FF8E8E93"), z((s) => e(r, "label", x() ? `Hello, ${x()}!` : "\u2014 type above; press Enter to submit \u2014", s)), r;
          })()];
        } }), U), A(M, O(V, { title: "Indicators \u2014 spinner \xB7 progress bar", get children() {
          return [(() => {
            var r = o("row"), s = o("activityIndicator"), c = o("text");
            return f(r, s), f(r, c), e(r, "gap", 12), e(s, "color", "#FF0A84FF"), e(c, "label", "CircularProgressIndicator"), e(c, "fontSize", 13), e(c, "color", "#FF1C1C1E"), r;
          })(), (() => {
            var r = o("text");
            return e(r, "label", "determinate \u2014 tracks the slider above:"), e(r, "fontSize", 11), e(r, "color", "#FF8E8E93"), r;
          })(), (() => {
            var r = o("progressBar");
            return e(r, "color", "#FF0A84FF"), z((s) => e(r, "progress", y() / 100, s)), r;
          })(), (() => {
            var r = o("text");
            return e(r, "label", "indeterminate:"), e(r, "fontSize", 11), e(r, "color", "#FF8E8E93"), r;
          })(), (() => {
            var r = o("progressBar");
            return e(r, "color", "#FF34C759"), r;
          })()];
        } }), U), A(M, O(V, { title: "Animation", get children() {
          return [(() => {
            var r = o("text");
            return e(r, "label", "Implicit tweens, looping, list enter/exit, Hero \u2014 all host-side, zero per-frame bridge traffic. Opens a dedicated page."), e(r, "fontSize", 11), e(r, "color", "#FF8E8E93"), r;
          })(), (() => {
            var r = o("button");
            return e(r, "label", "Open Animations \u2192"), e(r, "onClick", () => ue.navigate("animations")), r;
          })()];
        } }), U), A(M, O(V, { title: "ListTile \u2014 structured rows", get children() {
          return [(() => {
            var r = o("box"), s = o("column"), c = o("listTile"), d = o("listTile"), w = o("listTile");
            return f(r, s), e(r, "background", "#FFFFFFFF"), e(r, "cornerRadius", 12), e(r, "borderWidth", 1), e(r, "borderColor", "#FFE5E5EA"), f(s, c), f(s, d), f(s, w), e(s, "padding", 0), e(s, "gap", 0), e(c, "leadingIcon", "person"), e(c, "title", "Profile"), e(c, "subtitle", "Name, photo, bio"), e(c, "trailingIcon", "explore"), e(c, "onClick", () => _("tapped Profile")), e(d, "leadingIcon", "bell"), e(d, "title", "Notifications"), e(d, "subtitle", "Sounds, badges, alerts"), e(d, "trailingIcon", "explore"), e(d, "onClick", () => _("tapped Notifications")), e(w, "leadingIcon", "settings"), e(w, "title", "Settings"), e(w, "trailingIcon", "explore"), e(w, "onClick", () => _("tapped Settings")), r;
          })(), (() => {
            var r = o("text");
            return e(r, "fontSize", 11), e(r, "color", "#FF8E8E93"), z((s) => e(r, "label", `last row: ${N()}`, s)), r;
          })()];
        } }), U), A(M, O(V, { title: "PageView \u2014 swipe between pages", get children() {
          return [(() => {
            var r = o("box"), s = o("pageView"), c = o("box"), d = o("text"), w = o("box"), L = o("text"), G = o("box"), j = o("text");
            return f(r, s), e(r, "height", 140), f(s, c), f(s, w), f(s, G), e(s, "onChange", (J) => v(J)), f(c, d), e(c, "width", "fill"), e(c, "height", 140), e(c, "background", "#FF0A84FF"), e(c, "cornerRadius", 12), e(c, "padding", 20), e(d, "label", "Page 1 \u2014 swipe \u2192"), e(d, "fontSize", 16), e(d, "fontWeight", 800), e(d, "color", "#FFFFFFFF"), f(w, L), e(w, "width", "fill"), e(w, "height", 140), e(w, "background", "#FF34C759"), e(w, "cornerRadius", 12), e(w, "padding", 20), e(L, "label", "Page 2"), e(L, "fontSize", 16), e(L, "fontWeight", 800), e(L, "color", "#FFFFFFFF"), f(G, j), e(G, "width", "fill"), e(G, "height", 140), e(G, "background", "#FFFF9F0A"), e(G, "cornerRadius", 12), e(G, "padding", 20), e(j, "label", "Page 3"), e(j, "fontSize", 16), e(j, "fontWeight", 800), e(j, "color", "#FFFFFFFF"), z((J) => e(s, "activeTab", b(), J)), r;
          })(), (() => {
            var r = o("row"), s = o("button"), c = o("button");
            return f(r, s), f(r, c), e(r, "gap", 8), e(s, "label", "\u25C0 Prev"), e(s, "onClick", () => v(Math.max(0, b() - 1))), e(c, "label", "Next \u25B6"), e(c, "onClick", () => v(Math.min(2, b() + 1))), r;
          })(), (() => {
            var r = o("text");
            return e(r, "fontSize", 11), e(r, "color", "#FF8E8E93"), z((s) => e(r, "label", `page ${b() + 1} of 3 \u2014 swipe or use the buttons`, s)), r;
          })()];
        } }), U), A(M, O(V, { title: "Pull-to-refresh + swipe-to-dismiss", get children() {
          return [(() => {
            var r = o("box"), s = o("listView");
            return f(r, s), e(r, "height", 210), e(r, "borderWidth", 1), e(r, "borderColor", "#FFE5E5EA"), e(r, "cornerRadius", 8), e(s, "onRefresh", async () => {
              await new Promise((c) => setTimeout(c, 900)), B([`Fresh item ${++S}`, ...I()]);
            }), A(s, O(Q, { get each() {
              return I();
            }, children: (c) => (() => {
              var d = o("dismissible"), w = o("box"), L = o("text");
              return f(d, w), e(d, "onDismiss", () => B(I().filter((G) => G !== c))), f(w, L), e(w, "width", "fill"), e(w, "background", "#FFEFEFF4"), e(w, "cornerRadius", 8), e(w, "padding", 14), e(L, "label", c), e(L, "fontSize", 13), e(L, "color", "#FF1C1C1E"), d;
            })() })), r;
          })(), (() => {
            var r = o("text");
            return e(r, "label", "Pull the list down to refresh (a 900ms async task \u2014 the spinner waits for it); swipe any row sideways to dismiss it."), e(r, "fontSize", 11), e(r, "color", "#FF8E8E93"), r;
          })()];
        } }), U), A(M, O(V, { title: "Slivers \u2014 collapsing header (CustomScrollView)", get children() {
          return [(() => {
            var r = o("box"), s = o("customScrollView"), c = o("sliverAppBar"), d = o("box"), w = o("text"), L = o("sliverList"), G = o("sliverGrid");
            return f(r, s), e(r, "height", 340), e(r, "borderWidth", 1), e(r, "borderColor", "#FFE5E5EA"), e(r, "cornerRadius", 8), f(s, c), f(s, L), f(s, G), f(c, d), e(c, "title", "Collapsing header"), e(c, "height", 170), e(c, "sliverMode", "pinned"), e(c, "background", "#FF0A84FF"), f(d, w), e(d, "width", "fill"), e(d, "height", 170), e(d, "background", "#FF5E5CE6"), e(d, "padding", 20), e(w, "label", "Parallax background"), e(w, "fontSize", 18), e(w, "fontWeight", 800), e(w, "color", "#FFFFFFFF"), A(L, O(Q, { each: ["One", "Two", "Three", "Four", "Five"], children: (j) => (() => {
              var J = o("box"), se = o("text");
              return f(J, se), e(J, "width", "fill"), e(J, "background", "#FFFFFFFF"), e(J, "padding", 16), e(J, "borderWidth", 1), e(J, "borderColor", "#FFE5E5EA"), e(se, "label", `Row ${j}`), e(se, "fontSize", 14), e(se, "color", "#FF1C1C1E"), J;
            })() })), e(G, "crossAxisCount", 3), e(G, "aspectRatio", 1), e(G, "gap", 8), A(G, O(Q, { each: [ge, Te, We, Ve, gt, ge, Te, We, Ve], children: (j) => (() => {
              var J = o("box");
              return e(J, "background", j), e(J, "cornerRadius", 10), J;
            })() })), r;
          })(), (() => {
            var r = o("text");
            return e(r, "label", "Scroll the panel up \u2014 the purple header collapses into a pinned blue bar. The SliverList builds rows lazily; non-sliver children would auto-wrap in a SliverToBoxAdapter."), e(r, "fontSize", 11), e(r, "color", "#FF8E8E93"), r;
          })()];
        } }), U), A(M, O(V, { title: "Canvas \u2014 CustomPaint 2-D drawing", get children() {
          return [(() => {
            var r = o("box"), s = o("canvas");
            return f(r, s), e(r, "background", "#FFFFFFFF"), e(r, "cornerRadius", 12), e(r, "borderWidth", 1), e(r, "borderColor", "#FFE5E5EA"), e(r, "padding", 10), e(s, "width", 300), e(s, "height", 170), e(s, "draw", (c) => {
              c.strokeStyle(Pi).lineWidth(2).beginPath().moveTo(16, 150).lineTo(284, 150).stroke(), [50, 95, 70, y() + 10, 80].forEach((d, w) => {
                c.fillStyle(w === 3 ? ge : Ve).fillRect(28 + w * 52, 150 - d, 34, d);
              }), c.fillStyle(Te).beginPath().circle(252, 44, 22).fill(), c.fillStyle(kr).fontSize(12).fillText("bars \xB7 circle \xB7 path \xB7 text", 18, 22), E().forEach((d) => {
                c.fillStyle(d.color).beginPath().circle(d.x, d.y, d.r).fill();
              });
            }), r;
          })(), (() => {
            var r = o("row"), s = o("button"), c = o("button");
            return f(r, s), f(r, c), e(r, "gap", 8), e(s, "label", "Draw a shape"), e(s, "onClick", () => a([...E(), { x: 24 + Math.random() * 252, y: 16 + Math.random() * 120, r: 8 + Math.random() * 20, color: [ge, Te, We, gt, Ve][Math.floor(Math.random() * 5)] }])), e(c, "label", "Clear"), e(c, "onClick", () => a([])), r;
          })(), (() => {
            var r = o("text");
            return e(r, "label", "Bars, a circle, a stroked path, text. The 4th bar tracks the Controls slider; the buttons append/clear circles \u2014 each click flips the canvasShapes signal, so the draw callback re-records and the host repaints. Static drawings cross the bridge exactly once."), e(r, "fontSize", 11), e(r, "color", "#FF8E8E93"), r;
          })()];
        } }), U), A(M, O(V, { title: "Drag-and-drop \u2014 DragItem onto DropZone", get children() {
          return [(() => {
            var r = o("row");
            return e(r, "gap", 8), A(r, O(Q, { each: ["Apple", "Banana", "Cherry"], children: (s) => (() => {
              var c = o("dragItem"), d = o("box"), w = o("text");
              return f(c, d), e(c, "dragData", s), f(d, w), e(d, "background", "#FF5E5CE6"), e(d, "cornerRadius", 20), e(d, "padding", 12), e(w, "label", s), e(w, "fontSize", 13), e(w, "color", "#FFFFFFFF"), c;
            })() })), r;
          })(), (() => {
            var r = o("dropZone"), s = o("box"), c = o("text");
            return f(r, s), e(r, "onDrop", (d) => F([...h(), d])), f(s, c), e(s, "width", "fill"), e(s, "height", 90), e(s, "background", "#FFEFEFF4"), e(s, "cornerRadius", 12), e(s, "padding", 16), e(c, "fontSize", 13), e(c, "color", "#FF1C1C1E"), z((d) => e(c, "label", h().length ? `Basket: ${h().join(", ")}` : "Drag a chip into this zone", d)), r;
          })(), (() => {
            var r = o("row"), s = o("button");
            return f(r, s), e(r, "gap", 8), e(s, "label", "Clear basket"), e(s, "onClick", () => F([])), r;
          })(), (() => {
            var r = o("text");
            return e(r, "label", "Drag a fruit chip onto the zone \u2014 it highlights host-side while you hover; on release onDrop fires with the chip's dragData string. The whole drag is host-side; only the drop crosses the bridge."), e(r, "fontSize", 11), e(r, "color", "#FF8E8E93"), r;
          })()];
        } }), U), A(M, O(V, { title: "More controls \u2014 radio \xB7 chip \xB7 segmented \xB7 accordion", get children() {
          return [(() => {
            var r = o("row");
            return e(r, "gap", 16), A(r, O(Q, { each: ["S", "M", "L"], children: (s) => (() => {
              var c = o("row"), d = o("radio"), w = o("text");
              return f(c, d), f(c, w), e(c, "gap", 2), e(d, "onChange", () => P(s)), e(w, "label", s), e(w, "fontSize", 13), e(w, "color", "#FF1C1C1E"), z((L) => e(d, "checked", R() === s, L)), c;
            })() })), r;
          })(), (() => {
            var r = o("row");
            return e(r, "gap", 8), A(r, O(Q, { each: ["Red", "Green", "Blue"], children: (s) => (() => {
              var c = o("chip");
              return e(c, "label", s), e(c, "onChange", (d) => te(d ? [...D(), s] : D().filter((w) => w !== s))), z((d) => e(c, "checked", D().includes(s), d)), c;
            })() })), r;
          })(), (() => {
            var r = o("segmentedButton"), s = o("text"), c = o("text"), d = o("text");
            return f(r, s), f(r, c), f(r, d), e(r, "onChange", (w) => le(w)), e(s, "label", "Day"), e(s, "fontSize", 13), e(c, "label", "Week"), e(c, "fontSize", 13), e(d, "label", "Month"), e(d, "fontSize", 13), z((w) => e(r, "activeTab", Z(), w)), r;
          })(), (() => {
            var r = o("row"), s = o("text"), c = o("dropdown"), d = o("text"), w = o("text"), L = o("text");
            return f(r, s), f(r, c), e(r, "gap", 8), e(s, "label", "Priority"), e(s, "fontSize", 13), e(s, "color", "#FF1C1C1E"), f(c, d), f(c, w), f(c, L), e(c, "onChange", (G) => Gt(G)), e(d, "label", "Low"), e(d, "fontSize", 13), e(w, "label", "Medium"), e(w, "fontSize", 13), e(L, "label", "High"), e(L, "fontSize", 13), z((G) => e(c, "activeTab", qe(), G)), r;
          })(), (() => {
            var r = o("box"), s = o("expansionTile"), c = o("box"), d = o("text");
            return f(r, s), e(r, "background", "#FFFFFFFF"), e(r, "cornerRadius", 8), e(r, "borderWidth", 1), e(r, "borderColor", "#FFE5E5EA"), f(s, c), e(s, "title", "Details"), e(s, "onChange", (w) => je(w)), f(c, d), e(c, "padding", 14), e(c, "background", "#FFEFEFF4"), e(d, "label", "Body content revealed by the accordion \u2014 host-owned open state, host-side expand animation."), e(d, "fontSize", 12), e(d, "color", "#FF8E8E93"), r;
          })(), (() => {
            var r = o("text");
            return e(r, "fontSize", 11), e(r, "color", "#FF8E8E93"), z((s) => e(r, "label", `size ${R()} \xB7 chips ${D().join("/") || "\u2014"} \xB7 segment ${["Day", "Week", "Month"][Z()]} \xB7 priority ${["Low", "Medium", "High"][qe()]} \xB7 details ${Fe() ? "open" : "closed"}`, s)), r;
          })()];
        } }), U), A(M, O(V, { title: "Stepper \u2014 multi-step flow", get children() {
          return [(() => {
            var r = o("stepper"), s = o("step"), c = o("text"), d = o("step"), w = o("text"), L = o("step"), G = o("text");
            return f(r, s), f(r, d), f(r, L), e(r, "onChange", (j) => Vi(j)), f(s, c), e(s, "title", "Account"), e(c, "label", "Create your account \u2014 name, email, password."), e(c, "fontSize", 12), e(c, "color", "#FF8E8E93"), f(d, w), e(d, "title", "Profile"), e(w, "label", "Add a photo and a short bio."), e(w, "fontSize", 12), e(w, "color", "#FF8E8E93"), f(L, G), e(L, "title", "Done"), e(G, "label", "All set \u2014 review and finish."), e(G, "fontSize", 12), e(G, "color", "#FF8E8E93"), z((j) => e(r, "activeTab", Lr(), j)), r;
          })(), (() => {
            var r = o("text");
            return e(r, "fontSize", 11), e(r, "color", "#FF8E8E93"), z((s) => e(r, "label", `current step: ${Lr() + 1} of 3`, s)), r;
          })()];
        } }), U), A(M, O(V, { title: "BottomSheet \u2014 draggable / expandable", get children() {
          var r = o("box"), s = o("stack"), c = o("box"), d = o("text"), w = o("bottomSheet"), L = o("box"), G = o("text");
          return f(r, s), e(r, "height", 300), e(r, "cornerRadius", 12), e(r, "background", "#FFEFEFF4"), f(s, c), f(s, w), f(c, d), e(c, "width", "fill"), e(c, "height", "fill"), e(c, "padding", 16), e(d, "label", "A DraggableScrollableSheet \u2014 drag the sheet up, or scroll its list past the edge to expand it."), e(d, "fontSize", 12), e(d, "color", "#FF8E8E93"), f(w, L), e(w, "initialSize", 0.4), e(w, "minSize", 0.18), e(w, "maxSize", 0.95), e(w, "background", "#FFFFFFFF"), f(L, G), e(L, "padding", 16), e(G, "label", "Sheet content \u2014 drag or scroll"), e(G, "fontSize", 15), e(G, "fontWeight", 700), e(G, "color", "#FF1C1C1E"), A(w, O(Q, { each: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta"], children: (j) => (() => {
            var J = o("box"), se = o("text");
            return f(J, se), e(J, "padding", 14), e(se, "label", j), e(se, "fontSize", 14), e(se, "color", "#FF1C1C1E"), J;
          })() }), null), r;
        } }), U), A(M, O(V, { title: "Effects \u2014 BackdropFilter \xB7 InteractiveViewer", get children() {
          return [(() => {
            var r = o("stack"), s = o("image"), c = o("box"), d = o("backdropFilter"), w = o("box");
            return f(r, s), f(r, c), e(s, "src", "https://picsum.photos/seed/skalblur/300/160"), e(s, "width", 300), e(s, "height", 160), e(s, "contentScale", 1), e(s, "cornerRadius", 10), f(c, d), e(c, "top", 0), e(c, "left", 150), e(c, "width", 150), e(c, "height", 160), f(d, w), e(d, "blurRadius", 12), e(w, "width", 150), e(w, "height", 160), e(w, "background", "#33FFFFFF"), r;
          })(), (() => {
            var r = o("text");
            return e(r, "label", "The right half is frosted by a BackdropFilter."), e(r, "fontSize", 11), e(r, "color", "#FF8E8E93"), r;
          })(), (() => {
            var r = o("box"), s = o("interactiveViewer"), c = o("image");
            return f(r, s), e(r, "height", 200), e(r, "cornerRadius", 12), e(r, "background", "#FFEFEFF4"), f(s, c), e(s, "minScale", 1), e(s, "maxScale", 4), e(c, "src", "https://picsum.photos/seed/skalzoom/320/200"), e(c, "width", 320), e(c, "height", 200), e(c, "contentScale", 1), r;
          })(), (() => {
            var r = o("text");
            return e(r, "label", "Pinch / scroll-wheel to zoom the image, drag to pan."), e(r, "fontSize", 11), e(r, "color", "#FF8E8E93"), r;
          })()];
        } }), U), A(M, O(V, { title: "Hover \u2014 onHover \xB7 semanticLabel", get children() {
          return [(() => {
            var r = o("box"), s = o("text");
            return f(r, s), e(r, "padding", 16), e(r, "cornerRadius", 10), e(r, "borderWidth", 1), e(r, "borderColor", "#FFE5E5EA"), e(r, "onHover", (c) => Bi(c)), e(r, "semanticLabel", "A hoverable demo card"), e(s, "fontSize", 14), z((c) => {
              var d = Ut() ? ge : Ti, w = Ut() ? "Hovering \u2014 pointer is over the card" : "Move the pointer over this card", L = Ut() ? "#FFFFFF" : kr;
              return d !== c.e && (c.e = e(r, "background", d, c.e)), w !== c.t && (c.t = e(s, "label", w, c.t)), L !== c.a && (c.a = e(s, "color", L, c.a)), c;
            }, { e: undefined, t: undefined, a: undefined }), r;
          })(), (() => {
            var r = o("text");
            return e(r, "label", "onHover fires on pointer enter/exit (desktop/web). semanticLabel wraps the card in a Semantics node for screen readers."), e(r, "fontSize", 11), e(r, "color", "#FF8E8E93"), r;
          })()];
        } }), U), A(M, O(V, { title: "Keyboard \u2014 onKey", get children() {
          return [(() => {
            var r = o("box"), s = o("text");
            return f(r, s), e(r, "padding", 16), e(r, "cornerRadius", 10), e(r, "background", "#FFFFFFFF"), e(r, "borderWidth", 1), e(r, "borderColor", "#FFE5E5EA"), e(r, "onKey", (c) => Hi(c)), e(s, "fontSize", 14), e(s, "color", "#FF1C1C1E"), z((c) => e(s, "label", `last key: ${Mi()}`, c)), r;
          })(), (() => {
            var r = o("text");
            return e(r, "label", "Click the card to focus it, then press keys (\u2318S, Escape, arrows). onKey reports a normalized combo string; build any shortcut layer on it."), e(r, "fontSize", 11), e(r, "color", "#FF8E8E93"), r;
          })()];
        } }), U), A(M, O(V, { title: "Gestures \u2014 onTap \xB7 onLongPress \xB7 onDoubleTap", get children() {
          return [(() => {
            var r = o("box"), s = o("text");
            return f(r, s), e(r, "background", "#FFEFEFF4"), e(r, "cornerRadius", 12), e(r, "padding", 22), e(r, "onTap", () => _("onTap")), e(r, "onLongPress", () => _("onLongPress")), e(r, "onDoubleTap", () => _("onDoubleTap")), e(s, "label", "Tap / long-press / double-tap this box"), e(s, "fontSize", 13), e(s, "color", "#FF1C1C1E"), r;
          })(), (() => {
            var r = o("text");
            return e(r, "fontSize", 12), e(r, "color", "#FF8E8E93"), z((s) => e(r, "label", `last gesture: ${N()}`, s)), r;
          })()];
        } }), U), A(M, O(V, { title: "Drag \u2014 draggable (zero per-frame bridge traffic)", get children() {
          return [(() => {
            var r = o("box"), s = o("box"), c = o("text");
            return f(r, s), e(r, "height", 150), e(r, "background", "#FFEFEFF4"), e(r, "cornerRadius", 12), f(s, c), e(s, "draggable", true), e(s, "width", 64), e(s, "height", 64), e(s, "background", "#FF0A84FF"), e(s, "cornerRadius", 14), e(s, "onPanEnd", (d, w) => Ui(`${d.toFixed(0)}, ${w.toFixed(0)}`)), e(c, "label", "drag"), e(c, "fontSize", 12), e(c, "color", "#FFFFFFFF"), r;
          })(), (() => {
            var r = o("text");
            return e(r, "fontSize", 11), e(r, "color", "#FF8E8E93"), z((s) => e(r, "label", `Drag the blue box \u2014 the host moves it itself, no event per frame. Resting offset: ${Gi()}`, s)), r;
          })()];
        } }), U), A(M, O(V, { title: "Pan \u2014 onPanUpdate delta stream", get children() {
          return [(() => {
            var r = o("box"), s = o("text");
            return f(r, s), e(r, "height", 70), e(r, "background", "#FFEFEFF4"), e(r, "cornerRadius", 12), e(r, "padding", 16), e(r, "onPanStart", () => Xt("drag started")), e(r, "onPanUpdate", (c, d) => Xt(`dx ${c.toFixed(1)}  dy ${d.toFixed(1)}`)), e(r, "onPanEnd", (c, d) => Xt(`fling v ${c.toFixed(0)}, ${d.toFixed(0)} dp/s`)), e(s, "label", "Drag anywhere on this strip"), e(s, "fontSize", 13), e(s, "color", "#FF1C1C1E"), r;
          })(), (() => {
            var r = o("text");
            return e(r, "fontSize", 11), e(r, "color", "#FF8E8E93"), z((s) => e(r, "label", `onPanUpdate: ${Xi()}`, s)), r;
          })()];
        } }), U), A(M, O(V, { title: "Scale \u2014 onScaleUpdate (pinch / rotate)", get children() {
          return [(() => {
            var r = o("box"), s = o("box"), c = o("text");
            return f(r, s), e(r, "height", 170), e(r, "background", "#FFEFEFF4"), e(r, "cornerRadius", 12), f(s, c), e(s, "width", 96), e(s, "height", 96), e(s, "background", "#FF5E5CE6"), e(s, "cornerRadius", 16), e(s, "onScaleStart", () => {
              Wr = Ft();
            }), e(s, "onScaleUpdate", (d) => Yi(Math.max(0.3, Wr * d))), e(c, "label", "pinch"), e(c, "fontSize", 13), e(c, "color", "#FFFFFFFF"), z((d) => {
              var w = Ft(), L = Ft();
              return w !== d.e && (d.e = e(s, "scaleX", w, d.e)), L !== d.t && (d.t = e(s, "scaleY", L, d.t)), d;
            }, { e: undefined, t: undefined }), r;
          })(), (() => {
            var r = o("text");
            return e(r, "fontSize", 11), e(r, "color", "#FF8E8E93"), z((s) => e(r, "label", `Pinch the purple box (two pointers / trackpad). Scale \xD7${Ft().toFixed(2)}`, s)), r;
          })()];
        } }), U), A(M, O(V, { title: "Dialogs \u2014 imperative JS API", get children() {
          return [(() => {
            var r = o("row"), s = o("button"), c = o("button");
            return f(r, s), f(r, c), e(r, "gap", 8), e(s, "label", "Alert"), e(s, "onClick", async () => {
              await Sr({ title: "Heads up", message: "A plain alert dialog.", actions: [{ label: "OK", value: "ok" }] }), _t("alert: dismissed");
            }), e(c, "label", "Confirm"), e(c, "onClick", async () => {
              _t(`confirm \u2192 ${await Sr({ title: "Delete file?", message: "This cannot be undone.", actions: [{ label: "Cancel", value: "cancel" }, { label: "Delete", value: "delete", style: "destructive" }] }) ?? "dismissed"}`);
            }), r;
          })(), (() => {
            var r = o("row"), s = o("button"), c = o("button");
            return f(r, s), f(r, c), e(r, "gap", 8), e(s, "label", "Action sheet"), e(s, "onClick", async () => {
              _t(`sheet \u2192 ${await jn({ title: "Choose an action", actions: [{ label: "Copy", value: "copy" }, { label: "Share", value: "share" }, { label: "Delete", value: "delete", style: "destructive" }] }) ?? "cancelled"}`);
            }), e(c, "label", "Snackbar"), e(c, "onClick", () => {
              wr("Hello from a snackbar \uD83D\uDC4B"), _t("snackbar: shown");
            }), r;
          })(), (() => {
            var r = o("text");
            return e(r, "fontSize", 12), e(r, "color", "#FF8E8E93"), z((s) => e(r, "label", Ki(), s)), r;
          })()];
        } }), U), A(M, O(V, { title: "Pickers \u2014 date \xB7 time", get children() {
          return [(() => {
            var r = o("row"), s = o("button"), c = o("button");
            return f(r, s), f(r, c), e(r, "gap", 8), e(s, "label", "Pick a date"), e(s, "onClick", async () => {
              Vr(`date \u2192 ${await qn({ initialDate: "2026-05-17" }) ?? "dismissed"}`);
            }), e(c, "label", "Pick a time"), e(c, "onClick", async () => {
              Vr(`time \u2192 ${await Zn({ initialHour: 9, initialMinute: 30 }) ?? "dismissed"}`);
            }), r;
          })(), (() => {
            var r = o("text");
            return e(r, "fontSize", 12), e(r, "color", "#FF8E8E93"), z((s) => e(r, "label", Ji(), s)), r;
          })()];
        } }), U), A(M, O(V, { title: "Navigation \u2014 push / pop with keep-alive", get children() {
          return [(() => {
            var r = o("text");
            return e(r, "label", "Tap a mailbox to push a screen; the AppBar back button (or system back) pops. Native transition; the screen behind stays mounted."), e(r, "fontSize", 11), e(r, "color", "#FF8E8E93"), r;
          })(), (() => {
            var r = o("box");
            return e(r, "height", 320), e(r, "borderWidth", 1), e(r, "borderColor", "#FFE5E5EA"), A(r, O(qi.View, {})), r;
          })()];
        } }), U), A(M, O(V, { title: "Tabs \u2014 bottom bar with keep-alive", get children() {
          return [(() => {
            var r = o("text");
            return e(r, "label", "Every tab subtree is built once and kept alive (IndexedStack) \u2014 switching never re-mounts; scroll & state survive."), e(r, "fontSize", 11), e(r, "color", "#FF8E8E93"), r;
          })(), (() => {
            var r = o("box"), s = o("tabs"), c = o("tab"), d = o("column"), w = o("text"), L = o("text"), G = o("tab"), j = o("column"), J = o("text"), se = o("textInput"), vt = o("tab"), Pe = o("column"), Qe = o("text"), Et = o("text");
            return f(r, s), e(r, "height", 280), e(r, "borderWidth", 1), e(r, "borderColor", "#FFE5E5EA"), e(r, "cornerRadius", 8), f(s, c), f(s, G), f(s, vt), e(s, "onChange", Zi), e(s, "height", "fill"), f(c, d), e(c, "title", "Home"), e(c, "icon", "home"), f(d, w), f(d, L), e(d, "background", "#FFF2F2F7"), e(d, "padding", 16), e(d, "gap", 8), e(d, "height", "fill"), e(w, "label", "Home"), e(w, "fontSize", 20), e(w, "fontWeight", 800), e(w, "color", "#FF1C1C1E"), e(L, "label", "Switch tabs and come back \u2014 this tab was never torn down."), e(L, "fontSize", 13), e(L, "color", "#FF8E8E93"), f(G, j), e(G, "title", "Search"), e(G, "icon", "search"), f(j, J), f(j, se), e(j, "background", "#FFF2F2F7"), e(j, "padding", 16), e(j, "gap", 8), e(j, "height", "fill"), e(J, "label", "Search"), e(J, "fontSize", 20), e(J, "fontWeight", 800), e(J, "color", "#FF1C1C1E"), e(se, "placeholder", "Type to search\u2026"), f(vt, Pe), e(vt, "title", "Profile"), e(vt, "icon", "person"), f(Pe, Qe), f(Pe, Et), e(Pe, "background", "#FFF2F2F7"), e(Pe, "padding", 16), e(Pe, "gap", 8), e(Pe, "height", "fill"), e(Qe, "label", "Profile"), e(Qe, "fontSize", 20), e(Qe, "fontWeight", 800), e(Qe, "color", "#FF1C1C1E"), e(Et, "fontSize", 13), e(Et, "color", "#FF8E8E93"), z((xe) => {
              var Hr = Mr(), Gr = `active tab index: ${Mr()}`;
              return Hr !== xe.e && (xe.e = e(s, "activeTab", Hr, xe.e)), Gr !== xe.t && (xe.t = e(Et, "label", Gr, xe.t)), xe;
            }, { e: undefined, t: undefined }), r;
          })()];
        } }), U), A(M, O(V, { title: "SafeArea", get children() {
          var r = o("safeArea"), s = o("box"), c = o("text");
          return f(r, s), f(s, c), e(s, "background", "#FFEFEFF4"), e(s, "cornerRadius", 8), e(s, "padding", 14), e(c, "label", "Insets past notches & system bars. (No visible effect here \u2014 the app root already applies one.)"), e(c, "fontSize", 12), e(c, "color", "#FF1C1C1E"), r;
        } }), U), e(U, "label", "\u2014 end of UI demo \u2014"), e(U, "fontSize", 12), e(U, "color", "#FF8E8E93"), M;
      })();
    }
    return O(Qi.View, {});
  }
  var Ir = ["Just shipped a new feature, feeling great about how it turned out \uD83D\uDE80", "Hot take: the best APIs are the ones you don't have to read docs for", "Spent the morning refactoring legacy code \u2014 so much cleaner now", "There's no such thing as 'just a small change' in production code", "If your tests are slow, that's a smell. Fast tests = good tests", "Bun's startup time keeps surprising me, even after a year", "Why is naming things still the hardest part of programming?", "Found a 10\xD7 speedup in a critical path today. Profilers, not guesses", "Reading 'The Art of Unix Programming' for the third time", "Premature abstraction is somehow worse than premature optimization", "Latency is a feature, throughput is an artifact of how you measure", "Half of debugging is admitting your assumption was wrong", "You don't ship the codebase you have. You ship the codebase you understand", "Cache invalidation, naming things, off-by-one. The classics", "Every config file format eventually grows a turing-complete templating layer"], yi = Array.from({ length: 15000 }, (t, n) => ({ author: `@user${n * 2654435761 >>> 17}`, body: Ir[n % Ir.length], num: n + 1 })), ki = [50, 200, 500, 1000, 2000, 5000, 1e4], Nr = "#FFF1F5F9", Dr = "#FF475569", Ii = "#FF22C55E", Ni = "#FFEF4444", zr = "#FFFFFFFF";
  function Di(t) {
    const [n, i] = W(0), [l, u] = W(false), [g, m] = W(0), [p, y] = W(false);
    return (() => {
      var C = o("column"), x = o("text"), T = o("text"), N = o("row"), _ = o("button"), b = o("button");
      return f(C, x), f(C, T), f(C, N), e(C, "background", "#FFFFFFFF"), e(C, "padding", 12), e(C, "cornerRadius", 10), e(C, "borderWidth", 1), e(C, "borderColor", "#FFE5E5EA"), e(C, "gap", 6), e(x, "fontWeight", 700), e(x, "fontSize", 14), e(x, "color", "#FF1DA1F2"), e(T, "fontSize", 14), e(T, "color", "#FF1F2937"), e(T, "maxLines", 3), e(T, "textOverflow", 1), f(N, _), f(N, b), e(N, "gap", 10), e(_, "fontSize", 12), e(_, "padding", 6), e(_, "cornerRadius", 16), e(_, "onClick", () => {
        const v = !l();
        u(v), i(n() + (v ? 1 : -1));
      }), e(b, "fontSize", 12), e(b, "padding", 6), e(b, "cornerRadius", 16), e(b, "onClick", () => {
        const v = !p();
        y(v), m(g() + (v ? 1 : -1));
      }), z((v) => {
        var I = `#${t.num} \xB7 ${t.author}`, B = t.body, S = `\u2665 ${n()}`, E = l() ? Ii : Nr, a = l() ? zr : Dr, h = `\u21A9 ${g()}`, F = p() ? Ni : Nr, R = p() ? zr : Dr;
        return I !== v.e && (v.e = e(x, "label", I, v.e)), B !== v.t && (v.t = e(T, "label", B, v.t)), S !== v.a && (v.a = e(_, "label", S, v.a)), E !== v.o && (v.o = e(_, "background", E, v.o)), a !== v.i && (v.i = e(_, "color", a, v.i)), h !== v.n && (v.n = e(b, "label", h, v.n)), F !== v.s && (v.s = e(b, "background", F, v.s)), R !== v.h && (v.h = e(b, "color", R, v.h)), v;
      }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined, n: undefined, s: undefined, h: undefined }), C;
    })();
  }
  function zi() {
    const [t, n] = W(50), [i, l] = W(""), u = nt(() => yi.slice(0, t()));
    return (() => {
      var g = o("listView"), m = o("text"), p = o("text"), y = o("wrap"), C = o("text");
      return f(g, m), f(g, p), f(g, y), f(g, C), e(g, "background", "#FFF2F2F7"), e(g, "padding", 16), e(g, "gap", 12), e(m, "label", "Tweet feed \u2014 virtualized"), e(m, "fontSize", 24), e(m, "fontWeight", 800), e(m, "color", "#FF1C1C1E"), e(p, "label", "ListView.builder materializes only the visible window; the source pool is 15 000 items. Tap a count to mount N."), e(p, "fontSize", 13), e(p, "color", "#FF8E8E93"), e(y, "gap", 6), A(y, O(Q, { each: ki, children: (x) => (() => {
        var T = o("button");
        return e(T, "label", `${x}`), e(T, "onClick", () => {
          const N = performance.now();
          try {
            n(x), l(`mounted ${x} in ${(performance.now() - N).toFixed(2)} ms`);
          } catch (_) {
            l(`ERROR @ ${x}: ${_ && (_.message || String(_)) || "unknown"}`);
          }
        }), T;
      })() })), e(C, "fontSize", 12), e(C, "color", "#FF8E8E93"), A(g, O(Q, { get each() {
        return u();
      }, children: (x) => O(Di, { get author() {
        return x.author;
      }, get body() {
        return x.body;
      }, get num() {
        return x.num;
      } }) }), null), z((x) => e(C, "label", i() || `showing ${t()} tweets`, x)), g;
    })();
  }
  function Li() {
    const [t, n] = W("\u2014 waiting for counter events \u2014"), i = Ri(), [l, u] = W("\u2014 tap a button to RPC the Ticker \u2014"), [g, m] = W(null), [p, y] = W(false);
    return (() => {
      var C = o("scrollView"), x = o("text"), T = o("text"), N = o("text");
      return f(C, x), f(C, T), f(C, N), e(C, "background", "#FFF2F2F7"), e(C, "padding", 16), e(C, "gap", 14), e(x, "label", "Libraries \u2014 codegen-wrapped widgets"), e(x, "fontSize", 24), e(x, "fontWeight", 800), e(x, "color", "#FF1C1C1E"), e(T, "label", "Custom adapters + real pub.dev packages, brought into JSX by skal_codegen. Imported from 'skal-flutter'."), e(T, "fontSize", 13), e(T, "color", "#FF8E8E93"), A(C, O(V, { title: "Greeting \u2014 hand-written adapter", get children() {
        var _ = o("greeting");
        return e(_, "name", "Skal"), e(_, "color", "#FF1DA1F2"), e(_, "fontSize", 20), _;
      } }), N), A(C, O(V, { title: "Shimmer \u2014 pub.dev, named-ctor wrap", get children() {
        return [(() => {
          var _ = o("text");
          return e(_, "label", "ShimmerFromColors \u2014 codegen-synthesized from the Shimmer.fromColors named constructor."), e(_, "fontSize", 11), e(_, "color", "#FF8E8E93"), _;
        })(), (() => {
          var _ = o("shimmerFromColors"), b = o("greeting");
          return f(_, b), e(_, "baseColor", 4290624957), e(_, "highlightColor", 4292927712), e(_, "period", 1500), e(b, "name", "loading\u2026"), e(b, "color", "#FF333333"), e(b, "fontSize", 28), _;
        })()];
      } }), N), A(C, O(V, { title: "QR code \u2014 qr_flutter, pub.dev wrap", get children() {
        return [(() => {
          var _ = o("qrImageView");
          return e(_, "data", "https://skal.dev"), e(_, "size", 200), _;
        })(), (() => {
          var _ = o("text");
          return e(_, "label", "QrImageView, generated against qr_flutter's class."), e(_, "fontSize", 11), e(_, "color", "#FF8E8E93"), _;
        })()];
      } }), N), A(C, O(V, { title: "Camera \u2014 host-pattern wrap (controller lifecycle)", get children() {
        return [(() => {
          var _ = o("text");
          return e(_, "label", "A synthesized _CameraHost owns the CameraController (init in initState, dispose on unmount). The controller initializes only once Start mounts <Camera> \u2014 no camera / permission \u2192 an inline error banner."), e(_, "fontSize", 11), e(_, "color", "#FF8E8E93"), _;
        })(), (() => {
          var _ = o("button");
          return e(_, "onClick", () => y(!p())), z((b) => e(_, "label", p() ? "Stop camera" : "Start camera", b)), _;
        })(), Mt(() => Mt(() => !!p())() && (() => {
          var _ = o("box"), b = o("camera");
          return f(_, b), e(_, "background", "#FF000000"), e(_, "padding", 4), e(_, "cornerRadius", 8), e(b, "resolutionIndex", 1), _;
        })())];
      } }), N), A(C, O(V, { title: "Counter \u2014 typed callbacks back to JSX", get children() {
        return [(() => {
          var _ = o("counter");
          return e(_, "initial", 0), e(_, "onChanged", (b) => n(`onChanged(${b})`)), e(_, "onReset", () => n("onReset()")), _;
        })(), (() => {
          var _ = o("text");
          return e(_, "fontSize", 13), e(_, "color", "#FF1C1C1E"), z((b) => e(_, "label", t(), b)), _;
        })()];
      } }), N), A(C, O(V, { title: "Ticker \u2014 JS \u2192 Dart imperative RPC", get children() {
        return [(() => {
          var _ = o("ticker");
          return wi(i, _), e(_, "intervalMs", 500), _;
        })(), (() => {
          var _ = o("wrap"), b = o("button"), v = o("button"), I = o("button"), B = o("button"), S = o("button"), E = o("button"), a = o("button"), h = o("button");
          return f(_, b), f(_, v), f(_, I), f(_, B), f(_, S), f(_, E), f(_, a), f(_, h), e(_, "gap", 6), e(b, "label", "pause"), e(b, "onClick", async () => {
            await i.pause(), u("pause() \u2713");
          }), e(v, "label", "resume"), e(v, "onClick", async () => {
            await i.resume(), u("resume() \u2713");
          }), e(I, "label", "reset"), e(I, "onClick", async () => {
            await i.reset(), u("reset() \u2713");
          }), e(B, "label", "+10"), e(B, "onClick", async () => {
            await i.bump(10), u(`bump(10), now getValue() \u2192 ${await i.getValue()}`);
          }), e(S, "label", "read"), e(S, "onClick", async () => {
            u(`getValue() \u2192 ${await i.getValue()}, isPaused() \u2192 ${await i.isPaused()}`);
          }), e(E, "label", "describe"), e(E, "onClick", async () => {
            u(`describe() \u2192 ${await i.describe("hello from JSX")}`);
          }), e(a, "label", "snapshot"), e(a, "onClick", async () => {
            const F = await i.snapshot();
            u(`snapshot() \u2192 value=${F.value} paused=${F.paused} ts=${F.timestamp}`);
          }), e(h, "label", "sub/unsub"), e(h, "onClick", () => {
            if (g())
              g()(), m(() => null), u("unsubscribed from ticks$");
            else {
              const F = i.ticks$((R) => {
                u(`stream tick: ${R}`);
              });
              m(() => F), u("subscribed to ticks$ \u2014 wait for emissions\u2026");
            }
          }), _;
        })(), (() => {
          var _ = o("text");
          return e(_, "fontSize", 13), e(_, "color", "#FF1C1C1E"), z((b) => e(_, "label", l(), b)), _;
        })()];
      } }), N), A(C, O(V, { title: "Stickers \u2014 List<Widget> children + gradient prop", get children() {
        var _ = o("stickers"), b = o("greeting"), v = o("greeting"), I = o("greeting");
        return f(_, b), f(_, v), f(_, I), e(_, "gap", 6), e(_, "padding", 10), e(_, "gradient", { type: "linear", colors: ["#FFFFE082", "#FFB0F0D0", "#FFB0E0FF"], stops: [0, 0.5, 1], begin: "topLeft", end: "bottomRight" }), e(b, "name", "multi-child A"), e(b, "color", "#FF6B4F00"), e(b, "fontSize", 14), e(v, "name", "multi-child B"), e(v, "color", "#FF6B4F00"), e(v, "fontSize", 14), e(I, "name", "multi-child C"), e(I, "color", "#FF6B4F00"), e(I, "fontSize", 14), _;
      } }), N), e(N, "label", "\u2014 end of Libs demo \u2014"), e(N, "fontSize", 12), e(N, "color", "#FF8E8E93"), C;
    })();
  }
  function Wi() {
    const [t, n] = W(0);
    return (() => {
      var i = o("tabs"), l = o("tab"), u = o("tab"), g = o("tab");
      return f(i, l), f(i, u), f(i, g), e(i, "onChange", n), e(i, "height", "fill"), e(l, "title", "UI"), e(l, "icon", "grid"), A(l, O(Ai, {})), e(u, "title", "List"), e(u, "icon", "list"), A(u, O(zi, {})), e(g, "title", "Libs"), e(g, "icon", "explore"), A(g, O(Li, {})), z((m) => e(i, "activeTab", t(), m)), i;
    })();
  }
  Si(() => O(Wi, {}), mi);
})();
})
