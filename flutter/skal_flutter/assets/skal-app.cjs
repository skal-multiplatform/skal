// @bun @bytecode @bun-cjs
(function(exports, require, module, __filename, __dirname) {// ../flutter/skal_flutter/assets/skal-app.js
(function() {
  var ee = { context: undefined, registry: undefined, effects: undefined, done: false, getContextId() {
    return Yt(this.context.count);
  }, getNextContextId() {
    return Yt(this.context.count++);
  } };
  function Yt(t) {
    const r = String(t), i = r.length - 1;
    return ee.context.id + (i ? String.fromCharCode(96 + i) : "") + r;
  }
  function pt(t) {
    ee.context = t;
  }
  function Hr() {
    return { ...ee.context, id: ee.getNextContextId(), count: 0 };
  }
  var Gr = (t, r) => t === r, St = Symbol("solid-proxy"), Ur = typeof Proxy == "function", Xr = Symbol("solid-track"), et = { equals: Gr }, Jt = null, jt = nr, ae = 1, Be = 2, qt = { owned: null, cleanups: null, context: null, owner: null }, U = null, $ = null, Me = null, Ce = null, J = null, K = null, re = null, tt = 0;
  function rt(t, r) {
    const i = J, l = U, c = t.length === 0, h = r === undefined ? l : r, w = c ? qt : { owned: null, cleanups: null, context: h ? h.context : null, owner: h }, p = c ? t : () => t(() => $e(() => _e(w)));
    U = w, J = null;
    try {
      return he(p, true);
    } finally {
      J = i, U = l;
    }
  }
  function L(t, r) {
    r = r ? Object.assign({}, et, r) : et;
    const i = { value: t, observers: null, observerSlots: null, comparator: r.equals || undefined }, l = (c) => (typeof c == "function" && ($ && $.running && $.sources.has(i) ? c = c(i.tValue) : c = c(i.value)), tr(i, c));
    return [er.bind(i), l];
  }
  function Fe(t, r, i) {
    const l = mt(t, r, false, ae);
    Me && $ && $.running ? K.push(l) : He(l);
  }
  function Kt(t, r, i) {
    jt = Kr;
    const l = mt(t, r, false, ae), c = wt && Jr(wt);
    c && (l.suspense = c), (!i || !i.render) && (l.user = true), re ? re.push(l) : He(l);
  }
  function nt(t, r, i) {
    i = i ? Object.assign({}, et, i) : et;
    const l = mt(t, r, true, 0);
    return l.observers = null, l.observerSlots = null, l.comparator = i.equals || undefined, Me && $ && $.running ? (l.tState = ae, K.push(l)) : He(l), er.bind(l);
  }
  function $e(t) {
    if (!Ce && J === null)
      return t();
    const r = J;
    J = null;
    try {
      return Ce ? Ce.untrack(t) : t();
    } finally {
      J = r;
    }
  }
  function Zt(t) {
    return U === null || (U.cleanups === null ? U.cleanups = [t] : U.cleanups.push(t)), t;
  }
  function Yr(t) {
    if ($ && $.running)
      return t(), $.done;
    const r = J, i = U;
    return Promise.resolve().then(() => {
      J = r, U = i;
      let l;
      return (Me || wt) && (l = $ || ($ = { sources: new Set, effects: [], promises: new Set, disposed: new Set, queue: new Set, running: true }), l.done || (l.done = new Promise((c) => l.resolve = c)), l.running = true), he(t, false), J = U = null, l ? l.done : undefined;
    });
  }
  var [qi, Qt] = L(false);
  function Jr(t) {
    let r;
    return U && U.context && (r = U.context[t.id]) !== undefined ? r : t.defaultValue;
  }
  var wt;
  function er() {
    const t = $ && $.running;
    if (this.sources && (t ? this.tState : this.state))
      if ((t ? this.tState : this.state) === ae)
        He(this);
      else {
        const r = K;
        K = null, he(() => it(this), false), K = r;
      }
    if (J) {
      const r = this.observers ? this.observers.length : 0;
      J.sources ? (J.sources.push(this), J.sourceSlots.push(r)) : (J.sources = [this], J.sourceSlots = [r]), this.observers ? (this.observers.push(J), this.observerSlots.push(J.sources.length - 1)) : (this.observers = [J], this.observerSlots = [J.sources.length - 1]);
    }
    return t && $.sources.has(this) ? this.tValue : this.value;
  }
  function tr(t, r, i) {
    let l = $ && $.running && $.sources.has(t) ? t.tValue : t.value;
    if (!t.comparator || !t.comparator(l, r)) {
      if ($) {
        const c = $.running;
        (c || !i && $.sources.has(t)) && ($.sources.add(t), t.tValue = r), c || (t.value = r);
      } else
        t.value = r;
      t.observers && t.observers.length && he(() => {
        for (let c = 0;c < t.observers.length; c += 1) {
          const h = t.observers[c], w = $ && $.running;
          w && $.disposed.has(h) || ((w ? !h.tState : !h.state) && (h.pure ? K.push(h) : re.push(h), h.observers && ir(h)), w ? h.tState = ae : h.state = ae);
        }
        if (K.length > 1e6)
          throw K = [], new Error;
      }, false);
    }
    return r;
  }
  function He(t) {
    if (!t.fn)
      return;
    _e(t);
    const r = tt;
    rr(t, $ && $.running && $.sources.has(t) ? t.tValue : t.value, r), $ && !$.running && $.sources.has(t) && queueMicrotask(() => {
      he(() => {
        $ && ($.running = true), J = U = t, rr(t, t.tValue, r), J = U = null;
      }, false);
    });
  }
  function rr(t, r, i) {
    let l;
    const c = U, h = J;
    J = U = t;
    try {
      l = t.fn(r);
    } catch (w) {
      return t.pure && ($ && $.running ? (t.tState = ae, t.tOwned && t.tOwned.forEach(_e), t.tOwned = undefined) : (t.state = ae, t.owned && t.owned.forEach(_e), t.owned = null)), t.updatedAt = i + 1, Rt(w);
    } finally {
      J = h, U = c;
    }
    (!t.updatedAt || t.updatedAt <= i) && (t.updatedAt != null && ("observers" in t) ? tr(t, l, true) : $ && $.running && t.pure ? ($.sources.has(t) || (t.value = l), $.sources.add(t), t.tValue = l) : t.value = l, t.updatedAt = i);
  }
  function mt(t, r, i, l = ae, c) {
    const h = { fn: t, state: l, updatedAt: null, owned: null, sources: null, sourceSlots: null, cleanups: null, value: r, owner: U, context: U ? U.context : null, pure: i };
    if ($ && $.running && (h.state = 0, h.tState = l), U === null || U !== qt && ($ && $.running && U.pure ? U.tOwned ? U.tOwned.push(h) : U.tOwned = [h] : U.owned ? U.owned.push(h) : U.owned = [h]), Ce && h.fn) {
      const w = h.fn, [p, A] = L(undefined, { equals: false }), C = Ce.factory(w, A);
      Zt(() => C.dispose());
      let x;
      const T = () => Yr(A).then(() => {
        x && (x.dispose(), x = undefined);
      });
      h.fn = (N) => (p(), $ && $.running ? (x || (x = Ce.factory(w, T)), x.track(N)) : C.track(N));
    }
    return h;
  }
  function Ge(t) {
    const r = $ && $.running;
    if ((r ? t.tState : t.state) === 0)
      return;
    if ((r ? t.tState : t.state) === Be)
      return it(t);
    if (t.suspense && $e(t.suspense.inFallback))
      return t.suspense.effects.push(t);
    const i = [t];
    for (;(t = t.owner) && (!t.updatedAt || t.updatedAt < tt); ) {
      if (r && $.disposed.has(t))
        return;
      (r ? t.tState : t.state) && i.push(t);
    }
    for (let l = i.length - 1;l >= 0; l--) {
      if (t = i[l], r) {
        let c = t, h = i[l + 1];
        for (;(c = c.owner) && c !== h; )
          if ($.disposed.has(c))
            return;
      }
      if ((r ? t.tState : t.state) === ae)
        He(t);
      else if ((r ? t.tState : t.state) === Be) {
        const c = K;
        K = null, he(() => it(t, i[0]), false), K = c;
      }
    }
  }
  function he(t, r) {
    if (K)
      return t();
    let i = false;
    r || (K = []), re ? i = true : re = [], tt++;
    try {
      const l = t();
      return jr(i), l;
    } catch (l) {
      i || (re = null), K = null, Rt(l);
    }
  }
  function jr(t) {
    if (K && (Me && $ && $.running ? qr(K) : nr(K), K = null), t)
      return;
    let r;
    if ($) {
      if (!$.promises.size && !$.queue.size) {
        const { sources: l, disposed: c } = $;
        re.push.apply(re, $.effects), r = $.resolve;
        for (const h of re)
          "tState" in h && (h.state = h.tState), delete h.tState;
        $ = null, he(() => {
          for (const h of c)
            _e(h);
          for (const h of l) {
            if (h.value = h.tValue, h.owned)
              for (let w = 0, p = h.owned.length;w < p; w++)
                _e(h.owned[w]);
            h.tOwned && (h.owned = h.tOwned), delete h.tValue, delete h.tOwned, h.tState = 0;
          }
          Qt(false);
        }, false);
      } else if ($.running) {
        $.running = false, $.effects.push.apply($.effects, re), re = null, Qt(true);
        return;
      }
    }
    const i = re;
    re = null, i.length && he(() => jt(i), false), r && r();
  }
  function nr(t) {
    for (let r = 0;r < t.length; r++)
      Ge(t[r]);
  }
  function qr(t) {
    for (let r = 0;r < t.length; r++) {
      const i = t[r], l = $.queue;
      l.has(i) || (l.add(i), Me(() => {
        l.delete(i), he(() => {
          $.running = true, Ge(i);
        }, false), $ && ($.running = false);
      }));
    }
  }
  function Kr(t) {
    let r, i = 0;
    for (r = 0;r < t.length; r++) {
      const l = t[r];
      l.user ? t[i++] = l : Ge(l);
    }
    if (ee.context) {
      if (ee.count) {
        ee.effects || (ee.effects = []), ee.effects.push(...t.slice(0, i));
        return;
      }
      pt();
    }
    for (ee.effects && (ee.done || !ee.count) && (t = [...ee.effects, ...t], i += ee.effects.length, delete ee.effects), r = 0;r < i; r++)
      Ge(t[r]);
  }
  function it(t, r) {
    const i = $ && $.running;
    i ? t.tState = 0 : t.state = 0;
    for (let l = 0;l < t.sources.length; l += 1) {
      const c = t.sources[l];
      if (c.sources) {
        const h = i ? c.tState : c.state;
        h === ae ? c !== r && (!c.updatedAt || c.updatedAt < tt) && Ge(c) : h === Be && it(c, r);
      }
    }
  }
  function ir(t) {
    const r = $ && $.running;
    for (let i = 0;i < t.observers.length; i += 1) {
      const l = t.observers[i];
      (r ? !l.tState : !l.state) && (r ? l.tState = Be : l.state = Be, l.pure ? K.push(l) : re.push(l), l.observers && ir(l));
    }
  }
  function _e(t) {
    let r;
    if (t.sources)
      for (;t.sources.length; ) {
        const i = t.sources.pop(), l = t.sourceSlots.pop(), c = i.observers;
        if (c && c.length) {
          const h = c.pop(), w = i.observerSlots.pop();
          l < c.length && (h.sourceSlots[w] = l, c[l] = h, i.observerSlots[l] = w);
        }
      }
    if (t.tOwned) {
      for (r = t.tOwned.length - 1;r >= 0; r--)
        _e(t.tOwned[r]);
      delete t.tOwned;
    }
    if ($ && $.running && t.pure)
      or(t, true);
    else if (t.owned) {
      for (r = t.owned.length - 1;r >= 0; r--)
        _e(t.owned[r]);
      t.owned = null;
    }
    if (t.cleanups) {
      for (r = t.cleanups.length - 1;r >= 0; r--)
        t.cleanups[r]();
      t.cleanups = null;
    }
    $ && $.running ? t.tState = 0 : t.state = 0;
  }
  function or(t, r) {
    if (r || (t.tState = 0, $.disposed.add(t)), t.owned)
      for (let i = 0;i < t.owned.length; i++)
        or(t.owned[i]);
  }
  function Zr(t) {
    return t instanceof Error ? t : new Error(typeof t == "string" ? t : "Unknown error", { cause: t });
  }
  function ar(t, r, i) {
    try {
      for (const l of r)
        l(t);
    } catch (l) {
      Rt(l, i && i.owner || null);
    }
  }
  function Rt(t, r = U) {
    const i = Jt && r && r.context && r.context[Jt], l = Zr(t);
    if (!i)
      throw l;
    re ? re.push({ fn() {
      ar(l, i, r);
    }, state: ae }) : ar(l, i, r);
  }
  var Qr = Symbol("fallback");
  function lr(t) {
    for (let r = 0;r < t.length; r++)
      t[r]();
  }
  function en(t, r, i = {}) {
    let l = [], c = [], h = [], w = 0, p = r.length > 1 ? [] : null;
    return Zt(() => lr(h)), () => {
      let A = t() || [], C = A.length, x, T;
      return A[Xr], $e(() => {
        let _, b, v, I, V, S, E, a, d;
        if (C === 0)
          w !== 0 && (lr(h), h = [], l = [], c = [], w = 0, p && (p = [])), i.fallback && (l = [Qr], c[0] = rt((F) => (h[0] = F, i.fallback())), w = 1);
        else if (w === 0) {
          for (c = new Array(C), T = 0;T < C; T++)
            l[T] = A[T], c[T] = rt(N);
          w = C;
        } else {
          for (v = new Array(C), I = new Array(C), p && (V = new Array(C)), S = 0, E = Math.min(w, C);S < E && l[S] === A[S]; S++)
            ;
          for (E = w - 1, a = C - 1;E >= S && a >= S && l[E] === A[a]; E--, a--)
            v[a] = c[E], I[a] = h[E], p && (V[a] = p[E]);
          for (_ = new Map, b = new Array(a + 1), T = a;T >= S; T--)
            d = A[T], x = _.get(d), b[T] = x === undefined ? -1 : x, _.set(d, T);
          for (x = S;x <= E; x++)
            d = l[x], T = _.get(d), T !== undefined && T !== -1 ? (v[T] = c[x], I[T] = h[x], p && (V[T] = p[x]), T = b[T], _.set(d, T)) : h[x]();
          for (T = S;T < C; T++)
            T in v ? (c[T] = v[T], h[T] = I[T], p && (p[T] = V[T], p[T](T))) : c[T] = rt(N);
          c = c.slice(0, w = C), l = A.slice(0);
        }
        return c;
      });
      function N(_) {
        if (h[T] = _, p) {
          const [b, v] = L(T);
          return p[T] = v, r(A[T], b);
        }
        return r(A[T]);
      }
    };
  }
  var tn = false;
  function rn(t, r) {
    if (tn && ee.context) {
      const i = ee.context;
      pt(Hr());
      const l = $e(() => t(r || {}));
      return pt(i), l;
    }
    return $e(() => t(r || {}));
  }
  function ot() {
    return true;
  }
  var nn = { get(t, r, i) {
    return r === St ? i : t.get(r);
  }, has(t, r) {
    return r === St ? true : t.has(r);
  }, set: ot, deleteProperty: ot, getOwnPropertyDescriptor(t, r) {
    return { configurable: true, enumerable: true, get() {
      return t.get(r);
    }, set: ot, deleteProperty: ot };
  }, ownKeys(t) {
    return t.keys();
  } };
  function Tt(t) {
    return (t = typeof t == "function" ? t() : t) ? t : {};
  }
  function on() {
    for (let t = 0, r = this.length;t < r; ++t) {
      const i = this[t]();
      if (i !== undefined)
        return i;
    }
  }
  function sr(...t) {
    let r = false;
    for (let w = 0;w < t.length; w++) {
      const p = t[w];
      r = r || !!p && St in p, t[w] = typeof p == "function" ? (r = true, nt(p)) : p;
    }
    if (Ur && r)
      return new Proxy({ get(w) {
        for (let p = t.length - 1;p >= 0; p--) {
          const A = Tt(t[p])[w];
          if (A !== undefined)
            return A;
        }
      }, has(w) {
        for (let p = t.length - 1;p >= 0; p--)
          if (w in Tt(t[p]))
            return true;
        return false;
      }, keys() {
        const w = [];
        for (let p = 0;p < t.length; p++)
          w.push(...Object.keys(Tt(t[p])));
        return [...new Set(w)];
      } }, nn);
    const i = {}, l = Object.create(null);
    for (let w = t.length - 1;w >= 0; w--) {
      const p = t[w];
      if (!p)
        continue;
      const A = Object.getOwnPropertyNames(p);
      for (let C = A.length - 1;C >= 0; C--) {
        const x = A[C];
        if (x === "__proto__" || x === "constructor")
          continue;
        const T = Object.getOwnPropertyDescriptor(p, x);
        if (!l[x])
          l[x] = T.get ? { enumerable: true, configurable: true, get: on.bind(i[x] = [T.get.bind(p)]) } : T.value !== undefined ? T : undefined;
        else {
          const N = i[x];
          N && (T.get ? N.push(T.get.bind(p)) : T.value !== undefined && N.push(() => T.value));
        }
      }
    }
    const c = {}, h = Object.keys(l);
    for (let w = h.length - 1;w >= 0; w--) {
      const p = h[w], A = l[p];
      A && A.get ? Object.defineProperty(c, p, A) : c[p] = A ? A.value : undefined;
    }
    return c;
  }
  function Q(t) {
    const r = "fallback" in t && { fallback: () => t.fallback };
    return nt(en(() => t.each, t.children, r || undefined));
  }
  var an = (t) => nt(() => t());
  function ln({ createElement: t, createTextNode: r, isTextNode: i, replaceText: l, insertNode: c, removeNode: h, setProperty: w, getParentNode: p, getFirstChild: A, getNextSibling: C }) {
    function x(S, E, a, d) {
      if (a !== undefined && !d && (d = []), typeof E != "function")
        return T(S, E, d, a);
      Fe((F) => T(S, E(), F, a), d);
    }
    function T(S, E, a, d, F) {
      for (;typeof a == "function"; )
        a = a();
      if (E === a)
        return a;
      const R = typeof E, P = d !== undefined;
      if (R === "string" || R === "number")
        if (R === "number" && (E = E.toString()), P) {
          let D = a[0];
          D && i(D) ? l(D, E) : D = r(E), a = b(S, a, d, D);
        } else
          a !== "" && typeof a == "string" ? l(A(S), a = E) : (b(S, a, d, r(E)), a = E);
      else if (E == null || R === "boolean")
        a = b(S, a, d);
      else {
        if (R === "function")
          return Fe(() => {
            let D = E();
            for (;typeof D == "function"; )
              D = D();
            a = T(S, D, a, d);
          }), () => a;
        if (Array.isArray(E)) {
          const D = [];
          if (N(D, E, F))
            return Fe(() => a = T(S, D, a, d, true)), () => a;
          if (D.length === 0) {
            const te = b(S, a, d);
            if (P)
              return a = te;
          } else
            Array.isArray(a) ? a.length === 0 ? v(S, D, d) : _(S, a, D) : a == null || a === "" ? v(S, D) : _(S, P && a || [A(S)], D);
          a = D;
        } else {
          if (Array.isArray(a)) {
            if (P)
              return a = b(S, a, d, E);
            b(S, a, null, E);
          } else
            a == null || a === "" || !A(S) ? c(S, E) : I(S, E, A(S));
          a = E;
        }
      }
      return a;
    }
    function N(S, E, a) {
      let d = false;
      for (let F = 0, R = E.length;F < R; F++) {
        let P = E[F], D;
        if (!(P == null || P === true || P === false))
          if (Array.isArray(P))
            d = N(S, P) || d;
          else if ((D = typeof P) == "string" || D === "number")
            S.push(r(P));
          else if (D === "function")
            if (a) {
              for (;typeof P == "function"; )
                P = P();
              d = N(S, Array.isArray(P) ? P : [P]) || d;
            } else
              S.push(P), d = true;
          else
            S.push(P);
      }
      return d;
    }
    function _(S, E, a) {
      let d = a.length, F = E.length, R = d, P = 0, D = 0, te = C(E[F - 1]), Z = null;
      for (;P < F || D < R; ) {
        if (E[P] === a[D]) {
          P++, D++;
          continue;
        }
        for (;E[F - 1] === a[R - 1]; )
          F--, R--;
        if (F === P) {
          const le = R < d ? D ? C(a[D - 1]) : a[R - D] : te;
          for (;D < R; )
            c(S, a[D++], le);
        } else if (R === D)
          for (;P < F; )
            (!Z || !Z.has(E[P])) && h(S, E[P]), P++;
        else if (E[P] === a[R - 1] && a[D] === E[F - 1]) {
          const le = C(E[--F]);
          c(S, a[D++], C(E[P++])), c(S, a[--R], le), E[F] = a[R];
        } else {
          if (!Z) {
            Z = new Map;
            let ge = D;
            for (;ge < R; )
              Z.set(a[ge], ge++);
          }
          const le = Z.get(E[P]);
          if (le != null)
            if (D < le && le < R) {
              let ge = P, qe = 1, Ke;
              for (;++ge < F && ge < R && !((Ke = Z.get(E[ge])) == null || Ke !== le + qe); )
                qe++;
              if (qe > le - D) {
                const Gt = E[P];
                for (;D < le; )
                  c(S, a[D++], Gt);
              } else
                I(S, a[D++], E[P++]);
            } else
              P++;
          else
            h(S, E[P++]);
        }
      }
    }
    function b(S, E, a, d) {
      if (a === undefined) {
        let R;
        for (;R = A(S); )
          h(S, R);
        return d && c(S, d), "";
      }
      const F = d || r("");
      if (E.length) {
        let R = false;
        for (let P = E.length - 1;P >= 0; P--) {
          const D = E[P];
          if (F !== D) {
            const te = p(D) === S;
            !R && !P ? te ? I(S, F, D) : c(S, F, a) : te && h(S, D);
          } else
            R = true;
        }
      } else
        c(S, F, a);
      return [F];
    }
    function v(S, E, a) {
      for (let d = 0, F = E.length;d < F; d++)
        c(S, E[d], a);
    }
    function I(S, E, a) {
      c(S, E, a), h(S, a);
    }
    function V(S, E, a = {}, d) {
      return E || (E = {}), d || Fe(() => a.children = T(S, E.children, a.children)), Fe(() => E.ref && E.ref(S)), Fe(() => {
        for (const F in E) {
          if (F === "children" || F === "ref")
            continue;
          const R = E[F];
          R !== a[F] && (w(S, F, R, a[F]), a[F] = R);
        }
      }), a;
    }
    return { render(S, E) {
      let a;
      return rt((d) => {
        a = d, x(E, S());
      }), a;
    }, insert: x, spread(S, E, a) {
      typeof E == "function" ? Fe((d) => V(S, E(), d, a)) : V(S, E, undefined, a);
    }, createElement: t, createTextNode: r, insertNode: c, setProp(S, E, a, d) {
      return w(S, E, a, d), a;
    }, mergeProps: sr, effect: Fe, memo: an, createComponent: rn, use(S, E, a) {
      return $e(() => S(E, a));
    } };
  }
  function sn(t) {
    const r = ln(t);
    return r.mergeProps = sr, r;
  }
  var cr = 6 * 1024 * 1024, cn = 64, Ki = cn, ur = 4 * 1024 * 1024, Oe = 64 + ur, Pt = 768 * 1024, xt = Oe + Pt, un = 256 * 1024, Ct = xt + un, fr = Oe + Pt, fn = 0, dn = 8, hn = 12, gn = 16, Fn = 24, _n = 28, bn = 32, vn = 40, En = 44, pn = dn >> 2, Sn = hn >> 2, wn = Fn >> 2, dr = _n >> 2, mn = vn >> 2;
  En >> 2;
  var Rn = fn >> 3, Tn = gn >> 3, Pn = bn >> 3, Zi = 1, Qi = 2, eo = 3, to = 4, ro = 16, no = 17, io = 20, oo = 21, ao = 22, lo = 23, so = 24, co = 25, uo = 26, fo = 27, ho = 28, go = 29, Fo = 30, _o = 31, bo = 32, vo = 33, Eo = 34, po = 35, So = 36, wo = 37, mo = 38, Ro = 39, To = 0, Po = 1, xo = 2, Co = 3, $o = 4, Oo = 5, Ao = 6, yo = 7, ko = 9, Io = 10, No = 11, Do = 12, zo = 13, Lo = 14, Wo = 15, Vo = 16, Bo = 17, Mo = 18, Ho = 19, Go = 20, Uo = 21, Xo = 22, Yo = 23, Jo = 24, jo = 25, qo = 26, Ko = 27, Zo = 28, Qo = 29, ea = 30, ta = 31, ra = 32, na = 33, ia = 34, oa = 35, aa = 36, la = 37, sa = 38, ca = 39, ua = 40, fa = 41, da = 42, ha = 43, ga = 44, Fa = 45, _a = 46, ba = 1, va = 2, Ea = 3, pa = 4, Sa = 5, wa = 6, ma = 7, Ra = 8, Ta = 9, Pa = 10, xa = 11, Ca = 12, $a = 13, Oa = 14, Aa = 15, ya = 16, ka = 17, Ia = 18, Na = 19, Da = 20, za = 21, La = 0, Wa = 1, Va = 2, Ba = 3, Ma = 4, Ha = 5, Ga = 6, Ua = 7, Xa = 0, Ya = 1, Ja = 2, ja = 3, qa = 4, Ka = 5, Za = 6, Qa = 7, el = 8, tl = 9, rl = 10, nl = 11, il = 12, ol = 13, al = 14, ll = 15, sl = 16, cl = 32, ul = 33, fl = 34, dl = 35, hl = 36, gl = 37, Fl = 64, _l = 65, bl = 66, vl = 67, El = 68, pl = 69, Sl = 70, wl = 71, ml = 72, Rl = 73, Tl = 74, Pl = 96, xl = 97, Cl = 98, $l = 99, Ol = 128, Al = 129, yl = 130, kl = 131, Il = 132, Nl = 133, Dl = 134, zl = 135, Ll = 136, Wl = 137, Vl = 160, Bl = 161, Ml = 162, Hl = 163, Gl = 164, Ul = 165, Xl = 166, Yl = 167, Jl = 168, jl = 169, ql = 170, Kl = 171, Zl = 172, Ql = 173, es = 174, ts = 175, rs = 176, ns = 177, is = 178, os = -1, xn = 2147483646, Cn = 2147483645, pe = globalThis.__skal_acquireBridge();
  if (!pe || pe.byteLength !== cr)
    throw new Error(`Skal: bridge buffer not available (got ${pe && pe.byteLength})`);
  var hr = new Uint8Array(pe), ie = new Uint32Array(pe), $t = new BigInt64Array(pe), $n = new TextEncoder, Ue = 16, On = 64 + ur >> 2, An = 16384, yn = On - 4, at = 0n, be = Ue, Ae = Oe, lt = Ue;
  function Ot() {
    ie[pn] = be - Ue << 2, ie[Sn] = Ae - Oe, at += 1n, Atomics.store($t, Rn, at), lt = be;
  }
  function gr() {
    Ot();
    const t = at, r = performance.now() + 5000;
    for (;!(Atomics.load($t, Pn) >= t); )
      if (performance.now() > r) {
        console.warn("Skal: drain spin timeout \u2014 UI thread slow; ring will overwrite");
        break;
      }
    be = Ue, Ae = Oe, lt = Ue;
  }
  function X(t, r, i, l) {
    let c = be;
    c >= yn && (gr(), c = be), ie[c] = t >>> 0, ie[c + 1] = r >>> 0, ie[c + 2] = i >>> 0, ie[c + 3] = l >>> 0, be = c + 4, be - lt >= An && Ot();
  }
  var Se = 0, we = 0;
  function ye(t) {
    Ae + t.length * 3 > fr && gr();
    const r = Ae - Oe, i = hr.subarray(Ae, fr), { read: l, written: c } = $n.encodeInto(t, i);
    if (l !== t.length)
      throw new Error(`Skal: string too large for heap (${t.length} code units > ${Pt} bytes)`);
    Ae += c, Se = r, we = c;
  }
  function st(t, r) {
    ye(r), X(20, t, Se, we);
  }
  var At = false;
  function kn() {
    At = false, be !== lt && Ot();
  }
  function H() {
    At || (At = true, queueMicrotask(kn));
  }
  var fe = 1024, k = new Int8Array(256);
  k.fill(-1), k[0] = 0, k[1] = 1, k[2] = 2, k[3] = 3, k[4] = 4, k[5] = 5, k[6] = 6, k[7] = 7, k[8] = 8, k[9] = 9, k[32] = 10, k[33] = 11, k[34] = 12, k[35] = 13, k[36] = 14, k[37] = 15, k[64] = 16, k[65] = 17, k[66] = 18, k[67] = 19, k[68] = 20, k[69] = 21, k[70] = 22, k[96] = 23, k[97] = 24, k[128] = 25, k[129] = 26, k[130] = 27, k[131] = 28, k[160] = 29, k[161] = 30, k[162] = 31, k[10] = 32, k[11] = 33, k[12] = 34, k[13] = 35, k[14] = 36, k[15] = 37, k[16] = 38, k[132] = 39, k[133] = 40, k[134] = 41, k[135] = 42, k[136] = 43, k[163] = 44, k[164] = 45, k[165] = 46, k[166] = 47, k[71] = 48, k[98] = 49, k[137] = 50, k[72] = 51, k[167] = 52, k[168] = 53, k[169] = 54, k[170] = 55, k[171] = 56, k[172] = 57, k[173] = 58, k[174] = 59, k[73] = 60, k[99] = 61, k[175] = 62, k[74] = 63;
  var oe = 64, ct = new Int32Array(fe * oe), Xe = new Float32Array(fe * oe), ut = new Array(fe * oe), Ye = new Uint8Array(fe * oe), ke = 6, Ie = new Float32Array(fe * ke);
  Ie.fill(NaN);
  var ft = new Map, Fr = [], In = 0;
  function Nn() {
    const t = fe * 2, r = fe * oe, i = t * oe, l = fe * ke, c = t * ke, h = new Int32Array(i);
    h.set(ct), ct = h;
    const w = new Uint8Array(i);
    w.set(Ye), Ye = w;
    const p = new Float32Array(i);
    p.set(Xe), p.fill(NaN, r), Xe = p;
    const A = new Float32Array(c);
    A.set(Ie), A.fill(NaN, l), Ie = A, ut.length = i, fe = t;
  }
  function dt(t) {
    let r = ft.get(t);
    if (r === undefined) {
      r = Fr.pop(), r === undefined && (r = In++), r >= fe && Nn(), ft.set(t, r);
      const i = r * oe;
      Ye.fill(0, i, i + oe), Xe.fill(NaN, i, i + oe);
      for (let l = i;l < i + oe; l++)
        ut[l] = undefined;
    }
    return r;
  }
  var _r = new Map, br = new Map, vr = new Map, Ne = new Map;
  function Dn(t) {
    const r = ft.get(t);
    if (r !== undefined) {
      ft.delete(t), Fr.push(r);
      const i = r * ke;
      Ie.fill(NaN, i, i + ke);
    }
    _r.delete(t), br.delete(t), vr.delete(t), ti(t);
  }
  var ce = 0, ve = 0, De = new Float32Array(1), Je = new Uint32Array(De.buffer);
  function ne(t, r, i) {
    const l = i | 0, c = k[r];
    if (c < 0) {
      X(16, t, r, l), ce++;
      return;
    }
    const h = dt(t) * oe + c;
    if (Ye[h] !== 0 && ct[h] === l) {
      ve++;
      return;
    }
    ct[h] = l, Ye[h] = 1, X(16, t, r, l), ce++;
  }
  function Er(t, r, i) {
    const l = k[r];
    if (l < 0) {
      De[0] = i, X(17, t, r, Je[0]), ce++;
      return;
    }
    const c = dt(t) * oe + l;
    if (Xe[c] === i) {
      ve++;
      return;
    }
    Xe[c] = i, De[0] = i, X(17, t, r, Je[0]), ce++;
  }
  function zn(t, r, i) {
    const l = k[r];
    if (l < 0) {
      ye(i == null ? "" : String(i)), X(22, t, (r & 255) << 24 | Se & 16777215, we), ce++;
      return;
    }
    const c = dt(t) * oe + l;
    if (ut[c] === i) {
      ve++;
      return;
    }
    ut[c] = i, ye(i == null ? "" : String(i)), X(22, t, (r & 255) << 24 | Se & 16777215, we), ce++;
  }
  function ze(t, r, i, l) {
    const c = dt(t) * ke + i;
    if (Ie[c] === l) {
      ve++;
      return;
    }
    Ie[c] = l, De[0] = l, X(r, t, 0, Je[0]), ce++;
  }
  function Ln(t, r) {
    ze(t, 32, 0, r);
  }
  function Wn(t, r) {
    ze(t, 33, 1, r);
  }
  function Vn(t, r) {
    ze(t, 34, 2, r);
  }
  function Bn(t, r) {
    ze(t, 35, 3, r);
  }
  function Mn(t, r) {
    ze(t, 36, 4, r);
  }
  function Hn(t, r) {
    ze(t, 37, 5, r);
  }
  var Gn = { material: 0, cupertino: 1, adaptive: 2 }, Un = { light: 0, dark: 1 };
  function Xn(t, r) {
    X(38, typeof t == "string" ? Gn[t] ?? 0 : t | 0, typeof r == "string" ? Un[r] ?? 0 : r | 0, 0), H();
  }
  function Yn(t) {
    X(39, t, 0, 0), H();
  }
  function pr(t) {
    return Le(1, "showDialog", [JSON.stringify(t || {})]);
  }
  function Jn(t) {
    return Le(1, "showActionSheet", [JSON.stringify(t || {})]);
  }
  function Sr(t) {
    return Le(1, "showSnackbar", [JSON.stringify(typeof t == "string" ? { message: t } : t || {})]);
  }
  function jn(t) {
    return Le(1, "showDatePicker", [JSON.stringify(t || {})]);
  }
  function qn(t) {
    return Le(1, "showTimePicker", [JSON.stringify(t || {})]);
  }
  var wr = new Map;
  function Kn(t) {
    let r = 2166136261;
    for (let i = 0;i < t.length; i++)
      r ^= t.charCodeAt(i), r = Math.imul(r, 16777619) >>> 0;
    return r;
  }
  function me(t) {
    let r = wr.get(t);
    return r !== undefined || (r = Kn(t), ye(t), X(23, r, Se, we), wr.set(t, r)), r;
  }
  function Zn(t, r) {
    X(4, t, me(r), 0);
  }
  function yt(t, r) {
    let i = t.get(r);
    return i === undefined && (i = new Map, t.set(r, i)), i;
  }
  function mr(t, r, i) {
    const l = me(r), c = i >>> 0, h = yt(_r, t);
    if (h.get(l) === c) {
      ve++;
      return;
    }
    h.set(l, c), X(24, t, l, c), ce++;
  }
  function Rr(t, r, i) {
    const l = me(r), c = yt(br, t);
    if (c.get(l) === i) {
      ve++;
      return;
    }
    c.set(l, i), De[0] = i, X(25, t, l, Je[0]), ce++;
  }
  function Tr(t, r, i) {
    const l = me(r), c = i == null ? "" : String(i), h = yt(vr, t);
    if (h.get(l) === c) {
      ve++;
      return;
    }
    h.set(l, c), ye(c);
    const w = Se & 16777215, p = we & 255;
    X(26, t, l, w << 8 | p), ce++;
  }
  function Qn(t, r, i) {
    X(27, t, me(r), i);
  }
  var je = new Map, de = new Map, Pr = 1;
  function xr(t, r) {
    for (let i = 0;i < r.length; i++) {
      const l = r[i];
      if (typeof l == "number")
        Number.isInteger(l) ? X(29, t, 1, l | 0) : (De[0] = l, X(29, t, 2, Je[0]));
      else if (typeof l == "boolean")
        X(29, t, 3, l ? 1 : 0);
      else if (typeof l == "string") {
        ye(l);
        const c = Se >>> 0;
        X(29, t, 4 | (we & 16777215) << 8, c);
      } else
        X(29, t, 0, 0);
    }
  }
  function Le(t, r, i) {
    const l = me(r), c = Pr++;
    return xr(c, i), X(28, t, l, c), H(), new Promise((h, w) => {
      je.set(c, { resolve: h, reject: w });
    });
  }
  function ei(t, r, i, l, c) {
    const h = me(r), w = Pr++;
    xr(w, i), X(30, t, h, w), H(), de.set(w, { nodeId: t, onValue: l, onError: c && c.onError, onDone: c && c.onDone });
    let p = Ne.get(t);
    return p === undefined && (p = new Set, Ne.set(t, p)), p.add(w), function() {
      if (!de.has(w))
        return;
      de.delete(w);
      const C = Ne.get(t);
      C && (C.delete(w), C.size === 0 && Ne.delete(t)), X(31, w, 0, 0), H();
    };
  }
  function ti(t) {
    const r = Ne.get(t);
    if (r !== undefined) {
      for (const i of r)
        de.has(i) && (de.delete(i), X(31, i, 0, 0));
      Ne.delete(t), H();
    }
  }
  var kt = new Map, ri = 1;
  function It(t) {
    const r = ri++;
    return kt.set(r, t), r;
  }
  function Cr(t, r, i) {
    X(21, t, r, i);
  }
  var Nt = 0n, Re = null, $r = cr - Ct, Dt = Ct >> 2, ni = Ct + $r >> 2, ii = $r / 16 | 0, Or = new ArrayBuffer(4), zt = new Float32Array(Or), Lt = new Uint32Array(Or), oi = new TextDecoder("utf-8");
  function Wt(t, r) {
    return r === 0 ? "" : oi.decode(hr.subarray(xt + t, xt + t + r));
  }
  function Vt(t, r) {
    ie[mn] = t + r;
  }
  globalThis.__skal_drainEvents = function() {
    const t = Atomics.load($t, Tn);
    if (t === Nt)
      return;
    const r = Dt + (ie[wn] >> 2);
    let i = Dt + (ie[dr] >> 2);
    const l = ni, c = Dt;
    let h = ii;
    for (;i !== r && h-- > 0; ) {
      const w = ie[i + 0], p = w & 255, A = w >>> 8 & 255, C = ie[i + 1], x = ie[i + 2], T = ie[i + 3];
      let N, _ = false;
      if (A === 1)
        N = x | 0, _ = true;
      else if (A === 2)
        Lt[0] = x, N = zt[0], _ = true;
      else if (A === 3)
        N = x !== 0, _ = true;
      else if (A === 4)
        N = Wt(T, x), _ = true, Vt(T, x);
      else if (A === 5) {
        const b = Wt(T, x);
        try {
          N = JSON.parse(b);
        } catch {
          N = b;
        }
        _ = true, Vt(T, x);
      } else if (A === 6) {
        const b = Wt(T, x);
        try {
          N = JSON.parse(b);
        } catch {
          N = [];
        }
        _ = true, Vt(T, x);
      } else if (A === 7) {
        Lt[0] = x;
        const b = zt[0];
        Lt[0] = T, N = [b, zt[0]], _ = true;
      }
      if (p === 3) {
        const b = je.get(C);
        if (b) {
          je.delete(C);
          try {
            b.resolve(_ ? N : undefined);
          } catch (v) {
            Re = v && (v.stack || v.message || String(v)) || "unknown";
          }
        }
      } else if (p === 4) {
        const b = je.get(C);
        if (b) {
          je.delete(C);
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
            _ ? (A === 6 || A === 7) && Array.isArray(N) ? b(...N) : b(N) : b();
          } catch (v) {
            Re = v && (v.stack || v.message || String(v)) || "unknown";
          }
      }
      i += 4, i >= l && (i = c);
    }
    ie[dr] = i - c << 2, Nt = t;
  }, globalThis.skalStatus = () => JSON.stringify({ handlerCount: kt.size, opSeq: Number(at), lastEventSeq: Number(Nt), lastHandlerError: Re, propWrites: ce, propSkips: ve });
  var as = 1, ai = 2;
  function Ar() {
    return ai++;
  }
  var li = { box: 0, column: 1, scrollView: 5, listView: 6, reorderableListView: 7, row: 2, text: 3, button: 4, image: 9, stack: 10, switch: 11, slider: 12, checkbox: 13, activityIndicator: 14, progressBar: 15, lazyGrid: 16, wrap: 17, safeArea: 18, richText: 19, textInput: 20, navigator: 21, screen: 22, tabs: 23, tab: 24, animatedList: 25, crossFade: 26, hero: 27, listTile: 28, pageView: 29, dismissible: 30, customScrollView: 31, sliverAppBar: 32, sliverList: 33, sliverGrid: 34, canvas: 35, dragItem: 36, dropZone: 37, radio: 38, chip: 39, segmentedButton: 40, expansionTile: 41, dropdown: 42, stepper: 43, step: 44, drawer: 45, bottomSheet: 46 };
  function si() {
    const t = [], r = { _cmds: t, fillStyle(i) {
      return t.push(["fillStyle", Bt(i)]), r;
    }, strokeStyle(i) {
      return t.push(["strokeStyle", Bt(i)]), r;
    }, lineWidth(i) {
      return t.push(["lineWidth", +i || 0]), r;
    }, fillRect(i, l, c, h) {
      return t.push(["fillRect", +i, +l, +c, +h]), r;
    }, strokeRect(i, l, c, h) {
      return t.push(["strokeRect", +i, +l, +c, +h]), r;
    }, circle(i, l, c) {
      return t.push(["circle", +i, +l, +c]), r;
    }, line(i, l, c, h) {
      return t.push(["line", +i, +l, +c, +h]), r;
    }, beginPath() {
      return t.push(["beginPath"]), r;
    }, moveTo(i, l) {
      return t.push(["moveTo", +i, +l]), r;
    }, lineTo(i, l) {
      return t.push(["lineTo", +i, +l]), r;
    }, closePath() {
      return t.push(["closePath"]), r;
    }, fill() {
      return t.push(["fill"]), r;
    }, stroke() {
      return t.push(["stroke"]), r;
    }, fontSize(i) {
      return t.push(["fontSize", +i || 14]), r;
    }, fillText(i, l, c) {
      return t.push(["fillText", String(i), +l, +c]), r;
    } };
    return r;
  }
  var ci = { padding: [0, "u32"], paddingTop: [1, "u32"], paddingRight: [2, "u32"], paddingBottom: [3, "u32"], paddingLeft: [4, "u32"], width: [5, "dim"], height: [6, "dim"], weight: [7, "f32"], alignment: [8, "u32"], gap: [9, "u32"], axis: [10, "u32"], top: [11, "u32"], right: [12, "u32"], bottom: [13, "u32"], left: [14, "u32"], crossAxisCount: [15, "u32"], aspectRatio: [16, "f32"], background: [32, "color"], color: [33, "color"], cornerRadius: [34, "u32"], borderWidth: [35, "u32"], borderColor: [36, "color"], shadow: [37, "u32"], fontSize: [64, "u32"], fontWeight: [65, "u32"], fontFamily: [66, "u32"], textAlign: [67, "u32"], lineHeight: [68, "u32"], maxLines: [69, "u32"], textOverflow: [70, "u32"], src: [96, "str"], contentScale: [97, "u32"], placeholder: [128, "str"], value: [129, "str"], keyboardType: [130, "u32"], secureEntry: [131, "u32"], checked: [132, "u32"], min: [134, "f32"], max: [135, "f32"], progress: [136, "f32"], initialSize: [176, "f32"], minSize: [177, "f32"], maxSize: [178, "f32"], presentation: [166, "u32"], title: [71, "str"], icon: [98, "str"], leadingIcon: [98, "str"], subtitle: [73, "str"], trailingIcon: [99, "str"], activeTab: [137, "u32"], tag: [72, "str"], transition: [171, "u32"], enabled: [160, "u32"], focusable: [161, "u32"], visible: [162, "u32"], draggable: [172, "u32"], spring: [173, "u32"], release: [174, "u32"], sliverMode: [175, "u32"], dragData: [74, "str"] }, ui = { opacity: Ln, translationX: Wn, translationY: Vn, scaleX: Bn, scaleY: Mn, rotation: Hn }, fi = { onClick: 1, onclick: 1, onTap: 1, onLongPress: 8, onDoubleTap: 9, onChange: 2, onSubmit: 10, onReorder: 11, onPop: 12, onDismiss: 20, onPanStart: 13, onPanUpdate: 14, onPanEnd: 15, onScaleStart: 16, onScaleUpdate: 17, onScaleEnd: 18, onDrop: 21 }, di = { linear: 0, easeIn: 1, easeOut: 2, easeInOut: 3, bounce: 4, elastic: 5, fastOutSlowIn: 6 }, hi = { gentle: 1, bouncy: 2, stiff: 3 };
  function Bt(t) {
    if (typeof t == "number")
      return t | 0;
    if (typeof t != "string")
      return 0;
    let r = t.trim();
    r.startsWith("#") && (r = r.slice(1));
    let i = 0, l = 0, c = 0, h = 255;
    return r.length === 3 ? (i = parseInt(r[0] + r[0], 16), l = parseInt(r[1] + r[1], 16), c = parseInt(r[2] + r[2], 16)) : r.length === 4 ? (i = parseInt(r[0] + r[0], 16), l = parseInt(r[1] + r[1], 16), c = parseInt(r[2] + r[2], 16), h = parseInt(r[3] + r[3], 16)) : r.length === 6 ? (i = parseInt(r.slice(0, 2), 16), l = parseInt(r.slice(2, 4), 16), c = parseInt(r.slice(4, 6), 16)) : r.length === 8 && (h = parseInt(r.slice(0, 2), 16), i = parseInt(r.slice(2, 4), 16), l = parseInt(r.slice(4, 6), 16), c = parseInt(r.slice(6, 8), 16)), (h & 255) << 24 | (i & 255) << 16 | (l & 255) << 8 | c & 255 | 0;
  }
  function gi(t) {
    return typeof t == "number" ? t | 0 : t === "fill" ? xn : t === "wrap" ? Cn : -1;
  }
  function Fi(t) {
    if (Array.isArray(t))
      return true;
    const r = Object.getPrototypeOf(t);
    return r === Object.prototype || r === null;
  }
  function _i(t, r, i) {
    if (i == null)
      return;
    if (r === "ref" && i && typeof i.__skalBind == "function") {
      i.__skalBind(t.id);
      return;
    }
    const l = typeof i;
    if (l === "object" && Fi(i)) {
      Tr(t.id, r, JSON.stringify(i)), H();
      return;
    }
    if (l === "function") {
      const c = It(i);
      Qn(t.id, r, c), H();
      return;
    }
    if (l === "number") {
      Number.isInteger(i) && i >= 0 && i <= 4294967295 && mr(t.id, r, i | 0), Rr(t.id, r, i), H();
      return;
    }
    if (l === "string") {
      Tr(t.id, r, i), H();
      return;
    }
    if (l === "boolean") {
      mr(t.id, r, i ? 1 : 0), H();
      return;
    }
  }
  function bi(t) {
    const r = [t];
    for (;r.length > 0; ) {
      const i = r.pop();
      Dn(i.id);
      let l = i.firstChild;
      for (;l; )
        r.push(l), l = l.nextSibling;
    }
  }
  var ht = class {
    constructor(t, r, i = false, l = false) {
      this.tag = t, this.id = r, this.isText = i, this.isCustom = l, this.parent = null, this.firstChild = null, this.lastChild = null, this.nextSibling = null, this.prevSibling = null, this.text = "";
    }
  }, vi = sn({ createElement(t) {
    const r = Ar(), i = li[t];
    return i !== undefined ? (X(1, r, i, 0), H(), new ht(t, r, false, false)) : (Zn(r, t), H(), new ht(t, r, false, true));
  }, createTextNode(t) {
    const r = Ar();
    X(1, r, 3, 0);
    const i = t == null ? "" : String(t);
    i.length > 0 && st(r, i), H();
    const l = new ht("#text", r, true);
    return l.text = i, l;
  }, replaceText(t, r) {
    const i = r == null ? "" : String(r);
    t.text !== i && (t.text = i, st(t.id, i), H());
  }, setProperty(t, r, i, l) {
    if (t.isCustom) {
      _i(t, r, i);
      return;
    }
    if (r === "onRefresh") {
      if (typeof i == "function") {
        const p = t.id, A = i, x = It(async () => {
          try {
            await A();
          } finally {
            Yn(p);
          }
        });
        Cr(t.id, 19, x), H();
      }
      return;
    }
    if (r === "draw" && typeof i == "function") {
      const p = i, A = t;
      Kt(() => {
        const C = si();
        try {
          p(C);
        } catch {}
        const x = JSON.stringify(C._cmds);
        x !== A._skalCanvasProgram && (A._skalCanvasProgram = x, st(A.id, x), H());
      });
      return;
    }
    const c = fi[r];
    if (c !== undefined) {
      if (typeof i == "function") {
        const p = It(i);
        Cr(t.id, c, p), H();
      }
      return;
    }
    if (r === "value" && t.tag === "slider") {
      Er(t.id, 133, Number(i) || 0), H();
      return;
    }
    if (r === "draggable" && typeof i == "string") {
      ne(t.id, 172, { free: 1, both: 1, horizontal: 2, x: 2, vertical: 3, y: 3 }[i] ?? 0), H();
      return;
    }
    if (r === "spring" && typeof i == "string") {
      ne(t.id, 173, { gentle: 1, bouncy: 2, stiff: 3, wobbly: 2 }[i] ?? 0), H();
      return;
    }
    if (r === "release" && typeof i == "string") {
      ne(t.id, 174, { none: 0, glide: 1, friction: 1, springback: 2, spring: 2 }[i.toLowerCase()] ?? 0), H();
      return;
    }
    if (r === "sliverMode" && typeof i == "string") {
      ne(t.id, 175, { normal: 0, pinned: 1, floating: 2, both: 3 }[i.toLowerCase()] ?? 0), H();
      return;
    }
    if (r === "animate" && i && typeof i == "object") {
      if (ne(t.id, 163, i.duration | 0), i.curve != null) {
        const p = typeof i.curve == "string" ? di[i.curve] ?? 0 : i.curve | 0;
        ne(t.id, 164, p);
      }
      if (i.delay != null && ne(t.id, 165, i.delay | 0), i.repeat != null && ne(t.id, 167, i.repeat ? 1 : 0), i.reverse != null && ne(t.id, 168, i.reverse ? 1 : 0), i.loop != null && ne(t.id, 169, i.loop | 0), i.spring != null) {
        const p = typeof i.spring == "string" ? hi[i.spring] ?? 0 : i.spring ? 2 : 0;
        ne(t.id, 170, p);
      }
      H();
      return;
    }
    if (r === "label" && (t.tag === "button" || t.tag === "text" || t.tag === "chip")) {
      const p = i == null ? "" : String(i);
      st(t.id, p), H();
      return;
    }
    const h = ui[r];
    if (h !== undefined) {
      typeof i == "number" && (h(t.id, i), H());
      return;
    }
    const w = ci[r];
    if (w !== undefined) {
      const [p, A] = w;
      if (i == null)
        return;
      switch (A) {
        case "u32":
          typeof i == "number" ? (ne(t.id, p, i | 0), H()) : typeof i == "boolean" && (ne(t.id, p, i ? 1 : 0), H());
          return;
        case "f32":
          typeof i == "number" && (Er(t.id, p, i), H());
          return;
        case "str":
          zn(t.id, p, String(i)), H();
          return;
        case "color":
          ne(t.id, p, Bt(i)), H();
          return;
        case "dim":
          ne(t.id, p, gi(i)), H();
          return;
      }
      return;
    }
    if (r === "style" && i && typeof i == "object") {
      for (const p in i)
        this.setProperty(t, p, i[p]);
      return;
    }
  }, insertNode(t, r, i) {
    if (r === i)
      return;
    if (r.parent) {
      const c = r.parent;
      r.prevSibling ? r.prevSibling.nextSibling = r.nextSibling : c.firstChild === r && (c.firstChild = r.nextSibling), r.nextSibling ? r.nextSibling.prevSibling = r.prevSibling : c.lastChild === r && (c.lastChild = r.prevSibling), r.prevSibling = null, r.nextSibling = null;
    }
    const l = i ? i.id : 0;
    X(3, t.id, r.id, l), H(), r.parent = t, i ? (r.nextSibling = i, r.prevSibling = i.prevSibling, i.prevSibling ? i.prevSibling.nextSibling = r : t.firstChild = r, i.prevSibling = r) : (r.prevSibling = t.lastChild, r.nextSibling = null, t.lastChild ? t.lastChild.nextSibling = r : t.firstChild = r, t.lastChild = r);
  }, removeNode(t, r) {
    X(2, r.id, 0, 0), bi(r), H(), r.prevSibling ? r.prevSibling.nextSibling = r.nextSibling : t.firstChild = r.nextSibling, r.nextSibling ? r.nextSibling.prevSibling = r.prevSibling : t.lastChild = r.prevSibling, r.parent = null, r.prevSibling = null, r.nextSibling = null;
  }, isTextNode(t) {
    return t.isText;
  }, getParentNode(t) {
    return t.parent;
  }, getFirstChild(t) {
    return t.firstChild;
  }, getNextSibling(t) {
    return t.nextSibling;
  } }), { render: Ei, effect: z, memo: Mt, createComponent: O, createElement: o, createTextNode: ls, insertNode: f, insert: y, spread: ss, setProp: e, mergeProps: cs, use: pi } = vi;
  X(1, 1, 0, 0), H();
  var Si = new ht("box", 1, false);
  function wi() {
    let t = 0;
    const r = function() {};
    return r.__skalBind = (i) => {
      t = i;
    }, new Proxy(r, { apply(i, l, c) {
      const h = c[0];
      h && typeof h.id == "number" && (t = h.id);
    }, get(i, l) {
      if (l === "__skalBind" || typeof l == "symbol")
        return r[l];
      if (typeof l == "string" && l.endsWith("$") && l.length > 1) {
        const c = l.slice(0, -1);
        return (...h) => {
          if (t === 0)
            throw new Error(`skal ref: cannot call .${String(l)}() before the host mounts. Move the call into a JSX event handler.`);
          const w = h[h.length - 1];
          if (typeof w != "function")
            throw new TypeError(`skal ref: .${String(l)}() requires a callback as its last argument (got ${typeof w})`);
          const p = h.slice(0, -1);
          return ei(t, c, p, w);
        };
      }
      return (...c) => t === 0 ? Promise.reject(new Error(`skal ref: cannot call .${String(l)}() before the host mounts. Move the call into a JSX event handler.`)) : Le(t, l, c);
    } });
  }
  function Ht(t, r, i) {
    const l = (b) => {
      const v = t[b];
      return typeof v == "function" ? v : v && v.component || null;
    }, c = (b) => {
      const v = t[b];
      return v && typeof v == "object" ? v.title : undefined;
    }, h = (b) => {
      const v = t[b];
      return v && typeof v == "object" ? v.transition : undefined;
    }, w = (b) => b === "fade" ? 1 : b === "none" ? 2 : typeof b == "number" ? b : 0, p = !!(i && i.linking), A = typeof window < "u", C = () => {
      if (!A)
        return null;
      const b = (window.location.hash || "").replace(/^#\/?/, "").split("?")[0];
      return b && t[b] ? b : null;
    };
    let x = typeof r == "string" ? r : r && r.name || Object.keys(t)[0];
    if (p) {
      const b = C();
      b && (x = b);
    }
    const [T, N] = L([{ name: x, params: {}, title: c(x), transition: h(x) }]), _ = { stack: T, navigate(b, v, I) {
      N([...T(), { name: b, params: v || {}, presentation: I && I.presentation, title: (I && I.title) !== undefined ? I.title : c(b), transition: (I && I.transition) !== undefined ? I.transition : h(b) }]);
    }, back() {
      const b = T();
      b.length > 1 && N(b.slice(0, -1));
    }, replace(b, v, I) {
      N([...T().slice(0, -1), { name: b, params: v || {}, title: (I && I.title) !== undefined ? I.title : c(b), transition: (I && I.transition) !== undefined ? I.transition : h(b) }]);
    }, reset(b, v) {
      N([{ name: b, params: v || {}, title: c(b), transition: h(b) }]);
    }, canGoBack() {
      return T().length > 1;
    } };
    return p && A && Kt(() => {
      const b = T(), v = "#/" + b[b.length - 1].name;
      window.location.hash !== v && window.history.replaceState({}, "", v);
    }), _.View = () => (() => {
      var b = o("navigator");
      return e(b, "onPop", () => _.back()), y(b, O(Q, { get each() {
        return T();
      }, children: (v) => {
        const I = l(v.name);
        return (() => {
          var V = o("screen");
          return y(V, I ? O(I, { get params() {
            return v.params || {};
          }, router: _ }) : null), z((S) => {
            var E = v.presentation === "modal" ? 1 : 0, a = v.title || "", d = w(v.transition);
            return E !== S.e && (S.e = e(V, "presentation", E, S.e)), a !== S.t && (S.t = e(V, "title", a, S.t)), d !== S.a && (S.a = e(V, "transition", d, S.a)), S;
          }, { e: undefined, t: undefined, a: undefined }), V;
        })();
      } })), b;
    })(), _;
  }
  var mi = "#FFE5E5EA", Ri = "#FF1C1C1E", Ee = "#FF0A84FF", Te = "#FF34C759", We = "#FFFF9F0A", gt = "#FFFF3B30", Ve = "#FF5E5CE6";
  function B(t) {
    return (() => {
      var r = o("column"), i = o("text");
      return f(r, i), e(r, "background", "#FFFFFFFF"), e(r, "cornerRadius", 14), e(r, "padding", 16), e(r, "gap", 12), e(r, "borderWidth", 1), e(r, "borderColor", "#FFE5E5EA"), e(i, "fontSize", 15), e(i, "fontWeight", 800), e(i, "color", "#FF1C1C1E"), y(r, () => t.children, null), z((l) => e(i, "label", t.title, l)), r;
    })();
  }
  function Ti(t) {
    const r = ["Inbox", "Starred", "Drafts", "Archive"];
    return [(() => {
      var i = o("column");
      return e(i, "background", "#FFF2F2F7"), e(i, "padding", 16), e(i, "gap", 8), e(i, "height", "fill"), y(i, O(Q, { each: r, children: (l) => (() => {
        var c = o("box"), h = o("text");
        return f(c, h), e(c, "background", "#FFFFFFFF"), e(c, "cornerRadius", 8), e(c, "padding", 12), e(c, "onTap", () => t.router.navigate("detail", { name: l }, { title: l })), e(h, "label", `${l}   \u203A`), e(h, "fontSize", 14), e(h, "color", "#FF1C1C1E"), c;
      })() })), i;
    })(), (() => {
      var i = o("drawer"), l = o("box"), c = o("text");
      return f(i, l), e(i, "background", "#FFFFFFFF"), f(l, c), e(l, "padding", 20), e(l, "background", "#FF0A84FF"), e(c, "label", "Mail"), e(c, "fontSize", 20), e(c, "fontWeight", 800), e(c, "color", "#FFFFFF"), y(i, O(Q, { each: r, children: (h) => (() => {
        var w = o("box"), p = o("text");
        return f(w, p), e(w, "padding", 14), e(p, "label", h), e(p, "fontSize", 14), e(p, "color", "#FF1C1C1E"), w;
      })() }), null), i;
    })()];
  }
  function Pi(t) {
    return (() => {
      var r = o("column"), i = o("text"), l = o("text");
      return f(r, i), f(r, l), e(r, "background", "#FFF2F2F7"), e(r, "padding", 16), e(r, "gap", 10), e(r, "height", "fill"), e(i, "fontSize", 20), e(i, "fontWeight", 800), e(i, "color", "#FF1C1C1E"), e(l, "label", "The AppBar's \u2039 back button (and the system back / swipe gesture) all pop this route. The list screen behind stayed mounted \u2014 back is instant, no re-render, scroll preserved."), e(l, "fontSize", 13), e(l, "color", "#FF8E8E93"), z((c) => e(i, "label", t.name, c)), r;
    })();
  }
  var xi = [Ee, Te, We, Ve];
  function Ci() {
    const [t, r] = L(false), [i, l] = L(false), [c, h] = L(false), [w, p] = L(0), [A, C] = L("0, 0"), [x, T] = L(false), [N, _] = L(["Alpha", "Beta", "Gamma"]);
    let b = 3;
    const v = Ht({ gallery: (I) => (() => {
      var V = o("column"), S = o("text"), E = o("row");
      return f(V, S), f(V, E), e(V, "background", "#FFF2F2F7"), e(V, "padding", 16), e(V, "gap", 12), e(V, "height", "fill"), e(S, "label", "Tap a swatch \u2014 it flies to the detail screen."), e(S, "fontSize", 13), e(S, "color", "#FF8E8E93"), e(E, "gap", 12), y(E, O(Q, { each: xi, children: (a) => (() => {
        var d = o("hero"), F = o("box");
        return f(d, F), e(d, "tag", `hero-${a}`), e(F, "width", 56), e(F, "height", 56), e(F, "background", a), e(F, "cornerRadius", 12), e(F, "onTap", () => I.router.navigate("detail", { color: a })), d;
      })() })), V;
    })(), detail: { component: (I) => (() => {
      var V = o("column"), S = o("hero"), E = o("box"), a = o("text");
      return f(V, S), f(V, a), e(V, "background", "#FFF2F2F7"), e(V, "padding", 16), e(V, "gap", 12), e(V, "height", "fill"), f(S, E), e(E, "width", "fill"), e(E, "height", 180), e(E, "cornerRadius", 20), e(a, "label", "The swatch flew here from the gallery \u2014 a shared-element transition, GPU-composited host-side."), e(a, "fontSize", 13), e(a, "color", "#FF8E8E93"), z((d) => {
        var F = `hero-${I.params.color}`, R = I.params.color;
        return F !== d.e && (d.e = e(S, "tag", F, d.e)), R !== d.t && (d.t = e(E, "background", R, d.t)), d;
      }, { e: undefined, t: undefined }), V;
    })(), title: "Detail", transition: "fade" } }, "gallery");
    return (() => {
      var I = o("scrollView"), V = o("text"), S = o("text"), E = o("text");
      return f(I, V), f(I, S), f(I, E), e(I, "background", "#FFF2F2F7"), e(I, "padding", 16), e(I, "gap", 14), e(V, "label", "Animations"), e(V, "fontSize", 24), e(V, "fontWeight", 800), e(V, "color", "#FF1C1C1E"), e(S, "label", "Host-side motion \u2014 JS flips one signal, Flutter runs the whole tween. Zero per-frame bridge traffic. See ANIMATION.md for the full plan."), e(S, "fontSize", 13), e(S, "color", "#FF8E8E93"), y(I, O(B, { title: "Implicit hot-prop tween \u2014 the animate prop", get children() {
        return [(() => {
          var a = o("row"), d = o("box");
          return f(a, d), e(a, "gap", 8), e(d, "width", 64), e(d, "height", 64), e(d, "background", "#FF0A84FF"), e(d, "cornerRadius", 14), e(d, "animate", { duration: 450, curve: "easeInOut" }), z((F) => {
            var R = t() ? 0.3 : 1, P = t() ? 1.4 : 1, D = t() ? 1.4 : 1, te = t() ? 0.5 : 0, Z = t() ? 70 : 0;
            return R !== F.e && (F.e = e(d, "opacity", R, F.e)), P !== F.t && (F.t = e(d, "scaleX", P, F.t)), D !== F.a && (F.a = e(d, "scaleY", D, F.a)), te !== F.o && (F.o = e(d, "rotation", te, F.o)), Z !== F.i && (F.i = e(d, "translationX", Z, F.i)), F;
          }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined }), a;
        })(), (() => {
          var a = o("button");
          return e(a, "onClick", () => r(!t())), z((d) => e(a, "label", t() ? "Reset" : "Animate", d)), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "opacity + scale + rotation + translation tween together \u2014 JS only flips one signal; the whole tween runs host-side."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), E), y(I, O(B, { title: "Cold-prop tween \u2014 colour \xB7 radius \xB7 padding", get children() {
        return [(() => {
          var a = o("box"), d = o("text");
          return f(a, d), e(a, "animate", { duration: 400, curve: "easeInOut" }), e(a, "width", "fill"), e(d, "label", "AnimatedContainer tweens these host-side"), e(d, "fontSize", 12), e(d, "color", "#FFFFFFFF"), z((F) => {
            var R = i() ? gt : Ee, P = i() ? 32 : 8, D = i() ? 28 : 12;
            return R !== F.e && (F.e = e(a, "background", R, F.e)), P !== F.t && (F.t = e(a, "cornerRadius", P, F.t)), D !== F.a && (F.a = e(a, "padding", D, F.a)), F;
          }, { e: undefined, t: undefined, a: undefined }), a;
        })(), (() => {
          var a = o("button");
          return e(a, "onClick", () => l(!i())), z((d) => e(a, "label", i() ? "Reset" : "Animate", d)), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "background, cornerRadius and padding are cold props \u2014 the host's AnimatedContainer tweens them; JS writes each value once."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), E), y(I, O(B, { title: "Looping \u2014 repeat \xB7 reverse", get children() {
        return [(() => {
          var a = o("row"), d = o("box"), F = o("box"), R = o("box");
          return f(a, d), f(a, F), f(a, R), e(a, "gap", 20), e(d, "width", 44), e(d, "height", 44), e(d, "background", "#FF5E5CE6"), e(d, "cornerRadius", 22), e(d, "animate", { duration: 800, curve: "easeInOut", repeat: true, reverse: true }), e(d, "scaleX", 1.35), e(d, "scaleY", 1.35), e(F, "width", 44), e(F, "height", 44), e(F, "background", "#FF34C759"), e(F, "cornerRadius", 10), e(F, "animate", { duration: 1400, repeat: true }), e(F, "rotation", 6.2832), e(R, "width", 44), e(R, "height", 44), e(R, "background", "#FFFF9F0A"), e(R, "cornerRadius", 22), e(R, "animate", { duration: 900, curve: "easeInOut", repeat: true, reverse: true }), e(R, "opacity", 0.25), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "A pulse, a spin and a breathe \u2014 each loops forever host-side; JS set the endpoints once and never touches them again."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), E), y(I, O(B, { title: "Spring physics \u2014 animate.spring", get children() {
        return [(() => {
          var a = o("column"), d = o("box"), F = o("box"), R = o("box");
          return f(a, d), f(a, F), f(a, R), e(a, "gap", 10), e(d, "width", 48), e(d, "height", 48), e(d, "background", "#FF0A84FF"), e(d, "cornerRadius", 10), e(d, "animate", { duration: 700, spring: "gentle" }), e(F, "width", 48), e(F, "height", 48), e(F, "background", "#FF34C759"), e(F, "cornerRadius", 10), e(F, "animate", { duration: 700, spring: "bouncy" }), e(R, "width", 48), e(R, "height", 48), e(R, "background", "#FFFF9F0A"), e(R, "cornerRadius", 10), e(R, "animate", { duration: 700, spring: "stiff" }), z((P) => {
            var D = c() ? 150 : 0, te = c() ? 150 : 0, Z = c() ? 150 : 0;
            return D !== P.e && (P.e = e(d, "translationX", D, P.e)), te !== P.t && (P.t = e(F, "translationX", te, P.t)), Z !== P.a && (P.a = e(R, "translationX", Z, P.a)), P;
          }, { e: undefined, t: undefined, a: undefined }), a;
        })(), (() => {
          var a = o("button");
          return e(a, "onClick", () => h(!c())), z((d) => e(a, "label", c() ? "Back" : "Spring", d)), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "gentle \xB7 bouncy \xB7 stiff \u2014 three spring-like curves; bouncy overshoots and wobbles into place."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), E), y(I, O(B, { title: "Physics \u2014 real SpringSimulation (spring)", get children() {
        return [(() => {
          var a = o("column"), d = o("box"), F = o("box"), R = o("box");
          return f(a, d), f(a, F), f(a, R), e(a, "gap", 12), e(d, "width", 52), e(d, "height", 52), e(d, "background", "#FF0A84FF"), e(d, "cornerRadius", 12), e(d, "spring", "gentle"), e(F, "width", 52), e(F, "height", 52), e(F, "background", "#FF34C759"), e(F, "cornerRadius", 12), e(F, "spring", "bouncy"), e(R, "width", 52), e(R, "height", 52), e(R, "background", "#FFFF9F0A"), e(R, "cornerRadius", 12), e(R, "spring", "stiff"), z((P) => {
            var D = w(), te = w(), Z = w();
            return D !== P.e && (P.e = e(d, "translationX", D, P.e)), te !== P.t && (P.t = e(F, "translationX", te, P.t)), Z !== P.a && (P.a = e(R, "translationX", Z, P.a)), P;
          }, { e: undefined, t: undefined, a: undefined }), a;
        })(), (() => {
          var a = o("button");
          return e(a, "onClick", () => p(w() === 0 ? 175 : 0)), z((d) => e(a, "label", w() === 0 ? "Spring" : "Back", d)), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "A real SpringSimulation drives these \u2014 not a curve. Tap fast: the box retargets from its CURRENT position and velocity mid-flight, with no dead-stop restart. gentle settles, bouncy overshoots, stiff snaps."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), E), y(I, O(B, { title: "Physics \u2014 release momentum (draggable + release)", get children() {
        return [(() => {
          var a = o("box"), d = o("box"), F = o("text");
          return f(a, d), e(a, "height", 150), e(a, "background", "#FFEFEFF4"), e(a, "cornerRadius", 12), f(d, F), e(d, "draggable", true), e(d, "release", "glide"), e(d, "width", 60), e(d, "height", 60), e(d, "background", "#FF0A84FF"), e(d, "cornerRadius", 14), e(d, "onPanEnd", (R, P) => C(`${R.toFixed(0)}, ${P.toFixed(0)}`)), e(F, "label", "glide"), e(F, "fontSize", 11), e(F, "color", "#FFFFFFFF"), a;
        })(), (() => {
          var a = o("text");
          return e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), z((d) => e(a, "label", `Throw the blue box \u2014 friction carries it on after you let go and decelerates it to rest. Resting at ${A()}.`, d)), a;
        })(), (() => {
          var a = o("box"), d = o("box"), F = o("text");
          return f(a, d), e(a, "height", 150), e(a, "background", "#FFEFEFF4"), e(a, "cornerRadius", 12), f(d, F), e(d, "draggable", true), e(d, "release", "springBack"), e(d, "width", 60), e(d, "height", 60), e(d, "background", "#FF5E5CE6"), e(d, "cornerRadius", 14), e(F, "label", "spring"), e(F, "fontSize", 11), e(F, "color", "#FFFFFFFF"), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "Throw the purple box \u2014 a SpringSimulation springs it home to the origin, seeded with your fling velocity (throw harder \u2192 springs back harder). All host-side: zero per-frame bridge traffic."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), E), y(I, O(B, { title: "Cross-fade \u2014 CrossFade", get children() {
        return [(() => {
          var a = o("box"), d = o("crossFade");
          return f(a, d), e(a, "height", 92), y(d, (() => {
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
      } }), E), y(I, O(B, { title: "Animated list \u2014 AnimatedList", get children() {
        return [(() => {
          var a = o("animatedList");
          return e(a, "gap", 8), y(a, O(Q, { get each() {
            return N();
          }, children: (d) => (() => {
            var F = o("box"), R = o("text");
            return f(F, R), e(F, "background", "#FFEFEFF4"), e(F, "cornerRadius", 8), e(F, "padding", 12), e(R, "label", d), e(R, "fontSize", 13), e(R, "color", "#FF1C1C1E"), F;
          })() })), a;
        })(), (() => {
          var a = o("row"), d = o("button"), F = o("button");
          return f(a, d), f(a, F), e(a, "gap", 8), e(d, "label", "Add"), e(d, "onClick", () => _([...N(), `Item ${++b}`])), e(F, "label", "Remove"), e(F, "onClick", () => _(N().slice(0, -1))), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "Add \u2192 a row fades + expands in; Remove \u2192 it collapses + fades out. Both host-side, via deferred teardown."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), E), y(I, O(B, { title: "Shared element \u2014 Hero", get children() {
        return [(() => {
          var a = o("box");
          return e(a, "height", 300), e(a, "borderWidth", 1), e(a, "borderColor", "#FFE5E5EA"), e(a, "cornerRadius", 8), y(a, O(v.View, {})), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "A Hero with a matching tag on each screen flies between them across the navigator push \u2014 the navigator is a real Flutter Navigator."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), E), e(E, "label", "\u2014 end of animations \u2014"), e(E, "fontSize", 12), e(E, "color", "#FF8E8E93"), I;
    })();
  }
  function $i() {
    const [t, r] = L("material"), [i, l] = L(false), [c, h] = L(true), [w, p] = L(false), [A, C] = L(40), [x, T] = L(""), [N, _] = L("none yet"), [b, v] = L(0), [I, V] = L(["Item one", "Item two", "Item three", "Item four"]);
    let S = 0;
    const [E, a] = L([]), [d, F] = L([]), [R, P] = L("M"), [D, te] = L([]), [Z, le] = L(0), [ge, qe] = L(false), [Ke, Gt] = L(0), [Dr, Li] = L(0), [Wi, Vi] = L("0, 0"), [Bi, Ut] = L("\u2014"), [Ft, Mi] = L(1);
    let zr = 1;
    const [Hi, _t] = L("\u2014 try a dialog button \u2014"), [Gi, Lr] = L("\u2014 no date / time picked \u2014"), [Wr, Ui] = L(["First item", "Second item", "Third item", "Fourth item"]), Xi = Ht({ list: { component: (ue) => O(Ti, { get router() {
      return ue.router;
    } }), title: "Mailboxes" }, detail: (ue) => O(Pi, { get name() {
      return ue.params.name;
    }, get router() {
      return ue.router;
    } }) }, "list"), [Vr, Yi] = L(0), Xt = (ue, M) => {
      r(ue), l(M), Xn(ue, M ? 1 : 0);
    }, Ji = Ht({ home: { component: (ue) => ji(ue.router) }, animations: { component: () => O(Ci, {}), title: "Animations" } }, "home");
    function ji(ue) {
      return (() => {
        var M = o("scrollView"), Ze = o("text"), bt = o("text"), Y = o("text");
        return f(M, Ze), f(M, bt), f(M, Y), e(M, "background", "#FFF2F2F7"), e(M, "padding", 16), e(M, "gap", 14), e(Ze, "label", "Skal \u2014 Component Demo"), e(Ze, "fontSize", 24), e(Ze, "fontWeight", 800), e(Ze, "color", "#FF1C1C1E"), e(bt, "label", "Every fast-path widget, plus animation, the design system, and dialogs."), e(bt, "fontSize", 13), e(bt, "color", "#FF8E8E93"), y(M, O(B, { title: "Design system \u2014 setDesign()", get children() {
          return [(() => {
            var n = o("text");
            return e(n, "fontSize", 13), e(n, "color", "#FF8E8E93"), z((s) => e(n, "label", `active: ${t()} \xB7 ${i() ? "dark" : "light"}`, s)), n;
          })(), (() => {
            var n = o("row"), s = o("button"), u = o("button"), g = o("button");
            return f(n, s), f(n, u), f(n, g), e(n, "gap", 8), e(s, "label", "Material"), e(s, "onClick", () => Xt("material", i())), e(u, "label", "Cupertino"), e(u, "onClick", () => Xt("cupertino", i())), e(g, "onClick", () => Xt(t(), !i())), z((m) => e(g, "label", i() ? "Light mode" : "Dark mode", m)), n;
          })(), (() => {
            var n = o("text");
            return e(n, "label", "Buttons, switches, sliders, the text field & spinner all swap Material\u2194Cupertino."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })()];
        } }), Y), y(M, O(B, { title: "Layout \u2014 box \xB7 row \xB7 wrap", get children() {
          return [(() => {
            var n = o("row"), s = o("box"), u = o("box"), g = o("box");
            return f(n, s), f(n, u), f(n, g), e(n, "gap", 8), e(s, "width", 56), e(s, "height", 56), e(s, "background", "#FF0A84FF"), e(s, "cornerRadius", 10), e(u, "width", 56), e(u, "height", 56), e(u, "background", "#FF34C759"), e(u, "cornerRadius", 10), e(g, "width", 56), e(g, "height", 56), e(g, "background", "#FFFF9F0A"), e(g, "cornerRadius", 10), n;
          })(), (() => {
            var n = o("text");
            return e(n, "label", "Wrap \u2014 children flow onto new runs:"), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = o("wrap");
            return e(n, "gap", 6), y(n, O(Q, { each: ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa"], children: (s) => (() => {
              var u = o("box"), g = o("text");
              return f(u, g), e(u, "background", "#FFEFEFF4"), e(u, "cornerRadius", 12), e(u, "paddingLeft", 10), e(u, "paddingRight", 10), e(u, "paddingTop", 6), e(u, "paddingBottom", 6), e(g, "label", s), e(g, "fontSize", 12), e(g, "color", "#FF1C1C1E"), u;
            })() })), n;
          })()];
        } }), Y), y(M, O(B, { title: "Stack \u2014 overlap + positioned children", get children() {
          var n = o("stack"), s = o("box"), u = o("box"), g = o("text"), m = o("box");
          return f(n, s), f(n, u), f(n, m), e(n, "width", "fill"), e(n, "height", 120), e(s, "width", "fill"), e(s, "height", 120), e(s, "background", "#FF5E5CE6"), e(s, "cornerRadius", 12), f(u, g), e(u, "top", 10), e(u, "left", 10), e(u, "background", "#FFFFFFFF"), e(u, "cornerRadius", 8), e(u, "paddingLeft", 10), e(u, "paddingRight", 10), e(u, "paddingTop", 4), e(u, "paddingBottom", 4), e(g, "label", "top \xB7 left"), e(g, "fontSize", 11), e(g, "color", "#FF1C1C1E"), e(m, "bottom", 10), e(m, "right", 10), e(m, "width", 30), e(m, "height", 30), e(m, "background", "#FFFF3B30"), e(m, "cornerRadius", 15), n;
        } }), Y), y(M, O(B, { title: "Text & RichText", get children() {
          return [(() => {
            var n = o("text");
            return e(n, "label", "Styled text \u2014 18sp, weight 700."), e(n, "fontSize", 18), e(n, "fontWeight", 700), e(n, "color", "#FF1C1C1E"), n;
          })(), (() => {
            var n = o("richText"), s = o("text"), u = o("text"), g = o("text"), m = o("text"), W = o("text");
            return f(n, s), f(n, u), f(n, g), f(n, m), f(n, W), e(s, "label", "Rich text "), e(s, "fontSize", 16), e(s, "color", "#FF1C1C1E"), e(u, "label", "mixes "), e(u, "fontSize", 16), e(u, "color", "#FF0A84FF"), e(u, "fontWeight", 800), e(g, "label", "size, "), e(g, "fontSize", 22), e(g, "color", "#FFFF3B30"), e(g, "fontWeight", 700), e(m, "label", "weight "), e(m, "fontSize", 16), e(m, "color", "#FF34C759"), e(m, "fontWeight", 800), e(W, "label", "and colour inline."), e(W, "fontSize", 16), e(W, "color", "#FF1C1C1E"), n;
          })()];
        } }), Y), y(M, O(B, { title: "Image \u2014 network \xB7 BoxFit \xB7 rounded", get children() {
          return [(() => {
            var n = o("image");
            return e(n, "src", "https://picsum.photos/seed/skal/640/360"), e(n, "width", "fill"), e(n, "height", 160), e(n, "contentScale", 1), e(n, "cornerRadius", 12), n;
          })(), (() => {
            var n = o("text");
            return e(n, "label", "contentScale=1 (cover); cornerRadius clips the pixels. Requires network."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })()];
        } }), Y), y(M, O(B, { title: "Scrolling \u2014 horizontal list \xB7 lazy grid \xB7 reorderable", get children() {
          return [(() => {
            var n = o("text");
            return e(n, "label", "listView axis=1 (horizontal, virtualized):"), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = o("listView");
            return e(n, "axis", 1), e(n, "height", 66), e(n, "gap", 8), y(n, O(Q, { each: [Ee, Te, We, Ve, gt, "#FF00C7BE", "#FFAF52DE", "#FFFFD60A"], children: (s) => (() => {
              var u = o("box");
              return e(u, "width", 66), e(u, "height", 50), e(u, "background", s), e(u, "cornerRadius", 10), u;
            })() })), n;
          })(), (() => {
            var n = o("text");
            return e(n, "label", "lazyGrid \u2014 crossAxisCount=4:"), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = o("lazyGrid");
            return e(n, "crossAxisCount", 4), e(n, "aspectRatio", 1), e(n, "gap", 8), e(n, "height", 150), y(n, O(Q, { get each() {
              return Array.from({ length: 12 }, (s, u) => u);
            }, children: (s) => (() => {
              var u = o("box");
              return e(u, "background", s % 3 === 0 ? Ee : s % 3 === 1 ? Te : We), e(u, "cornerRadius", 8), u;
            })() })), n;
          })(), (() => {
            var n = o("text");
            return e(n, "label", "reorderableListView \u2014 drag a row to reorder:"), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = o("reorderableListView");
            return e(n, "height", 200), e(n, "gap", 6), e(n, "onReorder", (s, u) => {
              const g = Wr().slice(), [m] = g.splice(s, 1);
              g.splice(u, 0, m), Ui(g);
            }), y(n, O(Q, { get each() {
              return Wr();
            }, children: (s) => (() => {
              var u = o("box"), g = o("text");
              return f(u, g), e(u, "background", "#FFEFEFF4"), e(u, "cornerRadius", 8), e(u, "padding", 12), e(g, "label", s), e(g, "fontSize", 13), e(g, "color", "#FF1C1C1E"), u;
            })() })), n;
          })()];
        } }), Y), y(M, O(B, { title: "Controls \u2014 switch \xB7 checkbox \xB7 slider \xB7 text field", get children() {
          return [(() => {
            var n = o("row"), s = o("switch"), u = o("text");
            return f(n, s), f(n, u), e(n, "gap", 12), e(s, "onChange", (g) => h(g)), e(u, "fontSize", 13), e(u, "color", "#FF1C1C1E"), z((g) => {
              var m = c(), W = c() ? "switch: on" : "switch: off";
              return m !== g.e && (g.e = e(s, "checked", m, g.e)), W !== g.t && (g.t = e(u, "label", W, g.t)), g;
            }, { e: undefined, t: undefined }), n;
          })(), (() => {
            var n = o("row"), s = o("checkbox"), u = o("text");
            return f(n, s), f(n, u), e(n, "gap", 12), e(s, "onChange", (g) => p(g)), e(u, "fontSize", 13), e(u, "color", "#FF1C1C1E"), z((g) => {
              var m = w(), W = w() ? "checkbox: checked" : "checkbox: unchecked";
              return m !== g.e && (g.e = e(s, "checked", m, g.e)), W !== g.t && (g.t = e(u, "label", W, g.t)), g;
            }, { e: undefined, t: undefined }), n;
          })(), (() => {
            var n = o("slider");
            return e(n, "min", 0), e(n, "max", 100), e(n, "onChange", (s) => C(s)), z((s) => e(n, "value", A(), s)), n;
          })(), (() => {
            var n = o("text");
            return e(n, "fontSize", 13), e(n, "color", "#FF1C1C1E"), z((s) => e(n, "label", `slider: ${Math.round(A())}`, s)), n;
          })(), (() => {
            var n = o("textInput");
            return e(n, "placeholder", "Type your name\u2026"), e(n, "onChange", (s) => T(s)), e(n, "onSubmit", (s) => Sr(`Submitted: ${s}`)), z((s) => e(n, "value", x(), s)), n;
          })(), (() => {
            var n = o("text");
            return e(n, "fontSize", 13), e(n, "color", "#FF8E8E93"), z((s) => e(n, "label", x() ? `Hello, ${x()}!` : "\u2014 type above; press Enter to submit \u2014", s)), n;
          })()];
        } }), Y), y(M, O(B, { title: "Indicators \u2014 spinner \xB7 progress bar", get children() {
          return [(() => {
            var n = o("row"), s = o("activityIndicator"), u = o("text");
            return f(n, s), f(n, u), e(n, "gap", 12), e(s, "color", "#FF0A84FF"), e(u, "label", "CircularProgressIndicator"), e(u, "fontSize", 13), e(u, "color", "#FF1C1C1E"), n;
          })(), (() => {
            var n = o("text");
            return e(n, "label", "determinate \u2014 tracks the slider above:"), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = o("progressBar");
            return e(n, "color", "#FF0A84FF"), z((s) => e(n, "progress", A() / 100, s)), n;
          })(), (() => {
            var n = o("text");
            return e(n, "label", "indeterminate:"), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = o("progressBar");
            return e(n, "color", "#FF34C759"), n;
          })()];
        } }), Y), y(M, O(B, { title: "Animation", get children() {
          return [(() => {
            var n = o("text");
            return e(n, "label", "Implicit tweens, looping, list enter/exit, Hero \u2014 all host-side, zero per-frame bridge traffic. Opens a dedicated page."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = o("button");
            return e(n, "label", "Open Animations \u2192"), e(n, "onClick", () => ue.navigate("animations")), n;
          })()];
        } }), Y), y(M, O(B, { title: "ListTile \u2014 structured rows", get children() {
          return [(() => {
            var n = o("box"), s = o("column"), u = o("listTile"), g = o("listTile"), m = o("listTile");
            return f(n, s), e(n, "background", "#FFFFFFFF"), e(n, "cornerRadius", 12), e(n, "borderWidth", 1), e(n, "borderColor", "#FFE5E5EA"), f(s, u), f(s, g), f(s, m), e(s, "padding", 0), e(s, "gap", 0), e(u, "leadingIcon", "person"), e(u, "title", "Profile"), e(u, "subtitle", "Name, photo, bio"), e(u, "trailingIcon", "explore"), e(u, "onClick", () => _("tapped Profile")), e(g, "leadingIcon", "bell"), e(g, "title", "Notifications"), e(g, "subtitle", "Sounds, badges, alerts"), e(g, "trailingIcon", "explore"), e(g, "onClick", () => _("tapped Notifications")), e(m, "leadingIcon", "settings"), e(m, "title", "Settings"), e(m, "trailingIcon", "explore"), e(m, "onClick", () => _("tapped Settings")), n;
          })(), (() => {
            var n = o("text");
            return e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), z((s) => e(n, "label", `last row: ${N()}`, s)), n;
          })()];
        } }), Y), y(M, O(B, { title: "PageView \u2014 swipe between pages", get children() {
          return [(() => {
            var n = o("box"), s = o("pageView"), u = o("box"), g = o("text"), m = o("box"), W = o("text"), G = o("box"), q = o("text");
            return f(n, s), e(n, "height", 140), f(s, u), f(s, m), f(s, G), e(s, "onChange", (j) => v(j)), f(u, g), e(u, "width", "fill"), e(u, "height", 140), e(u, "background", "#FF0A84FF"), e(u, "cornerRadius", 12), e(u, "padding", 20), e(g, "label", "Page 1 \u2014 swipe \u2192"), e(g, "fontSize", 16), e(g, "fontWeight", 800), e(g, "color", "#FFFFFFFF"), f(m, W), e(m, "width", "fill"), e(m, "height", 140), e(m, "background", "#FF34C759"), e(m, "cornerRadius", 12), e(m, "padding", 20), e(W, "label", "Page 2"), e(W, "fontSize", 16), e(W, "fontWeight", 800), e(W, "color", "#FFFFFFFF"), f(G, q), e(G, "width", "fill"), e(G, "height", 140), e(G, "background", "#FFFF9F0A"), e(G, "cornerRadius", 12), e(G, "padding", 20), e(q, "label", "Page 3"), e(q, "fontSize", 16), e(q, "fontWeight", 800), e(q, "color", "#FFFFFFFF"), z((j) => e(s, "activeTab", b(), j)), n;
          })(), (() => {
            var n = o("row"), s = o("button"), u = o("button");
            return f(n, s), f(n, u), e(n, "gap", 8), e(s, "label", "\u25C0 Prev"), e(s, "onClick", () => v(Math.max(0, b() - 1))), e(u, "label", "Next \u25B6"), e(u, "onClick", () => v(Math.min(2, b() + 1))), n;
          })(), (() => {
            var n = o("text");
            return e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), z((s) => e(n, "label", `page ${b() + 1} of 3 \u2014 swipe or use the buttons`, s)), n;
          })()];
        } }), Y), y(M, O(B, { title: "Pull-to-refresh + swipe-to-dismiss", get children() {
          return [(() => {
            var n = o("box"), s = o("listView");
            return f(n, s), e(n, "height", 210), e(n, "borderWidth", 1), e(n, "borderColor", "#FFE5E5EA"), e(n, "cornerRadius", 8), e(s, "onRefresh", async () => {
              await new Promise((u) => setTimeout(u, 900)), V([`Fresh item ${++S}`, ...I()]);
            }), y(s, O(Q, { get each() {
              return I();
            }, children: (u) => (() => {
              var g = o("dismissible"), m = o("box"), W = o("text");
              return f(g, m), e(g, "onDismiss", () => V(I().filter((G) => G !== u))), f(m, W), e(m, "width", "fill"), e(m, "background", "#FFEFEFF4"), e(m, "cornerRadius", 8), e(m, "padding", 14), e(W, "label", u), e(W, "fontSize", 13), e(W, "color", "#FF1C1C1E"), g;
            })() })), n;
          })(), (() => {
            var n = o("text");
            return e(n, "label", "Pull the list down to refresh (a 900ms async task \u2014 the spinner waits for it); swipe any row sideways to dismiss it."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })()];
        } }), Y), y(M, O(B, { title: "Slivers \u2014 collapsing header (CustomScrollView)", get children() {
          return [(() => {
            var n = o("box"), s = o("customScrollView"), u = o("sliverAppBar"), g = o("box"), m = o("text"), W = o("sliverList"), G = o("sliverGrid");
            return f(n, s), e(n, "height", 340), e(n, "borderWidth", 1), e(n, "borderColor", "#FFE5E5EA"), e(n, "cornerRadius", 8), f(s, u), f(s, W), f(s, G), f(u, g), e(u, "title", "Collapsing header"), e(u, "height", 170), e(u, "sliverMode", "pinned"), e(u, "background", "#FF0A84FF"), f(g, m), e(g, "width", "fill"), e(g, "height", 170), e(g, "background", "#FF5E5CE6"), e(g, "padding", 20), e(m, "label", "Parallax background"), e(m, "fontSize", 18), e(m, "fontWeight", 800), e(m, "color", "#FFFFFFFF"), y(W, O(Q, { each: ["One", "Two", "Three", "Four", "Five"], children: (q) => (() => {
              var j = o("box"), se = o("text");
              return f(j, se), e(j, "width", "fill"), e(j, "background", "#FFFFFFFF"), e(j, "padding", 16), e(j, "borderWidth", 1), e(j, "borderColor", "#FFE5E5EA"), e(se, "label", `Row ${q}`), e(se, "fontSize", 14), e(se, "color", "#FF1C1C1E"), j;
            })() })), e(G, "crossAxisCount", 3), e(G, "aspectRatio", 1), e(G, "gap", 8), y(G, O(Q, { each: [Ee, Te, We, Ve, gt, Ee, Te, We, Ve], children: (q) => (() => {
              var j = o("box");
              return e(j, "background", q), e(j, "cornerRadius", 10), j;
            })() })), n;
          })(), (() => {
            var n = o("text");
            return e(n, "label", "Scroll the panel up \u2014 the purple header collapses into a pinned blue bar. The SliverList builds rows lazily; non-sliver children would auto-wrap in a SliverToBoxAdapter."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })()];
        } }), Y), y(M, O(B, { title: "Canvas \u2014 CustomPaint 2-D drawing", get children() {
          return [(() => {
            var n = o("box"), s = o("canvas");
            return f(n, s), e(n, "background", "#FFFFFFFF"), e(n, "cornerRadius", 12), e(n, "borderWidth", 1), e(n, "borderColor", "#FFE5E5EA"), e(n, "padding", 10), e(s, "width", 300), e(s, "height", 170), e(s, "draw", (u) => {
              u.strokeStyle(mi).lineWidth(2).beginPath().moveTo(16, 150).lineTo(284, 150).stroke(), [50, 95, 70, A() + 10, 80].forEach((g, m) => {
                u.fillStyle(m === 3 ? Ee : Ve).fillRect(28 + m * 52, 150 - g, 34, g);
              }), u.fillStyle(Te).beginPath().circle(252, 44, 22).fill(), u.fillStyle(Ri).fontSize(12).fillText("bars \xB7 circle \xB7 path \xB7 text", 18, 22), E().forEach((g) => {
                u.fillStyle(g.color).beginPath().circle(g.x, g.y, g.r).fill();
              });
            }), n;
          })(), (() => {
            var n = o("row"), s = o("button"), u = o("button");
            return f(n, s), f(n, u), e(n, "gap", 8), e(s, "label", "Draw a shape"), e(s, "onClick", () => a([...E(), { x: 24 + Math.random() * 252, y: 16 + Math.random() * 120, r: 8 + Math.random() * 20, color: [Ee, Te, We, gt, Ve][Math.floor(Math.random() * 5)] }])), e(u, "label", "Clear"), e(u, "onClick", () => a([])), n;
          })(), (() => {
            var n = o("text");
            return e(n, "label", "Bars, a circle, a stroked path, text. The 4th bar tracks the Controls slider; the buttons append/clear circles \u2014 each click flips the canvasShapes signal, so the draw callback re-records and the host repaints. Static drawings cross the bridge exactly once."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })()];
        } }), Y), y(M, O(B, { title: "Drag-and-drop \u2014 DragItem onto DropZone", get children() {
          return [(() => {
            var n = o("row");
            return e(n, "gap", 8), y(n, O(Q, { each: ["Apple", "Banana", "Cherry"], children: (s) => (() => {
              var u = o("dragItem"), g = o("box"), m = o("text");
              return f(u, g), e(u, "dragData", s), f(g, m), e(g, "background", "#FF5E5CE6"), e(g, "cornerRadius", 20), e(g, "padding", 12), e(m, "label", s), e(m, "fontSize", 13), e(m, "color", "#FFFFFFFF"), u;
            })() })), n;
          })(), (() => {
            var n = o("dropZone"), s = o("box"), u = o("text");
            return f(n, s), e(n, "onDrop", (g) => F([...d(), g])), f(s, u), e(s, "width", "fill"), e(s, "height", 90), e(s, "background", "#FFEFEFF4"), e(s, "cornerRadius", 12), e(s, "padding", 16), e(u, "fontSize", 13), e(u, "color", "#FF1C1C1E"), z((g) => e(u, "label", d().length ? `Basket: ${d().join(", ")}` : "Drag a chip into this zone", g)), n;
          })(), (() => {
            var n = o("row"), s = o("button");
            return f(n, s), e(n, "gap", 8), e(s, "label", "Clear basket"), e(s, "onClick", () => F([])), n;
          })(), (() => {
            var n = o("text");
            return e(n, "label", "Drag a fruit chip onto the zone \u2014 it highlights host-side while you hover; on release onDrop fires with the chip's dragData string. The whole drag is host-side; only the drop crosses the bridge."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })()];
        } }), Y), y(M, O(B, { title: "More controls \u2014 radio \xB7 chip \xB7 segmented \xB7 accordion", get children() {
          return [(() => {
            var n = o("row");
            return e(n, "gap", 16), y(n, O(Q, { each: ["S", "M", "L"], children: (s) => (() => {
              var u = o("row"), g = o("radio"), m = o("text");
              return f(u, g), f(u, m), e(u, "gap", 2), e(g, "onChange", () => P(s)), e(m, "label", s), e(m, "fontSize", 13), e(m, "color", "#FF1C1C1E"), z((W) => e(g, "checked", R() === s, W)), u;
            })() })), n;
          })(), (() => {
            var n = o("row");
            return e(n, "gap", 8), y(n, O(Q, { each: ["Red", "Green", "Blue"], children: (s) => (() => {
              var u = o("chip");
              return e(u, "label", s), e(u, "onChange", (g) => te(g ? [...D(), s] : D().filter((m) => m !== s))), z((g) => e(u, "checked", D().includes(s), g)), u;
            })() })), n;
          })(), (() => {
            var n = o("segmentedButton"), s = o("text"), u = o("text"), g = o("text");
            return f(n, s), f(n, u), f(n, g), e(n, "onChange", (m) => le(m)), e(s, "label", "Day"), e(s, "fontSize", 13), e(u, "label", "Week"), e(u, "fontSize", 13), e(g, "label", "Month"), e(g, "fontSize", 13), z((m) => e(n, "activeTab", Z(), m)), n;
          })(), (() => {
            var n = o("row"), s = o("text"), u = o("dropdown"), g = o("text"), m = o("text"), W = o("text");
            return f(n, s), f(n, u), e(n, "gap", 8), e(s, "label", "Priority"), e(s, "fontSize", 13), e(s, "color", "#FF1C1C1E"), f(u, g), f(u, m), f(u, W), e(u, "onChange", (G) => Gt(G)), e(g, "label", "Low"), e(g, "fontSize", 13), e(m, "label", "Medium"), e(m, "fontSize", 13), e(W, "label", "High"), e(W, "fontSize", 13), z((G) => e(u, "activeTab", Ke(), G)), n;
          })(), (() => {
            var n = o("box"), s = o("expansionTile"), u = o("box"), g = o("text");
            return f(n, s), e(n, "background", "#FFFFFFFF"), e(n, "cornerRadius", 8), e(n, "borderWidth", 1), e(n, "borderColor", "#FFE5E5EA"), f(s, u), e(s, "title", "Details"), e(s, "onChange", (m) => qe(m)), f(u, g), e(u, "padding", 14), e(u, "background", "#FFEFEFF4"), e(g, "label", "Body content revealed by the accordion \u2014 host-owned open state, host-side expand animation."), e(g, "fontSize", 12), e(g, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = o("text");
            return e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), z((s) => e(n, "label", `size ${R()} \xB7 chips ${D().join("/") || "\u2014"} \xB7 segment ${["Day", "Week", "Month"][Z()]} \xB7 priority ${["Low", "Medium", "High"][Ke()]} \xB7 details ${ge() ? "open" : "closed"}`, s)), n;
          })()];
        } }), Y), y(M, O(B, { title: "Stepper \u2014 multi-step flow", get children() {
          return [(() => {
            var n = o("stepper"), s = o("step"), u = o("text"), g = o("step"), m = o("text"), W = o("step"), G = o("text");
            return f(n, s), f(n, g), f(n, W), e(n, "onChange", (q) => Li(q)), f(s, u), e(s, "title", "Account"), e(u, "label", "Create your account \u2014 name, email, password."), e(u, "fontSize", 12), e(u, "color", "#FF8E8E93"), f(g, m), e(g, "title", "Profile"), e(m, "label", "Add a photo and a short bio."), e(m, "fontSize", 12), e(m, "color", "#FF8E8E93"), f(W, G), e(W, "title", "Done"), e(G, "label", "All set \u2014 review and finish."), e(G, "fontSize", 12), e(G, "color", "#FF8E8E93"), z((q) => e(n, "activeTab", Dr(), q)), n;
          })(), (() => {
            var n = o("text");
            return e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), z((s) => e(n, "label", `current step: ${Dr() + 1} of 3`, s)), n;
          })()];
        } }), Y), y(M, O(B, { title: "BottomSheet \u2014 draggable / expandable", get children() {
          var n = o("box"), s = o("stack"), u = o("box"), g = o("text"), m = o("bottomSheet"), W = o("box"), G = o("text");
          return f(n, s), e(n, "height", 300), e(n, "cornerRadius", 12), e(n, "background", "#FFEFEFF4"), f(s, u), f(s, m), f(u, g), e(u, "width", "fill"), e(u, "height", "fill"), e(u, "padding", 16), e(g, "label", "A DraggableScrollableSheet \u2014 drag the sheet up, or scroll its list past the edge to expand it."), e(g, "fontSize", 12), e(g, "color", "#FF8E8E93"), f(m, W), e(m, "initialSize", 0.4), e(m, "minSize", 0.18), e(m, "maxSize", 0.95), e(m, "background", "#FFFFFFFF"), f(W, G), e(W, "padding", 16), e(G, "label", "Sheet content \u2014 drag or scroll"), e(G, "fontSize", 15), e(G, "fontWeight", 700), e(G, "color", "#FF1C1C1E"), y(m, O(Q, { each: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta"], children: (q) => (() => {
            var j = o("box"), se = o("text");
            return f(j, se), e(j, "padding", 14), e(se, "label", q), e(se, "fontSize", 14), e(se, "color", "#FF1C1C1E"), j;
          })() }), null), n;
        } }), Y), y(M, O(B, { title: "Gestures \u2014 onTap \xB7 onLongPress \xB7 onDoubleTap", get children() {
          return [(() => {
            var n = o("box"), s = o("text");
            return f(n, s), e(n, "background", "#FFEFEFF4"), e(n, "cornerRadius", 12), e(n, "padding", 22), e(n, "onTap", () => _("onTap")), e(n, "onLongPress", () => _("onLongPress")), e(n, "onDoubleTap", () => _("onDoubleTap")), e(s, "label", "Tap / long-press / double-tap this box"), e(s, "fontSize", 13), e(s, "color", "#FF1C1C1E"), n;
          })(), (() => {
            var n = o("text");
            return e(n, "fontSize", 12), e(n, "color", "#FF8E8E93"), z((s) => e(n, "label", `last gesture: ${N()}`, s)), n;
          })()];
        } }), Y), y(M, O(B, { title: "Drag \u2014 draggable (zero per-frame bridge traffic)", get children() {
          return [(() => {
            var n = o("box"), s = o("box"), u = o("text");
            return f(n, s), e(n, "height", 150), e(n, "background", "#FFEFEFF4"), e(n, "cornerRadius", 12), f(s, u), e(s, "draggable", true), e(s, "width", 64), e(s, "height", 64), e(s, "background", "#FF0A84FF"), e(s, "cornerRadius", 14), e(s, "onPanEnd", (g, m) => Vi(`${g.toFixed(0)}, ${m.toFixed(0)}`)), e(u, "label", "drag"), e(u, "fontSize", 12), e(u, "color", "#FFFFFFFF"), n;
          })(), (() => {
            var n = o("text");
            return e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), z((s) => e(n, "label", `Drag the blue box \u2014 the host moves it itself, no event per frame. Resting offset: ${Wi()}`, s)), n;
          })()];
        } }), Y), y(M, O(B, { title: "Pan \u2014 onPanUpdate delta stream", get children() {
          return [(() => {
            var n = o("box"), s = o("text");
            return f(n, s), e(n, "height", 70), e(n, "background", "#FFEFEFF4"), e(n, "cornerRadius", 12), e(n, "padding", 16), e(n, "onPanStart", () => Ut("drag started")), e(n, "onPanUpdate", (u, g) => Ut(`dx ${u.toFixed(1)}  dy ${g.toFixed(1)}`)), e(n, "onPanEnd", (u, g) => Ut(`fling v ${u.toFixed(0)}, ${g.toFixed(0)} dp/s`)), e(s, "label", "Drag anywhere on this strip"), e(s, "fontSize", 13), e(s, "color", "#FF1C1C1E"), n;
          })(), (() => {
            var n = o("text");
            return e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), z((s) => e(n, "label", `onPanUpdate: ${Bi()}`, s)), n;
          })()];
        } }), Y), y(M, O(B, { title: "Scale \u2014 onScaleUpdate (pinch / rotate)", get children() {
          return [(() => {
            var n = o("box"), s = o("box"), u = o("text");
            return f(n, s), e(n, "height", 170), e(n, "background", "#FFEFEFF4"), e(n, "cornerRadius", 12), f(s, u), e(s, "width", 96), e(s, "height", 96), e(s, "background", "#FF5E5CE6"), e(s, "cornerRadius", 16), e(s, "onScaleStart", () => {
              zr = Ft();
            }), e(s, "onScaleUpdate", (g) => Mi(Math.max(0.3, zr * g))), e(u, "label", "pinch"), e(u, "fontSize", 13), e(u, "color", "#FFFFFFFF"), z((g) => {
              var m = Ft(), W = Ft();
              return m !== g.e && (g.e = e(s, "scaleX", m, g.e)), W !== g.t && (g.t = e(s, "scaleY", W, g.t)), g;
            }, { e: undefined, t: undefined }), n;
          })(), (() => {
            var n = o("text");
            return e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), z((s) => e(n, "label", `Pinch the purple box (two pointers / trackpad). Scale \xD7${Ft().toFixed(2)}`, s)), n;
          })()];
        } }), Y), y(M, O(B, { title: "Dialogs \u2014 imperative JS API", get children() {
          return [(() => {
            var n = o("row"), s = o("button"), u = o("button");
            return f(n, s), f(n, u), e(n, "gap", 8), e(s, "label", "Alert"), e(s, "onClick", async () => {
              await pr({ title: "Heads up", message: "A plain alert dialog.", actions: [{ label: "OK", value: "ok" }] }), _t("alert: dismissed");
            }), e(u, "label", "Confirm"), e(u, "onClick", async () => {
              _t(`confirm \u2192 ${await pr({ title: "Delete file?", message: "This cannot be undone.", actions: [{ label: "Cancel", value: "cancel" }, { label: "Delete", value: "delete", style: "destructive" }] }) ?? "dismissed"}`);
            }), n;
          })(), (() => {
            var n = o("row"), s = o("button"), u = o("button");
            return f(n, s), f(n, u), e(n, "gap", 8), e(s, "label", "Action sheet"), e(s, "onClick", async () => {
              _t(`sheet \u2192 ${await Jn({ title: "Choose an action", actions: [{ label: "Copy", value: "copy" }, { label: "Share", value: "share" }, { label: "Delete", value: "delete", style: "destructive" }] }) ?? "cancelled"}`);
            }), e(u, "label", "Snackbar"), e(u, "onClick", () => {
              Sr("Hello from a snackbar \uD83D\uDC4B"), _t("snackbar: shown");
            }), n;
          })(), (() => {
            var n = o("text");
            return e(n, "fontSize", 12), e(n, "color", "#FF8E8E93"), z((s) => e(n, "label", Hi(), s)), n;
          })()];
        } }), Y), y(M, O(B, { title: "Pickers \u2014 date \xB7 time", get children() {
          return [(() => {
            var n = o("row"), s = o("button"), u = o("button");
            return f(n, s), f(n, u), e(n, "gap", 8), e(s, "label", "Pick a date"), e(s, "onClick", async () => {
              Lr(`date \u2192 ${await jn({ initialDate: "2026-05-17" }) ?? "dismissed"}`);
            }), e(u, "label", "Pick a time"), e(u, "onClick", async () => {
              Lr(`time \u2192 ${await qn({ initialHour: 9, initialMinute: 30 }) ?? "dismissed"}`);
            }), n;
          })(), (() => {
            var n = o("text");
            return e(n, "fontSize", 12), e(n, "color", "#FF8E8E93"), z((s) => e(n, "label", Gi(), s)), n;
          })()];
        } }), Y), y(M, O(B, { title: "Navigation \u2014 push / pop with keep-alive", get children() {
          return [(() => {
            var n = o("text");
            return e(n, "label", "Tap a mailbox to push a screen; the AppBar back button (or system back) pops. Native transition; the screen behind stays mounted."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = o("box");
            return e(n, "height", 320), e(n, "borderWidth", 1), e(n, "borderColor", "#FFE5E5EA"), y(n, O(Xi.View, {})), n;
          })()];
        } }), Y), y(M, O(B, { title: "Tabs \u2014 bottom bar with keep-alive", get children() {
          return [(() => {
            var n = o("text");
            return e(n, "label", "Every tab subtree is built once and kept alive (IndexedStack) \u2014 switching never re-mounts; scroll & state survive."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = o("box"), s = o("tabs"), u = o("tab"), g = o("column"), m = o("text"), W = o("text"), G = o("tab"), q = o("column"), j = o("text"), se = o("textInput"), vt = o("tab"), Pe = o("column"), Qe = o("text"), Et = o("text");
            return f(n, s), e(n, "height", 280), e(n, "borderWidth", 1), e(n, "borderColor", "#FFE5E5EA"), e(n, "cornerRadius", 8), f(s, u), f(s, G), f(s, vt), e(s, "onChange", Yi), e(s, "height", "fill"), f(u, g), e(u, "title", "Home"), e(u, "icon", "home"), f(g, m), f(g, W), e(g, "background", "#FFF2F2F7"), e(g, "padding", 16), e(g, "gap", 8), e(g, "height", "fill"), e(m, "label", "Home"), e(m, "fontSize", 20), e(m, "fontWeight", 800), e(m, "color", "#FF1C1C1E"), e(W, "label", "Switch tabs and come back \u2014 this tab was never torn down."), e(W, "fontSize", 13), e(W, "color", "#FF8E8E93"), f(G, q), e(G, "title", "Search"), e(G, "icon", "search"), f(q, j), f(q, se), e(q, "background", "#FFF2F2F7"), e(q, "padding", 16), e(q, "gap", 8), e(q, "height", "fill"), e(j, "label", "Search"), e(j, "fontSize", 20), e(j, "fontWeight", 800), e(j, "color", "#FF1C1C1E"), e(se, "placeholder", "Type to search\u2026"), f(vt, Pe), e(vt, "title", "Profile"), e(vt, "icon", "person"), f(Pe, Qe), f(Pe, Et), e(Pe, "background", "#FFF2F2F7"), e(Pe, "padding", 16), e(Pe, "gap", 8), e(Pe, "height", "fill"), e(Qe, "label", "Profile"), e(Qe, "fontSize", 20), e(Qe, "fontWeight", 800), e(Qe, "color", "#FF1C1C1E"), e(Et, "fontSize", 13), e(Et, "color", "#FF8E8E93"), z((xe) => {
              var Br = Vr(), Mr = `active tab index: ${Vr()}`;
              return Br !== xe.e && (xe.e = e(s, "activeTab", Br, xe.e)), Mr !== xe.t && (xe.t = e(Et, "label", Mr, xe.t)), xe;
            }, { e: undefined, t: undefined }), n;
          })()];
        } }), Y), y(M, O(B, { title: "SafeArea", get children() {
          var n = o("safeArea"), s = o("box"), u = o("text");
          return f(n, s), f(s, u), e(s, "background", "#FFEFEFF4"), e(s, "cornerRadius", 8), e(s, "padding", 14), e(u, "label", "Insets past notches & system bars. (No visible effect here \u2014 the app root already applies one.)"), e(u, "fontSize", 12), e(u, "color", "#FF1C1C1E"), n;
        } }), Y), e(Y, "label", "\u2014 end of UI demo \u2014"), e(Y, "fontSize", 12), e(Y, "color", "#FF8E8E93"), M;
      })();
    }
    return O(Ji.View, {});
  }
  var yr = ["Just shipped a new feature, feeling great about how it turned out \uD83D\uDE80", "Hot take: the best APIs are the ones you don't have to read docs for", "Spent the morning refactoring legacy code \u2014 so much cleaner now", "There's no such thing as 'just a small change' in production code", "If your tests are slow, that's a smell. Fast tests = good tests", "Bun's startup time keeps surprising me, even after a year", "Why is naming things still the hardest part of programming?", "Found a 10\xD7 speedup in a critical path today. Profilers, not guesses", "Reading 'The Art of Unix Programming' for the third time", "Premature abstraction is somehow worse than premature optimization", "Latency is a feature, throughput is an artifact of how you measure", "Half of debugging is admitting your assumption was wrong", "You don't ship the codebase you have. You ship the codebase you understand", "Cache invalidation, naming things, off-by-one. The classics", "Every config file format eventually grows a turing-complete templating layer"], Oi = Array.from({ length: 15000 }, (t, r) => ({ author: `@user${r * 2654435761 >>> 17}`, body: yr[r % yr.length], num: r + 1 })), Ai = [50, 200, 500, 1000, 2000, 5000, 1e4], kr = "#FFF1F5F9", Ir = "#FF475569", yi = "#FF22C55E", ki = "#FFEF4444", Nr = "#FFFFFFFF";
  function Ii(t) {
    const [r, i] = L(0), [l, c] = L(false), [h, w] = L(0), [p, A] = L(false);
    return (() => {
      var C = o("column"), x = o("text"), T = o("text"), N = o("row"), _ = o("button"), b = o("button");
      return f(C, x), f(C, T), f(C, N), e(C, "background", "#FFFFFFFF"), e(C, "padding", 12), e(C, "cornerRadius", 10), e(C, "borderWidth", 1), e(C, "borderColor", "#FFE5E5EA"), e(C, "gap", 6), e(x, "fontWeight", 700), e(x, "fontSize", 14), e(x, "color", "#FF1DA1F2"), e(T, "fontSize", 14), e(T, "color", "#FF1F2937"), e(T, "maxLines", 3), e(T, "textOverflow", 1), f(N, _), f(N, b), e(N, "gap", 10), e(_, "fontSize", 12), e(_, "padding", 6), e(_, "cornerRadius", 16), e(_, "onClick", () => {
        const v = !l();
        c(v), i(r() + (v ? 1 : -1));
      }), e(b, "fontSize", 12), e(b, "padding", 6), e(b, "cornerRadius", 16), e(b, "onClick", () => {
        const v = !p();
        A(v), w(h() + (v ? 1 : -1));
      }), z((v) => {
        var I = `#${t.num} \xB7 ${t.author}`, V = t.body, S = `\u2665 ${r()}`, E = l() ? yi : kr, a = l() ? Nr : Ir, d = `\u21A9 ${h()}`, F = p() ? ki : kr, R = p() ? Nr : Ir;
        return I !== v.e && (v.e = e(x, "label", I, v.e)), V !== v.t && (v.t = e(T, "label", V, v.t)), S !== v.a && (v.a = e(_, "label", S, v.a)), E !== v.o && (v.o = e(_, "background", E, v.o)), a !== v.i && (v.i = e(_, "color", a, v.i)), d !== v.n && (v.n = e(b, "label", d, v.n)), F !== v.s && (v.s = e(b, "background", F, v.s)), R !== v.h && (v.h = e(b, "color", R, v.h)), v;
      }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined, n: undefined, s: undefined, h: undefined }), C;
    })();
  }
  function Ni() {
    const [t, r] = L(50), [i, l] = L(""), c = nt(() => Oi.slice(0, t()));
    return (() => {
      var h = o("listView"), w = o("text"), p = o("text"), A = o("wrap"), C = o("text");
      return f(h, w), f(h, p), f(h, A), f(h, C), e(h, "background", "#FFF2F2F7"), e(h, "padding", 16), e(h, "gap", 12), e(w, "label", "Tweet feed \u2014 virtualized"), e(w, "fontSize", 24), e(w, "fontWeight", 800), e(w, "color", "#FF1C1C1E"), e(p, "label", "ListView.builder materializes only the visible window; the source pool is 15 000 items. Tap a count to mount N."), e(p, "fontSize", 13), e(p, "color", "#FF8E8E93"), e(A, "gap", 6), y(A, O(Q, { each: Ai, children: (x) => (() => {
        var T = o("button");
        return e(T, "label", `${x}`), e(T, "onClick", () => {
          const N = performance.now();
          try {
            r(x), l(`mounted ${x} in ${(performance.now() - N).toFixed(2)} ms`);
          } catch (_) {
            l(`ERROR @ ${x}: ${_ && (_.message || String(_)) || "unknown"}`);
          }
        }), T;
      })() })), e(C, "fontSize", 12), e(C, "color", "#FF8E8E93"), y(h, O(Q, { get each() {
        return c();
      }, children: (x) => O(Ii, { get author() {
        return x.author;
      }, get body() {
        return x.body;
      }, get num() {
        return x.num;
      } }) }), null), z((x) => e(C, "label", i() || `showing ${t()} tweets`, x)), h;
    })();
  }
  function Di() {
    const [t, r] = L("\u2014 waiting for counter events \u2014"), i = wi(), [l, c] = L("\u2014 tap a button to RPC the Ticker \u2014"), [h, w] = L(null), [p, A] = L(false);
    return (() => {
      var C = o("scrollView"), x = o("text"), T = o("text"), N = o("text");
      return f(C, x), f(C, T), f(C, N), e(C, "background", "#FFF2F2F7"), e(C, "padding", 16), e(C, "gap", 14), e(x, "label", "Libraries \u2014 codegen-wrapped widgets"), e(x, "fontSize", 24), e(x, "fontWeight", 800), e(x, "color", "#FF1C1C1E"), e(T, "label", "Custom adapters + real pub.dev packages, brought into JSX by skal_codegen. Imported from 'skal-flutter'."), e(T, "fontSize", 13), e(T, "color", "#FF8E8E93"), y(C, O(B, { title: "Greeting \u2014 hand-written adapter", get children() {
        var _ = o("greeting");
        return e(_, "name", "Skal"), e(_, "color", "#FF1DA1F2"), e(_, "fontSize", 20), _;
      } }), N), y(C, O(B, { title: "Shimmer \u2014 pub.dev, named-ctor wrap", get children() {
        return [(() => {
          var _ = o("text");
          return e(_, "label", "ShimmerFromColors \u2014 codegen-synthesized from the Shimmer.fromColors named constructor."), e(_, "fontSize", 11), e(_, "color", "#FF8E8E93"), _;
        })(), (() => {
          var _ = o("shimmerFromColors"), b = o("greeting");
          return f(_, b), e(_, "baseColor", 4290624957), e(_, "highlightColor", 4292927712), e(_, "period", 1500), e(b, "name", "loading\u2026"), e(b, "color", "#FF333333"), e(b, "fontSize", 28), _;
        })()];
      } }), N), y(C, O(B, { title: "QR code \u2014 qr_flutter, pub.dev wrap", get children() {
        return [(() => {
          var _ = o("qrImageView");
          return e(_, "data", "https://skal.dev"), e(_, "size", 200), _;
        })(), (() => {
          var _ = o("text");
          return e(_, "label", "QrImageView, generated against qr_flutter's class."), e(_, "fontSize", 11), e(_, "color", "#FF8E8E93"), _;
        })()];
      } }), N), y(C, O(B, { title: "Camera \u2014 host-pattern wrap (controller lifecycle)", get children() {
        return [(() => {
          var _ = o("text");
          return e(_, "label", "A synthesized _CameraHost owns the CameraController (init in initState, dispose on unmount). The controller initializes only once Start mounts <Camera> \u2014 no camera / permission \u2192 an inline error banner."), e(_, "fontSize", 11), e(_, "color", "#FF8E8E93"), _;
        })(), (() => {
          var _ = o("button");
          return e(_, "onClick", () => A(!p())), z((b) => e(_, "label", p() ? "Stop camera" : "Start camera", b)), _;
        })(), Mt(() => Mt(() => !!p())() && (() => {
          var _ = o("box"), b = o("camera");
          return f(_, b), e(_, "background", "#FF000000"), e(_, "padding", 4), e(_, "cornerRadius", 8), e(b, "resolutionIndex", 1), _;
        })())];
      } }), N), y(C, O(B, { title: "Counter \u2014 typed callbacks back to JSX", get children() {
        return [(() => {
          var _ = o("counter");
          return e(_, "initial", 0), e(_, "onChanged", (b) => r(`onChanged(${b})`)), e(_, "onReset", () => r("onReset()")), _;
        })(), (() => {
          var _ = o("text");
          return e(_, "fontSize", 13), e(_, "color", "#FF1C1C1E"), z((b) => e(_, "label", t(), b)), _;
        })()];
      } }), N), y(C, O(B, { title: "Ticker \u2014 JS \u2192 Dart imperative RPC", get children() {
        return [(() => {
          var _ = o("ticker");
          return pi(i, _), e(_, "intervalMs", 500), _;
        })(), (() => {
          var _ = o("wrap"), b = o("button"), v = o("button"), I = o("button"), V = o("button"), S = o("button"), E = o("button"), a = o("button"), d = o("button");
          return f(_, b), f(_, v), f(_, I), f(_, V), f(_, S), f(_, E), f(_, a), f(_, d), e(_, "gap", 6), e(b, "label", "pause"), e(b, "onClick", async () => {
            await i.pause(), c("pause() \u2713");
          }), e(v, "label", "resume"), e(v, "onClick", async () => {
            await i.resume(), c("resume() \u2713");
          }), e(I, "label", "reset"), e(I, "onClick", async () => {
            await i.reset(), c("reset() \u2713");
          }), e(V, "label", "+10"), e(V, "onClick", async () => {
            await i.bump(10), c(`bump(10), now getValue() \u2192 ${await i.getValue()}`);
          }), e(S, "label", "read"), e(S, "onClick", async () => {
            c(`getValue() \u2192 ${await i.getValue()}, isPaused() \u2192 ${await i.isPaused()}`);
          }), e(E, "label", "describe"), e(E, "onClick", async () => {
            c(`describe() \u2192 ${await i.describe("hello from JSX")}`);
          }), e(a, "label", "snapshot"), e(a, "onClick", async () => {
            const F = await i.snapshot();
            c(`snapshot() \u2192 value=${F.value} paused=${F.paused} ts=${F.timestamp}`);
          }), e(d, "label", "sub/unsub"), e(d, "onClick", () => {
            if (h())
              h()(), w(() => null), c("unsubscribed from ticks$");
            else {
              const F = i.ticks$((R) => {
                c(`stream tick: ${R}`);
              });
              w(() => F), c("subscribed to ticks$ \u2014 wait for emissions\u2026");
            }
          }), _;
        })(), (() => {
          var _ = o("text");
          return e(_, "fontSize", 13), e(_, "color", "#FF1C1C1E"), z((b) => e(_, "label", l(), b)), _;
        })()];
      } }), N), y(C, O(B, { title: "Stickers \u2014 List<Widget> children + gradient prop", get children() {
        var _ = o("stickers"), b = o("greeting"), v = o("greeting"), I = o("greeting");
        return f(_, b), f(_, v), f(_, I), e(_, "gap", 6), e(_, "padding", 10), e(_, "gradient", { type: "linear", colors: ["#FFFFE082", "#FFB0F0D0", "#FFB0E0FF"], stops: [0, 0.5, 1], begin: "topLeft", end: "bottomRight" }), e(b, "name", "multi-child A"), e(b, "color", "#FF6B4F00"), e(b, "fontSize", 14), e(v, "name", "multi-child B"), e(v, "color", "#FF6B4F00"), e(v, "fontSize", 14), e(I, "name", "multi-child C"), e(I, "color", "#FF6B4F00"), e(I, "fontSize", 14), _;
      } }), N), e(N, "label", "\u2014 end of Libs demo \u2014"), e(N, "fontSize", 12), e(N, "color", "#FF8E8E93"), C;
    })();
  }
  function zi() {
    const [t, r] = L(0);
    return (() => {
      var i = o("tabs"), l = o("tab"), c = o("tab"), h = o("tab");
      return f(i, l), f(i, c), f(i, h), e(i, "onChange", r), e(i, "height", "fill"), e(l, "title", "UI"), e(l, "icon", "grid"), y(l, O($i, {})), e(c, "title", "List"), e(c, "icon", "list"), y(c, O(Ni, {})), e(h, "title", "Libs"), e(h, "icon", "explore"), y(h, O(Di, {})), z((w) => e(i, "activeTab", t(), w)), i;
    })();
  }
  Ei(() => O(zi, {}), Si);
})();
})
