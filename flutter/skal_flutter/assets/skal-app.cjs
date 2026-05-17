// @bun @bytecode @bun-cjs
(function(exports, require, module, __filename, __dirname) {// ../flutter/skal_flutter/assets/skal-app.js
(function() {
  var Z = { context: undefined, registry: undefined, effects: undefined, done: false, getContextId() {
    return Yt(this.context.count);
  }, getNextContextId() {
    return Yt(this.context.count++);
  } };
  function Yt(t) {
    const r = String(t), i = r.length - 1;
    return Z.context.id + (i ? String.fromCharCode(96 + i) : "") + r;
  }
  function pt(t) {
    Z.context = t;
  }
  function Br() {
    return { ...Z.context, id: Z.getNextContextId(), count: 0 };
  }
  var Mr = (t, r) => t === r, St = Symbol("solid-proxy"), Hr = typeof Proxy == "function", Gr = Symbol("solid-track"), Ze = { equals: Mr }, jt = null, Jt = nr, ae = 1, Ve = 2, qt = { owned: null, cleanups: null, context: null, owner: null }, G = null, O = null, Be = null, Ce = null, Y = null, q = null, te = null, Qe = 0;
  function et(t, r) {
    const i = Y, l = G, s = t.length === 0, h = r === undefined ? l : r, w = s ? qt : { owned: null, cleanups: null, context: h ? h.context : null, owner: h }, p = s ? t : () => t(() => Oe(() => Fe(w)));
    G = w, Y = null;
    try {
      return de(p, true);
    } finally {
      Y = i, G = l;
    }
  }
  function z(t, r) {
    r = r ? Object.assign({}, Ze, r) : Ze;
    const i = { value: t, observers: null, observerSlots: null, comparator: r.equals || undefined }, l = (s) => (typeof s == "function" && (O && O.running && O.sources.has(i) ? s = s(i.tValue) : s = s(i.value)), tr(i, s));
    return [er.bind(i), l];
  }
  function ge(t, r, i) {
    const l = Rt(t, r, false, ae);
    Be && O && O.running ? q.push(l) : Me(l);
  }
  function Kt(t, r, i) {
    Jt = Jr;
    const l = Rt(t, r, false, ae), s = wt && Xr(wt);
    s && (l.suspense = s), (!i || !i.render) && (l.user = true), te ? te.push(l) : Me(l);
  }
  function tt(t, r, i) {
    i = i ? Object.assign({}, Ze, i) : Ze;
    const l = Rt(t, r, true, 0);
    return l.observers = null, l.observerSlots = null, l.comparator = i.equals || undefined, Be && O && O.running ? (l.tState = ae, q.push(l)) : Me(l), er.bind(l);
  }
  function Oe(t) {
    if (!Ce && Y === null)
      return t();
    const r = Y;
    Y = null;
    try {
      return Ce ? Ce.untrack(t) : t();
    } finally {
      Y = r;
    }
  }
  function Zt(t) {
    return G === null || (G.cleanups === null ? G.cleanups = [t] : G.cleanups.push(t)), t;
  }
  function Ur(t) {
    if (O && O.running)
      return t(), O.done;
    const r = Y, i = G;
    return Promise.resolve().then(() => {
      Y = r, G = i;
      let l;
      return (Be || wt) && (l = O || (O = { sources: new Set, effects: [], promises: new Set, disposed: new Set, queue: new Set, running: true }), l.done || (l.done = new Promise((s) => l.resolve = s)), l.running = true), de(t, false), Y = G = null, l ? l.done : undefined;
    });
  }
  var [Mi, Qt] = z(false);
  function Xr(t) {
    let r;
    return G && G.context && (r = G.context[t.id]) !== undefined ? r : t.defaultValue;
  }
  var wt;
  function er() {
    const t = O && O.running;
    if (this.sources && (t ? this.tState : this.state))
      if ((t ? this.tState : this.state) === ae)
        Me(this);
      else {
        const r = q;
        q = null, de(() => rt(this), false), q = r;
      }
    if (Y) {
      const r = this.observers ? this.observers.length : 0;
      Y.sources ? (Y.sources.push(this), Y.sourceSlots.push(r)) : (Y.sources = [this], Y.sourceSlots = [r]), this.observers ? (this.observers.push(Y), this.observerSlots.push(Y.sources.length - 1)) : (this.observers = [Y], this.observerSlots = [Y.sources.length - 1]);
    }
    return t && O.sources.has(this) ? this.tValue : this.value;
  }
  function tr(t, r, i) {
    let l = O && O.running && O.sources.has(t) ? t.tValue : t.value;
    if (!t.comparator || !t.comparator(l, r)) {
      if (O) {
        const s = O.running;
        (s || !i && O.sources.has(t)) && (O.sources.add(t), t.tValue = r), s || (t.value = r);
      } else
        t.value = r;
      t.observers && t.observers.length && de(() => {
        for (let s = 0;s < t.observers.length; s += 1) {
          const h = t.observers[s], w = O && O.running;
          w && O.disposed.has(h) || ((w ? !h.tState : !h.state) && (h.pure ? q.push(h) : te.push(h), h.observers && ir(h)), w ? h.tState = ae : h.state = ae);
        }
        if (q.length > 1e6)
          throw q = [], new Error;
      }, false);
    }
    return r;
  }
  function Me(t) {
    if (!t.fn)
      return;
    Fe(t);
    const r = Qe;
    rr(t, O && O.running && O.sources.has(t) ? t.tValue : t.value, r), O && !O.running && O.sources.has(t) && queueMicrotask(() => {
      de(() => {
        O && (O.running = true), Y = G = t, rr(t, t.tValue, r), Y = G = null;
      }, false);
    });
  }
  function rr(t, r, i) {
    let l;
    const s = G, h = Y;
    Y = G = t;
    try {
      l = t.fn(r);
    } catch (w) {
      return t.pure && (O && O.running ? (t.tState = ae, t.tOwned && t.tOwned.forEach(Fe), t.tOwned = undefined) : (t.state = ae, t.owned && t.owned.forEach(Fe), t.owned = null)), t.updatedAt = i + 1, mt(w);
    } finally {
      Y = h, G = s;
    }
    (!t.updatedAt || t.updatedAt <= i) && (t.updatedAt != null && ("observers" in t) ? tr(t, l, true) : O && O.running && t.pure ? (O.sources.has(t) || (t.value = l), O.sources.add(t), t.tValue = l) : t.value = l, t.updatedAt = i);
  }
  function Rt(t, r, i, l = ae, s) {
    const h = { fn: t, state: l, updatedAt: null, owned: null, sources: null, sourceSlots: null, cleanups: null, value: r, owner: G, context: G ? G.context : null, pure: i };
    if (O && O.running && (h.state = 0, h.tState = l), G === null || G !== qt && (O && O.running && G.pure ? G.tOwned ? G.tOwned.push(h) : G.tOwned = [h] : G.owned ? G.owned.push(h) : G.owned = [h]), Ce && h.fn) {
      const w = h.fn, [p, A] = z(undefined, { equals: false }), C = Ce.factory(w, A);
      Zt(() => C.dispose());
      let x;
      const m = () => Ur(A).then(() => {
        x && (x.dispose(), x = undefined);
      });
      h.fn = (N) => (p(), O && O.running ? (x || (x = Ce.factory(w, m)), x.track(N)) : C.track(N));
    }
    return h;
  }
  function He(t) {
    const r = O && O.running;
    if ((r ? t.tState : t.state) === 0)
      return;
    if ((r ? t.tState : t.state) === Ve)
      return rt(t);
    if (t.suspense && Oe(t.suspense.inFallback))
      return t.suspense.effects.push(t);
    const i = [t];
    for (;(t = t.owner) && (!t.updatedAt || t.updatedAt < Qe); ) {
      if (r && O.disposed.has(t))
        return;
      (r ? t.tState : t.state) && i.push(t);
    }
    for (let l = i.length - 1;l >= 0; l--) {
      if (t = i[l], r) {
        let s = t, h = i[l + 1];
        for (;(s = s.owner) && s !== h; )
          if (O.disposed.has(s))
            return;
      }
      if ((r ? t.tState : t.state) === ae)
        Me(t);
      else if ((r ? t.tState : t.state) === Ve) {
        const s = q;
        q = null, de(() => rt(t, i[0]), false), q = s;
      }
    }
  }
  function de(t, r) {
    if (q)
      return t();
    let i = false;
    r || (q = []), te ? i = true : te = [], Qe++;
    try {
      const l = t();
      return Yr(i), l;
    } catch (l) {
      i || (te = null), q = null, mt(l);
    }
  }
  function Yr(t) {
    if (q && (Be && O && O.running ? jr(q) : nr(q), q = null), t)
      return;
    let r;
    if (O) {
      if (!O.promises.size && !O.queue.size) {
        const { sources: l, disposed: s } = O;
        te.push.apply(te, O.effects), r = O.resolve;
        for (const h of te)
          "tState" in h && (h.state = h.tState), delete h.tState;
        O = null, de(() => {
          for (const h of s)
            Fe(h);
          for (const h of l) {
            if (h.value = h.tValue, h.owned)
              for (let w = 0, p = h.owned.length;w < p; w++)
                Fe(h.owned[w]);
            h.tOwned && (h.owned = h.tOwned), delete h.tValue, delete h.tOwned, h.tState = 0;
          }
          Qt(false);
        }, false);
      } else if (O.running) {
        O.running = false, O.effects.push.apply(O.effects, te), te = null, Qt(true);
        return;
      }
    }
    const i = te;
    te = null, i.length && de(() => Jt(i), false), r && r();
  }
  function nr(t) {
    for (let r = 0;r < t.length; r++)
      He(t[r]);
  }
  function jr(t) {
    for (let r = 0;r < t.length; r++) {
      const i = t[r], l = O.queue;
      l.has(i) || (l.add(i), Be(() => {
        l.delete(i), de(() => {
          O.running = true, He(i);
        }, false), O && (O.running = false);
      }));
    }
  }
  function Jr(t) {
    let r, i = 0;
    for (r = 0;r < t.length; r++) {
      const l = t[r];
      l.user ? t[i++] = l : He(l);
    }
    if (Z.context) {
      if (Z.count) {
        Z.effects || (Z.effects = []), Z.effects.push(...t.slice(0, i));
        return;
      }
      pt();
    }
    for (Z.effects && (Z.done || !Z.count) && (t = [...Z.effects, ...t], i += Z.effects.length, delete Z.effects), r = 0;r < i; r++)
      He(t[r]);
  }
  function rt(t, r) {
    const i = O && O.running;
    i ? t.tState = 0 : t.state = 0;
    for (let l = 0;l < t.sources.length; l += 1) {
      const s = t.sources[l];
      if (s.sources) {
        const h = i ? s.tState : s.state;
        h === ae ? s !== r && (!s.updatedAt || s.updatedAt < Qe) && He(s) : h === Ve && rt(s, r);
      }
    }
  }
  function ir(t) {
    const r = O && O.running;
    for (let i = 0;i < t.observers.length; i += 1) {
      const l = t.observers[i];
      (r ? !l.tState : !l.state) && (r ? l.tState = Ve : l.state = Ve, l.pure ? q.push(l) : te.push(l), l.observers && ir(l));
    }
  }
  function Fe(t) {
    let r;
    if (t.sources)
      for (;t.sources.length; ) {
        const i = t.sources.pop(), l = t.sourceSlots.pop(), s = i.observers;
        if (s && s.length) {
          const h = s.pop(), w = i.observerSlots.pop();
          l < s.length && (h.sourceSlots[w] = l, s[l] = h, i.observerSlots[l] = w);
        }
      }
    if (t.tOwned) {
      for (r = t.tOwned.length - 1;r >= 0; r--)
        Fe(t.tOwned[r]);
      delete t.tOwned;
    }
    if (O && O.running && t.pure)
      or(t, true);
    else if (t.owned) {
      for (r = t.owned.length - 1;r >= 0; r--)
        Fe(t.owned[r]);
      t.owned = null;
    }
    if (t.cleanups) {
      for (r = t.cleanups.length - 1;r >= 0; r--)
        t.cleanups[r]();
      t.cleanups = null;
    }
    O && O.running ? t.tState = 0 : t.state = 0;
  }
  function or(t, r) {
    if (r || (t.tState = 0, O.disposed.add(t)), t.owned)
      for (let i = 0;i < t.owned.length; i++)
        or(t.owned[i]);
  }
  function qr(t) {
    return t instanceof Error ? t : new Error(typeof t == "string" ? t : "Unknown error", { cause: t });
  }
  function ar(t, r, i) {
    try {
      for (const l of r)
        l(t);
    } catch (l) {
      mt(l, i && i.owner || null);
    }
  }
  function mt(t, r = G) {
    const i = jt && r && r.context && r.context[jt], l = qr(t);
    if (!i)
      throw l;
    te ? te.push({ fn() {
      ar(l, i, r);
    }, state: ae }) : ar(l, i, r);
  }
  var Kr = Symbol("fallback");
  function lr(t) {
    for (let r = 0;r < t.length; r++)
      t[r]();
  }
  function Zr(t, r, i = {}) {
    let l = [], s = [], h = [], w = 0, p = r.length > 1 ? [] : null;
    return Zt(() => lr(h)), () => {
      let A = t() || [], C = A.length, x, m;
      return A[Gr], Oe(() => {
        let _, b, v, k, L, S, E, a, f;
        if (C === 0)
          w !== 0 && (lr(h), h = [], l = [], s = [], w = 0, p && (p = [])), i.fallback && (l = [Kr], s[0] = et((F) => (h[0] = F, i.fallback())), w = 1);
        else if (w === 0) {
          for (s = new Array(C), m = 0;m < C; m++)
            l[m] = A[m], s[m] = et(N);
          w = C;
        } else {
          for (v = new Array(C), k = new Array(C), p && (L = new Array(C)), S = 0, E = Math.min(w, C);S < E && l[S] === A[S]; S++)
            ;
          for (E = w - 1, a = C - 1;E >= S && a >= S && l[E] === A[a]; E--, a--)
            v[a] = s[E], k[a] = h[E], p && (L[a] = p[E]);
          for (_ = new Map, b = new Array(a + 1), m = a;m >= S; m--)
            f = A[m], x = _.get(f), b[m] = x === undefined ? -1 : x, _.set(f, m);
          for (x = S;x <= E; x++)
            f = l[x], m = _.get(f), m !== undefined && m !== -1 ? (v[m] = s[x], k[m] = h[x], p && (L[m] = p[x]), m = b[m], _.set(f, m)) : h[x]();
          for (m = S;m < C; m++)
            m in v ? (s[m] = v[m], h[m] = k[m], p && (p[m] = L[m], p[m](m))) : s[m] = et(N);
          s = s.slice(0, w = C), l = A.slice(0);
        }
        return s;
      });
      function N(_) {
        if (h[m] = _, p) {
          const [b, v] = z(m);
          return p[m] = v, r(A[m], b);
        }
        return r(A[m]);
      }
    };
  }
  var Qr = false;
  function en(t, r) {
    if (Qr && Z.context) {
      const i = Z.context;
      pt(Br());
      const l = Oe(() => t(r || {}));
      return pt(i), l;
    }
    return Oe(() => t(r || {}));
  }
  function nt() {
    return true;
  }
  var tn = { get(t, r, i) {
    return r === St ? i : t.get(r);
  }, has(t, r) {
    return r === St ? true : t.has(r);
  }, set: nt, deleteProperty: nt, getOwnPropertyDescriptor(t, r) {
    return { configurable: true, enumerable: true, get() {
      return t.get(r);
    }, set: nt, deleteProperty: nt };
  }, ownKeys(t) {
    return t.keys();
  } };
  function Tt(t) {
    return (t = typeof t == "function" ? t() : t) ? t : {};
  }
  function rn() {
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
      r = r || !!p && St in p, t[w] = typeof p == "function" ? (r = true, tt(p)) : p;
    }
    if (Hr && r)
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
      } }, tn);
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
        const m = Object.getOwnPropertyDescriptor(p, x);
        if (!l[x])
          l[x] = m.get ? { enumerable: true, configurable: true, get: rn.bind(i[x] = [m.get.bind(p)]) } : m.value !== undefined ? m : undefined;
        else {
          const N = i[x];
          N && (m.get ? N.push(m.get.bind(p)) : m.value !== undefined && N.push(() => m.value));
        }
      }
    }
    const s = {}, h = Object.keys(l);
    for (let w = h.length - 1;w >= 0; w--) {
      const p = h[w], A = l[p];
      A && A.get ? Object.defineProperty(s, p, A) : s[p] = A ? A.value : undefined;
    }
    return s;
  }
  function re(t) {
    const r = "fallback" in t && { fallback: () => t.fallback };
    return tt(Zr(() => t.each, t.children, r || undefined));
  }
  var nn = (t) => tt(() => t());
  function on({ createElement: t, createTextNode: r, isTextNode: i, replaceText: l, insertNode: s, removeNode: h, setProperty: w, getParentNode: p, getFirstChild: A, getNextSibling: C }) {
    function x(S, E, a, f) {
      if (a !== undefined && !f && (f = []), typeof E != "function")
        return m(S, E, f, a);
      ge((F) => m(S, E(), F, a), f);
    }
    function m(S, E, a, f, F) {
      for (;typeof a == "function"; )
        a = a();
      if (E === a)
        return a;
      const R = typeof E, T = f !== undefined;
      if (R === "string" || R === "number")
        if (R === "number" && (E = E.toString()), T) {
          let D = a[0];
          D && i(D) ? l(D, E) : D = r(E), a = b(S, a, f, D);
        } else
          a !== "" && typeof a == "string" ? l(A(S), a = E) : (b(S, a, f, r(E)), a = E);
      else if (E == null || R === "boolean")
        a = b(S, a, f);
      else {
        if (R === "function")
          return ge(() => {
            let D = E();
            for (;typeof D == "function"; )
              D = D();
            a = m(S, D, a, f);
          }), () => a;
        if (Array.isArray(E)) {
          const D = [];
          if (N(D, E, F))
            return ge(() => a = m(S, D, a, f, true)), () => a;
          if (D.length === 0) {
            const Q = b(S, a, f);
            if (T)
              return a = Q;
          } else
            Array.isArray(a) ? a.length === 0 ? v(S, D, f) : _(S, a, D) : a == null || a === "" ? v(S, D) : _(S, T && a || [A(S)], D);
          a = D;
        } else {
          if (Array.isArray(a)) {
            if (T)
              return a = b(S, a, f, E);
            b(S, a, null, E);
          } else
            a == null || a === "" || !A(S) ? s(S, E) : k(S, E, A(S));
          a = E;
        }
      }
      return a;
    }
    function N(S, E, a) {
      let f = false;
      for (let F = 0, R = E.length;F < R; F++) {
        let T = E[F], D;
        if (!(T == null || T === true || T === false))
          if (Array.isArray(T))
            f = N(S, T) || f;
          else if ((D = typeof T) == "string" || D === "number")
            S.push(r(T));
          else if (D === "function")
            if (a) {
              for (;typeof T == "function"; )
                T = T();
              f = N(S, Array.isArray(T) ? T : [T]) || f;
            } else
              S.push(T), f = true;
          else
            S.push(T);
      }
      return f;
    }
    function _(S, E, a) {
      let f = a.length, F = E.length, R = f, T = 0, D = 0, Q = C(E[F - 1]), K = null;
      for (;T < F || D < R; ) {
        if (E[T] === a[D]) {
          T++, D++;
          continue;
        }
        for (;E[F - 1] === a[R - 1]; )
          F--, R--;
        if (F === T) {
          const le = R < f ? D ? C(a[D - 1]) : a[R - D] : Q;
          for (;D < R; )
            s(S, a[D++], le);
        } else if (R === D)
          for (;T < F; )
            (!K || !K.has(E[T])) && h(S, E[T]), T++;
        else if (E[T] === a[R - 1] && a[D] === E[F - 1]) {
          const le = C(E[--F]);
          s(S, a[D++], C(E[T++])), s(S, a[--R], le), E[F] = a[R];
        } else {
          if (!K) {
            K = new Map;
            let he = D;
            for (;he < R; )
              K.set(a[he], he++);
          }
          const le = K.get(E[T]);
          if (le != null)
            if (D < le && le < R) {
              let he = T, Je = 1, gt;
              for (;++he < F && he < R && !((gt = K.get(E[he])) == null || gt !== le + Je); )
                Je++;
              if (Je > le - D) {
                const Gt = E[T];
                for (;D < le; )
                  s(S, a[D++], Gt);
              } else
                k(S, a[D++], E[T++]);
            } else
              T++;
          else
            h(S, E[T++]);
        }
      }
    }
    function b(S, E, a, f) {
      if (a === undefined) {
        let R;
        for (;R = A(S); )
          h(S, R);
        return f && s(S, f), "";
      }
      const F = f || r("");
      if (E.length) {
        let R = false;
        for (let T = E.length - 1;T >= 0; T--) {
          const D = E[T];
          if (F !== D) {
            const Q = p(D) === S;
            !R && !T ? Q ? k(S, F, D) : s(S, F, a) : Q && h(S, D);
          } else
            R = true;
        }
      } else
        s(S, F, a);
      return [F];
    }
    function v(S, E, a) {
      for (let f = 0, F = E.length;f < F; f++)
        s(S, E[f], a);
    }
    function k(S, E, a) {
      s(S, E, a), h(S, a);
    }
    function L(S, E, a = {}, f) {
      return E || (E = {}), f || ge(() => a.children = m(S, E.children, a.children)), ge(() => E.ref && E.ref(S)), ge(() => {
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
      return et((f) => {
        a = f, x(E, S());
      }), a;
    }, insert: x, spread(S, E, a) {
      typeof E == "function" ? ge((f) => L(S, E(), f, a)) : L(S, E, undefined, a);
    }, createElement: t, createTextNode: r, insertNode: s, setProp(S, E, a, f) {
      return w(S, E, a, f), a;
    }, mergeProps: sr, effect: ge, memo: nn, createComponent: en, use(S, E, a) {
      return Oe(() => S(E, a));
    } };
  }
  function an(t) {
    const r = on(t);
    return r.mergeProps = sr, r;
  }
  var cr = 6 * 1024 * 1024, ln = 64, Hi = ln, ur = 4 * 1024 * 1024, Ae = 64 + ur, Pt = 768 * 1024, xt = Ae + Pt, sn = 256 * 1024, Ct = xt + sn, fr = Ae + Pt, cn = 0, un = 8, fn = 12, dn = 16, hn = 24, gn = 28, Fn = 32, _n = 40, bn = 44, vn = un >> 2, En = fn >> 2, pn = hn >> 2, dr = gn >> 2, Sn = _n >> 2;
  bn >> 2;
  var wn = cn >> 3, Rn = dn >> 3, mn = Fn >> 3, Gi = 1, Ui = 2, Xi = 3, Yi = 4, ji = 16, Ji = 17, qi = 20, Ki = 21, Zi = 22, Qi = 23, eo = 24, to = 25, ro = 26, no = 27, io = 28, oo = 29, ao = 30, lo = 31, so = 32, co = 33, uo = 34, fo = 35, ho = 36, go = 37, Fo = 38, _o = 39, bo = 0, vo = 1, Eo = 2, po = 3, So = 4, wo = 5, Ro = 6, mo = 7, To = 9, Po = 10, xo = 11, Co = 12, Oo = 13, Ao = 14, $o = 15, yo = 16, ko = 17, Io = 18, No = 19, Do = 20, Lo = 21, zo = 22, Wo = 23, Vo = 24, Bo = 25, Mo = 26, Ho = 27, Go = 28, Uo = 29, Xo = 30, Yo = 31, jo = 32, Jo = 33, qo = 34, Ko = 35, Zo = 36, Qo = 37, ea = 38, ta = 39, ra = 40, na = 41, ia = 1, oa = 2, aa = 3, la = 4, sa = 5, ca = 6, ua = 7, fa = 8, da = 9, ha = 10, ga = 11, Fa = 12, _a = 13, ba = 14, va = 15, Ea = 16, pa = 17, Sa = 18, wa = 19, Ra = 20, ma = 21, Ta = 0, Pa = 1, xa = 2, Ca = 3, Oa = 4, Aa = 5, $a = 6, ya = 7, ka = 0, Ia = 1, Na = 2, Da = 3, La = 4, za = 5, Wa = 6, Va = 7, Ba = 8, Ma = 9, Ha = 10, Ga = 11, Ua = 12, Xa = 13, Ya = 14, ja = 15, Ja = 16, qa = 32, Ka = 33, Za = 34, Qa = 35, el = 36, tl = 37, rl = 64, nl = 65, il = 66, ol = 67, al = 68, ll = 69, sl = 70, cl = 71, ul = 72, fl = 73, dl = 74, hl = 96, gl = 97, Fl = 98, _l = 99, bl = 128, vl = 129, El = 130, pl = 131, Sl = 132, wl = 133, Rl = 134, ml = 135, Tl = 136, Pl = 137, xl = 160, Cl = 161, Ol = 162, Al = 163, $l = 164, yl = 165, kl = 166, Il = 167, Nl = 168, Dl = 169, Ll = 170, zl = 171, Wl = 172, Vl = 173, Bl = 174, Ml = 175, Hl = -1, Tn = 2147483646, Pn = 2147483645, Ee = globalThis.__skal_acquireBridge();
  if (!Ee || Ee.byteLength !== cr)
    throw new Error(`Skal: bridge buffer not available (got ${Ee && Ee.byteLength})`);
  var hr = new Uint8Array(Ee), ie = new Uint32Array(Ee), Ot = new BigInt64Array(Ee), xn = new TextEncoder, Ge = 16, Cn = 64 + ur >> 2, On = 16384, An = Cn - 4, it = 0n, _e = Ge, $e = Ae, ot = Ge;
  function At() {
    ie[vn] = _e - Ge << 2, ie[En] = $e - Ae, it += 1n, Atomics.store(Ot, wn, it), ot = _e;
  }
  function gr() {
    At();
    const t = it, r = performance.now() + 5000;
    for (;!(Atomics.load(Ot, mn) >= t); )
      if (performance.now() > r) {
        console.warn("Skal: drain spin timeout \u2014 UI thread slow; ring will overwrite");
        break;
      }
    _e = Ge, $e = Ae, ot = Ge;
  }
  function U(t, r, i, l) {
    let s = _e;
    s >= An && (gr(), s = _e), ie[s] = t >>> 0, ie[s + 1] = r >>> 0, ie[s + 2] = i >>> 0, ie[s + 3] = l >>> 0, _e = s + 4, _e - ot >= On && At();
  }
  var pe = 0, Se = 0;
  function ye(t) {
    $e + t.length * 3 > fr && gr();
    const r = $e - Ae, i = hr.subarray($e, fr), { read: l, written: s } = xn.encodeInto(t, i);
    if (l !== t.length)
      throw new Error(`Skal: string too large for heap (${t.length} code units > ${Pt} bytes)`);
    $e += s, pe = r, Se = s;
  }
  function at(t, r) {
    ye(r), U(20, t, pe, Se);
  }
  var $t = false;
  function $n() {
    $t = false, _e !== ot && At();
  }
  function B() {
    $t || ($t = true, queueMicrotask($n));
  }
  var ue = 1024, $ = new Int8Array(256);
  $.fill(-1), $[0] = 0, $[1] = 1, $[2] = 2, $[3] = 3, $[4] = 4, $[5] = 5, $[6] = 6, $[7] = 7, $[8] = 8, $[9] = 9, $[32] = 10, $[33] = 11, $[34] = 12, $[35] = 13, $[36] = 14, $[37] = 15, $[64] = 16, $[65] = 17, $[66] = 18, $[67] = 19, $[68] = 20, $[69] = 21, $[70] = 22, $[96] = 23, $[97] = 24, $[128] = 25, $[129] = 26, $[130] = 27, $[131] = 28, $[160] = 29, $[161] = 30, $[162] = 31, $[10] = 32, $[11] = 33, $[12] = 34, $[13] = 35, $[14] = 36, $[15] = 37, $[16] = 38, $[132] = 39, $[133] = 40, $[134] = 41, $[135] = 42, $[136] = 43, $[163] = 44, $[164] = 45, $[165] = 46, $[166] = 47, $[71] = 48, $[98] = 49, $[137] = 50, $[72] = 51, $[167] = 52, $[168] = 53, $[169] = 54, $[170] = 55, $[171] = 56, $[172] = 57, $[173] = 58, $[174] = 59, $[73] = 60, $[99] = 61, $[175] = 62, $[74] = 63;
  var oe = 64, lt = new Int32Array(ue * oe), Ue = new Float32Array(ue * oe), st = new Array(ue * oe), Xe = new Uint8Array(ue * oe), ke = 6, Ie = new Float32Array(ue * ke);
  Ie.fill(NaN);
  var ct = new Map, Fr = [], yn = 0;
  function kn() {
    const t = ue * 2, r = ue * oe, i = t * oe, l = ue * ke, s = t * ke, h = new Int32Array(i);
    h.set(lt), lt = h;
    const w = new Uint8Array(i);
    w.set(Xe), Xe = w;
    const p = new Float32Array(i);
    p.set(Ue), p.fill(NaN, r), Ue = p;
    const A = new Float32Array(s);
    A.set(Ie), A.fill(NaN, l), Ie = A, st.length = i, ue = t;
  }
  function ut(t) {
    let r = ct.get(t);
    if (r === undefined) {
      r = Fr.pop(), r === undefined && (r = yn++), r >= ue && kn(), ct.set(t, r);
      const i = r * oe;
      Xe.fill(0, i, i + oe), Ue.fill(NaN, i, i + oe);
      for (let l = i;l < i + oe; l++)
        st[l] = undefined;
    }
    return r;
  }
  var _r = new Map, br = new Map, vr = new Map, Ne = new Map;
  function In(t) {
    const r = ct.get(t);
    if (r !== undefined) {
      ct.delete(t), Fr.push(r);
      const i = r * ke;
      Ie.fill(NaN, i, i + ke);
    }
    _r.delete(t), br.delete(t), vr.delete(t), Kn(t);
  }
  var se = 0, be = 0, De = new Float32Array(1), Ye = new Uint32Array(De.buffer);
  function ne(t, r, i) {
    const l = i | 0, s = $[r];
    if (s < 0) {
      U(16, t, r, l), se++;
      return;
    }
    const h = ut(t) * oe + s;
    if (Xe[h] !== 0 && lt[h] === l) {
      be++;
      return;
    }
    lt[h] = l, Xe[h] = 1, U(16, t, r, l), se++;
  }
  function Er(t, r, i) {
    const l = $[r];
    if (l < 0) {
      De[0] = i, U(17, t, r, Ye[0]), se++;
      return;
    }
    const s = ut(t) * oe + l;
    if (Ue[s] === i) {
      be++;
      return;
    }
    Ue[s] = i, De[0] = i, U(17, t, r, Ye[0]), se++;
  }
  function Nn(t, r, i) {
    const l = $[r];
    if (l < 0) {
      ye(i == null ? "" : String(i)), U(22, t, (r & 255) << 24 | pe & 16777215, Se), se++;
      return;
    }
    const s = ut(t) * oe + l;
    if (st[s] === i) {
      be++;
      return;
    }
    st[s] = i, ye(i == null ? "" : String(i)), U(22, t, (r & 255) << 24 | pe & 16777215, Se), se++;
  }
  function Le(t, r, i, l) {
    const s = ut(t) * ke + i;
    if (Ie[s] === l) {
      be++;
      return;
    }
    Ie[s] = l, De[0] = l, U(r, t, 0, Ye[0]), se++;
  }
  function Dn(t, r) {
    Le(t, 32, 0, r);
  }
  function Ln(t, r) {
    Le(t, 33, 1, r);
  }
  function zn(t, r) {
    Le(t, 34, 2, r);
  }
  function Wn(t, r) {
    Le(t, 35, 3, r);
  }
  function Vn(t, r) {
    Le(t, 36, 4, r);
  }
  function Bn(t, r) {
    Le(t, 37, 5, r);
  }
  var Mn = { material: 0, cupertino: 1, adaptive: 2 }, Hn = { light: 0, dark: 1 };
  function Gn(t, r) {
    U(38, typeof t == "string" ? Mn[t] ?? 0 : t | 0, typeof r == "string" ? Hn[r] ?? 0 : r | 0, 0), B();
  }
  function Un(t) {
    U(39, t, 0, 0), B();
  }
  function pr(t) {
    return ft(1, "showDialog", [JSON.stringify(t || {})]);
  }
  function Xn(t) {
    return ft(1, "showActionSheet", [JSON.stringify(t || {})]);
  }
  function Sr(t) {
    return ft(1, "showSnackbar", [JSON.stringify(typeof t == "string" ? { message: t } : t || {})]);
  }
  var wr = new Map;
  function Yn(t) {
    let r = 2166136261;
    for (let i = 0;i < t.length; i++)
      r ^= t.charCodeAt(i), r = Math.imul(r, 16777619) >>> 0;
    return r;
  }
  function we(t) {
    let r = wr.get(t);
    return r !== undefined || (r = Yn(t), ye(t), U(23, r, pe, Se), wr.set(t, r)), r;
  }
  function jn(t, r) {
    U(4, t, we(r), 0);
  }
  function yt(t, r) {
    let i = t.get(r);
    return i === undefined && (i = new Map, t.set(r, i)), i;
  }
  function Rr(t, r, i) {
    const l = we(r), s = i >>> 0, h = yt(_r, t);
    if (h.get(l) === s) {
      be++;
      return;
    }
    h.set(l, s), U(24, t, l, s), se++;
  }
  function mr(t, r, i) {
    const l = we(r), s = yt(br, t);
    if (s.get(l) === i) {
      be++;
      return;
    }
    s.set(l, i), De[0] = i, U(25, t, l, Ye[0]), se++;
  }
  function Tr(t, r, i) {
    const l = we(r), s = i == null ? "" : String(i), h = yt(vr, t);
    if (h.get(l) === s) {
      be++;
      return;
    }
    h.set(l, s), ye(s);
    const w = pe & 16777215, p = Se & 255;
    U(26, t, l, w << 8 | p), se++;
  }
  function Jn(t, r, i) {
    U(27, t, we(r), i);
  }
  var je = new Map, fe = new Map, Pr = 1;
  function xr(t, r) {
    for (let i = 0;i < r.length; i++) {
      const l = r[i];
      if (typeof l == "number")
        Number.isInteger(l) ? U(29, t, 1, l | 0) : (De[0] = l, U(29, t, 2, Ye[0]));
      else if (typeof l == "boolean")
        U(29, t, 3, l ? 1 : 0);
      else if (typeof l == "string") {
        ye(l);
        const s = pe >>> 0;
        U(29, t, 4 | (Se & 16777215) << 8, s);
      } else
        U(29, t, 0, 0);
    }
  }
  function ft(t, r, i) {
    const l = we(r), s = Pr++;
    return xr(s, i), U(28, t, l, s), B(), new Promise((h, w) => {
      je.set(s, { resolve: h, reject: w });
    });
  }
  function qn(t, r, i, l, s) {
    const h = we(r), w = Pr++;
    xr(w, i), U(30, t, h, w), B(), fe.set(w, { nodeId: t, onValue: l, onError: s && s.onError, onDone: s && s.onDone });
    let p = Ne.get(t);
    return p === undefined && (p = new Set, Ne.set(t, p)), p.add(w), function() {
      if (!fe.has(w))
        return;
      fe.delete(w);
      const C = Ne.get(t);
      C && (C.delete(w), C.size === 0 && Ne.delete(t)), U(31, w, 0, 0), B();
    };
  }
  function Kn(t) {
    const r = Ne.get(t);
    if (r !== undefined) {
      for (const i of r)
        fe.has(i) && (fe.delete(i), U(31, i, 0, 0));
      Ne.delete(t), B();
    }
  }
  var kt = new Map, Zn = 1;
  function It(t) {
    const r = Zn++;
    return kt.set(r, t), r;
  }
  function Cr(t, r, i) {
    U(21, t, r, i);
  }
  var Nt = 0n, Re = null, Or = cr - Ct, Dt = Ct >> 2, Qn = Ct + Or >> 2, ei = Or / 16 | 0, Ar = new ArrayBuffer(4), Lt = new Float32Array(Ar), zt = new Uint32Array(Ar), ti = new TextDecoder("utf-8");
  function Wt(t, r) {
    return r === 0 ? "" : ti.decode(hr.subarray(xt + t, xt + t + r));
  }
  function Vt(t, r) {
    ie[Sn] = t + r;
  }
  globalThis.__skal_drainEvents = function() {
    const t = Atomics.load(Ot, Rn);
    if (t === Nt)
      return;
    const r = Dt + (ie[pn] >> 2);
    let i = Dt + (ie[dr] >> 2);
    const l = Qn, s = Dt;
    let h = ei;
    for (;i !== r && h-- > 0; ) {
      const w = ie[i + 0], p = w & 255, A = w >>> 8 & 255, C = ie[i + 1], x = ie[i + 2], m = ie[i + 3];
      let N, _ = false;
      if (A === 1)
        N = x | 0, _ = true;
      else if (A === 2)
        zt[0] = x, N = Lt[0], _ = true;
      else if (A === 3)
        N = x !== 0, _ = true;
      else if (A === 4)
        N = Wt(m, x), _ = true, Vt(m, x);
      else if (A === 5) {
        const b = Wt(m, x);
        try {
          N = JSON.parse(b);
        } catch {
          N = b;
        }
        _ = true, Vt(m, x);
      } else if (A === 6) {
        const b = Wt(m, x);
        try {
          N = JSON.parse(b);
        } catch {
          N = [];
        }
        _ = true, Vt(m, x);
      } else if (A === 7) {
        zt[0] = x;
        const b = Lt[0];
        zt[0] = m, N = [b, Lt[0]], _ = true;
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
        const b = fe.get(C);
        if (b)
          try {
            b.onValue(_ ? N : undefined);
          } catch (v) {
            Re = v && (v.stack || v.message || String(v)) || "unknown";
          }
      } else if (p === 6) {
        const b = fe.get(C);
        if (b) {
          fe.delete(C);
          try {
            b.onDone && b.onDone();
          } catch (v) {
            Re = v && (v.stack || v.message || String(v)) || "unknown";
          }
        }
      } else if (p === 7) {
        const b = fe.get(C);
        if (b) {
          fe.delete(C);
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
      i += 4, i >= l && (i = s);
    }
    ie[dr] = i - s << 2, Nt = t;
  }, globalThis.skalStatus = () => JSON.stringify({ handlerCount: kt.size, opSeq: Number(it), lastEventSeq: Number(Nt), lastHandlerError: Re, propWrites: se, propSkips: be });
  var Gl = 1, ri = 2;
  function $r() {
    return ri++;
  }
  var ni = { box: 0, column: 1, scrollView: 5, listView: 6, reorderableListView: 7, row: 2, text: 3, button: 4, image: 9, stack: 10, switch: 11, slider: 12, checkbox: 13, activityIndicator: 14, progressBar: 15, lazyGrid: 16, wrap: 17, safeArea: 18, richText: 19, textInput: 20, navigator: 21, screen: 22, tabs: 23, tab: 24, animatedList: 25, crossFade: 26, hero: 27, listTile: 28, pageView: 29, dismissible: 30, customScrollView: 31, sliverAppBar: 32, sliverList: 33, sliverGrid: 34, canvas: 35, dragItem: 36, dropZone: 37, radio: 38, chip: 39, segmentedButton: 40, expansionTile: 41 };
  function ii() {
    const t = [], r = { _cmds: t, fillStyle(i) {
      return t.push(["fillStyle", Bt(i)]), r;
    }, strokeStyle(i) {
      return t.push(["strokeStyle", Bt(i)]), r;
    }, lineWidth(i) {
      return t.push(["lineWidth", +i || 0]), r;
    }, fillRect(i, l, s, h) {
      return t.push(["fillRect", +i, +l, +s, +h]), r;
    }, strokeRect(i, l, s, h) {
      return t.push(["strokeRect", +i, +l, +s, +h]), r;
    }, circle(i, l, s) {
      return t.push(["circle", +i, +l, +s]), r;
    }, line(i, l, s, h) {
      return t.push(["line", +i, +l, +s, +h]), r;
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
    }, fillText(i, l, s) {
      return t.push(["fillText", String(i), +l, +s]), r;
    } };
    return r;
  }
  var oi = { padding: [0, "u32"], paddingTop: [1, "u32"], paddingRight: [2, "u32"], paddingBottom: [3, "u32"], paddingLeft: [4, "u32"], width: [5, "dim"], height: [6, "dim"], weight: [7, "f32"], alignment: [8, "u32"], gap: [9, "u32"], axis: [10, "u32"], top: [11, "u32"], right: [12, "u32"], bottom: [13, "u32"], left: [14, "u32"], crossAxisCount: [15, "u32"], aspectRatio: [16, "f32"], background: [32, "color"], color: [33, "color"], cornerRadius: [34, "u32"], borderWidth: [35, "u32"], borderColor: [36, "color"], shadow: [37, "u32"], fontSize: [64, "u32"], fontWeight: [65, "u32"], fontFamily: [66, "u32"], textAlign: [67, "u32"], lineHeight: [68, "u32"], maxLines: [69, "u32"], textOverflow: [70, "u32"], src: [96, "str"], contentScale: [97, "u32"], placeholder: [128, "str"], value: [129, "str"], keyboardType: [130, "u32"], secureEntry: [131, "u32"], checked: [132, "u32"], min: [134, "f32"], max: [135, "f32"], progress: [136, "f32"], presentation: [166, "u32"], title: [71, "str"], icon: [98, "str"], leadingIcon: [98, "str"], subtitle: [73, "str"], trailingIcon: [99, "str"], activeTab: [137, "u32"], tag: [72, "str"], transition: [171, "u32"], enabled: [160, "u32"], focusable: [161, "u32"], visible: [162, "u32"], draggable: [172, "u32"], spring: [173, "u32"], release: [174, "u32"], sliverMode: [175, "u32"], dragData: [74, "str"] }, ai = { opacity: Dn, translationX: Ln, translationY: zn, scaleX: Wn, scaleY: Vn, rotation: Bn }, li = { onClick: 1, onclick: 1, onTap: 1, onLongPress: 8, onDoubleTap: 9, onChange: 2, onSubmit: 10, onReorder: 11, onPop: 12, onDismiss: 20, onPanStart: 13, onPanUpdate: 14, onPanEnd: 15, onScaleStart: 16, onScaleUpdate: 17, onScaleEnd: 18, onDrop: 21 }, si = { linear: 0, easeIn: 1, easeOut: 2, easeInOut: 3, bounce: 4, elastic: 5, fastOutSlowIn: 6 }, ci = { gentle: 1, bouncy: 2, stiff: 3 };
  function Bt(t) {
    if (typeof t == "number")
      return t | 0;
    if (typeof t != "string")
      return 0;
    let r = t.trim();
    r.startsWith("#") && (r = r.slice(1));
    let i = 0, l = 0, s = 0, h = 255;
    return r.length === 3 ? (i = parseInt(r[0] + r[0], 16), l = parseInt(r[1] + r[1], 16), s = parseInt(r[2] + r[2], 16)) : r.length === 4 ? (i = parseInt(r[0] + r[0], 16), l = parseInt(r[1] + r[1], 16), s = parseInt(r[2] + r[2], 16), h = parseInt(r[3] + r[3], 16)) : r.length === 6 ? (i = parseInt(r.slice(0, 2), 16), l = parseInt(r.slice(2, 4), 16), s = parseInt(r.slice(4, 6), 16)) : r.length === 8 && (h = parseInt(r.slice(0, 2), 16), i = parseInt(r.slice(2, 4), 16), l = parseInt(r.slice(4, 6), 16), s = parseInt(r.slice(6, 8), 16)), (h & 255) << 24 | (i & 255) << 16 | (l & 255) << 8 | s & 255 | 0;
  }
  function ui(t) {
    return typeof t == "number" ? t | 0 : t === "fill" ? Tn : t === "wrap" ? Pn : -1;
  }
  function fi(t) {
    if (Array.isArray(t))
      return true;
    const r = Object.getPrototypeOf(t);
    return r === Object.prototype || r === null;
  }
  function di(t, r, i) {
    if (i == null)
      return;
    if (r === "ref" && i && typeof i.__skalBind == "function") {
      i.__skalBind(t.id);
      return;
    }
    const l = typeof i;
    if (l === "object" && fi(i)) {
      Tr(t.id, r, JSON.stringify(i)), B();
      return;
    }
    if (l === "function") {
      const s = It(i);
      Jn(t.id, r, s), B();
      return;
    }
    if (l === "number") {
      Number.isInteger(i) && i >= 0 && i <= 4294967295 && Rr(t.id, r, i | 0), mr(t.id, r, i), B();
      return;
    }
    if (l === "string") {
      Tr(t.id, r, i), B();
      return;
    }
    if (l === "boolean") {
      Rr(t.id, r, i ? 1 : 0), B();
      return;
    }
  }
  function hi(t) {
    const r = [t];
    for (;r.length > 0; ) {
      const i = r.pop();
      In(i.id);
      let l = i.firstChild;
      for (;l; )
        r.push(l), l = l.nextSibling;
    }
  }
  var dt = class {
    constructor(t, r, i = false, l = false) {
      this.tag = t, this.id = r, this.isText = i, this.isCustom = l, this.parent = null, this.firstChild = null, this.lastChild = null, this.nextSibling = null, this.prevSibling = null, this.text = "";
    }
  }, gi = an({ createElement(t) {
    const r = $r(), i = ni[t];
    return i !== undefined ? (U(1, r, i, 0), B(), new dt(t, r, false, false)) : (jn(r, t), B(), new dt(t, r, false, true));
  }, createTextNode(t) {
    const r = $r();
    U(1, r, 3, 0);
    const i = t == null ? "" : String(t);
    i.length > 0 && at(r, i), B();
    const l = new dt("#text", r, true);
    return l.text = i, l;
  }, replaceText(t, r) {
    const i = r == null ? "" : String(r);
    t.text !== i && (t.text = i, at(t.id, i), B());
  }, setProperty(t, r, i, l) {
    if (t.isCustom) {
      di(t, r, i);
      return;
    }
    if (r === "onRefresh") {
      if (typeof i == "function") {
        const p = t.id, A = i, x = It(async () => {
          try {
            await A();
          } finally {
            Un(p);
          }
        });
        Cr(t.id, 19, x), B();
      }
      return;
    }
    if (r === "draw" && typeof i == "function") {
      const p = i, A = t;
      Kt(() => {
        const C = ii();
        try {
          p(C);
        } catch {}
        const x = JSON.stringify(C._cmds);
        x !== A._skalCanvasProgram && (A._skalCanvasProgram = x, at(A.id, x), B());
      });
      return;
    }
    const s = li[r];
    if (s !== undefined) {
      if (typeof i == "function") {
        const p = It(i);
        Cr(t.id, s, p), B();
      }
      return;
    }
    if (r === "value" && t.tag === "slider") {
      Er(t.id, 133, Number(i) || 0), B();
      return;
    }
    if (r === "draggable" && typeof i == "string") {
      ne(t.id, 172, { free: 1, both: 1, horizontal: 2, x: 2, vertical: 3, y: 3 }[i] ?? 0), B();
      return;
    }
    if (r === "spring" && typeof i == "string") {
      ne(t.id, 173, { gentle: 1, bouncy: 2, stiff: 3, wobbly: 2 }[i] ?? 0), B();
      return;
    }
    if (r === "release" && typeof i == "string") {
      ne(t.id, 174, { none: 0, glide: 1, friction: 1, springback: 2, spring: 2 }[i.toLowerCase()] ?? 0), B();
      return;
    }
    if (r === "sliverMode" && typeof i == "string") {
      ne(t.id, 175, { normal: 0, pinned: 1, floating: 2, both: 3 }[i.toLowerCase()] ?? 0), B();
      return;
    }
    if (r === "animate" && i && typeof i == "object") {
      if (ne(t.id, 163, i.duration | 0), i.curve != null) {
        const p = typeof i.curve == "string" ? si[i.curve] ?? 0 : i.curve | 0;
        ne(t.id, 164, p);
      }
      if (i.delay != null && ne(t.id, 165, i.delay | 0), i.repeat != null && ne(t.id, 167, i.repeat ? 1 : 0), i.reverse != null && ne(t.id, 168, i.reverse ? 1 : 0), i.loop != null && ne(t.id, 169, i.loop | 0), i.spring != null) {
        const p = typeof i.spring == "string" ? ci[i.spring] ?? 0 : i.spring ? 2 : 0;
        ne(t.id, 170, p);
      }
      B();
      return;
    }
    if (r === "label" && (t.tag === "button" || t.tag === "text" || t.tag === "chip")) {
      const p = i == null ? "" : String(i);
      at(t.id, p), B();
      return;
    }
    const h = ai[r];
    if (h !== undefined) {
      typeof i == "number" && (h(t.id, i), B());
      return;
    }
    const w = oi[r];
    if (w !== undefined) {
      const [p, A] = w;
      if (i == null)
        return;
      switch (A) {
        case "u32":
          typeof i == "number" ? (ne(t.id, p, i | 0), B()) : typeof i == "boolean" && (ne(t.id, p, i ? 1 : 0), B());
          return;
        case "f32":
          typeof i == "number" && (Er(t.id, p, i), B());
          return;
        case "str":
          Nn(t.id, p, String(i)), B();
          return;
        case "color":
          ne(t.id, p, Bt(i)), B();
          return;
        case "dim":
          ne(t.id, p, ui(i)), B();
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
      const s = r.parent;
      r.prevSibling ? r.prevSibling.nextSibling = r.nextSibling : s.firstChild === r && (s.firstChild = r.nextSibling), r.nextSibling ? r.nextSibling.prevSibling = r.prevSibling : s.lastChild === r && (s.lastChild = r.prevSibling), r.prevSibling = null, r.nextSibling = null;
    }
    const l = i ? i.id : 0;
    U(3, t.id, r.id, l), B(), r.parent = t, i ? (r.nextSibling = i, r.prevSibling = i.prevSibling, i.prevSibling ? i.prevSibling.nextSibling = r : t.firstChild = r, i.prevSibling = r) : (r.prevSibling = t.lastChild, r.nextSibling = null, t.lastChild ? t.lastChild.nextSibling = r : t.firstChild = r, t.lastChild = r);
  }, removeNode(t, r) {
    U(2, r.id, 0, 0), hi(r), B(), r.prevSibling ? r.prevSibling.nextSibling = r.nextSibling : t.firstChild = r.nextSibling, r.nextSibling ? r.nextSibling.prevSibling = r.prevSibling : t.lastChild = r.prevSibling, r.parent = null, r.prevSibling = null, r.nextSibling = null;
  }, isTextNode(t) {
    return t.isText;
  }, getParentNode(t) {
    return t.parent;
  }, getFirstChild(t) {
    return t.firstChild;
  }, getNextSibling(t) {
    return t.nextSibling;
  } }), { render: Fi, effect: W, memo: Mt, createComponent: y, createElement: o, createTextNode: Ul, insertNode: d, insert: I, spread: Xl, setProp: e, mergeProps: Yl, use: _i } = gi;
  U(1, 1, 0, 0), B();
  var bi = new dt("box", 1, false);
  function vi() {
    let t = 0;
    const r = function() {};
    return r.__skalBind = (i) => {
      t = i;
    }, new Proxy(r, { apply(i, l, s) {
      const h = s[0];
      h && typeof h.id == "number" && (t = h.id);
    }, get(i, l) {
      if (l === "__skalBind" || typeof l == "symbol")
        return r[l];
      if (typeof l == "string" && l.endsWith("$") && l.length > 1) {
        const s = l.slice(0, -1);
        return (...h) => {
          if (t === 0)
            throw new Error(`skal ref: cannot call .${String(l)}() before the host mounts. Move the call into a JSX event handler.`);
          const w = h[h.length - 1];
          if (typeof w != "function")
            throw new TypeError(`skal ref: .${String(l)}() requires a callback as its last argument (got ${typeof w})`);
          const p = h.slice(0, -1);
          return qn(t, s, p, w);
        };
      }
      return (...s) => t === 0 ? Promise.reject(new Error(`skal ref: cannot call .${String(l)}() before the host mounts. Move the call into a JSX event handler.`)) : ft(t, l, s);
    } });
  }
  function Ht(t, r, i) {
    const l = (b) => {
      const v = t[b];
      return typeof v == "function" ? v : v && v.component || null;
    }, s = (b) => {
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
    const [m, N] = z([{ name: x, params: {}, title: s(x), transition: h(x) }]), _ = { stack: m, navigate(b, v, k) {
      N([...m(), { name: b, params: v || {}, presentation: k && k.presentation, title: (k && k.title) !== undefined ? k.title : s(b), transition: (k && k.transition) !== undefined ? k.transition : h(b) }]);
    }, back() {
      const b = m();
      b.length > 1 && N(b.slice(0, -1));
    }, replace(b, v, k) {
      N([...m().slice(0, -1), { name: b, params: v || {}, title: (k && k.title) !== undefined ? k.title : s(b), transition: (k && k.transition) !== undefined ? k.transition : h(b) }]);
    }, reset(b, v) {
      N([{ name: b, params: v || {}, title: s(b), transition: h(b) }]);
    }, canGoBack() {
      return m().length > 1;
    } };
    return p && A && Kt(() => {
      const b = m(), v = "#/" + b[b.length - 1].name;
      window.location.hash !== v && window.history.replaceState({}, "", v);
    }), _.View = () => (() => {
      var b = o("navigator");
      return e(b, "onPop", () => _.back()), I(b, y(re, { get each() {
        return m();
      }, children: (v) => {
        const k = l(v.name);
        return (() => {
          var L = o("screen");
          return I(L, k ? y(k, { get params() {
            return v.params || {};
          }, router: _ }) : null), W((S) => {
            var E = v.presentation === "modal" ? 1 : 0, a = v.title || "", f = w(v.transition);
            return E !== S.e && (S.e = e(L, "presentation", E, S.e)), a !== S.t && (S.t = e(L, "title", a, S.t)), f !== S.a && (S.a = e(L, "transition", f, S.a)), S;
          }, { e: undefined, t: undefined, a: undefined }), L;
        })();
      } })), b;
    })(), _;
  }
  var Ei = "#FFE5E5EA", pi = "#FF1C1C1E", ve = "#FF0A84FF", me = "#FF34C759", ze = "#FFFF9F0A", ht = "#FFFF3B30", We = "#FF5E5CE6";
  function V(t) {
    return (() => {
      var r = o("column"), i = o("text");
      return d(r, i), e(r, "background", "#FFFFFFFF"), e(r, "cornerRadius", 14), e(r, "padding", 16), e(r, "gap", 12), e(r, "borderWidth", 1), e(r, "borderColor", "#FFE5E5EA"), e(i, "fontSize", 15), e(i, "fontWeight", 800), e(i, "color", "#FF1C1C1E"), I(r, () => t.children, null), W((l) => e(i, "label", t.title, l)), r;
    })();
  }
  function Si(t) {
    const r = ["Inbox", "Starred", "Drafts", "Archive"];
    return (() => {
      var i = o("column");
      return e(i, "background", "#FFF2F2F7"), e(i, "padding", 16), e(i, "gap", 8), e(i, "height", "fill"), I(i, y(re, { each: r, children: (l) => (() => {
        var s = o("box"), h = o("text");
        return d(s, h), e(s, "background", "#FFFFFFFF"), e(s, "cornerRadius", 8), e(s, "padding", 12), e(s, "onTap", () => t.router.navigate("detail", { name: l }, { title: l })), e(h, "label", `${l}   \u203A`), e(h, "fontSize", 14), e(h, "color", "#FF1C1C1E"), s;
      })() })), i;
    })();
  }
  function wi(t) {
    return (() => {
      var r = o("column"), i = o("text"), l = o("text");
      return d(r, i), d(r, l), e(r, "background", "#FFF2F2F7"), e(r, "padding", 16), e(r, "gap", 10), e(r, "height", "fill"), e(i, "fontSize", 20), e(i, "fontWeight", 800), e(i, "color", "#FF1C1C1E"), e(l, "label", "The AppBar's \u2039 back button (and the system back / swipe gesture) all pop this route. The list screen behind stayed mounted \u2014 back is instant, no re-render, scroll preserved."), e(l, "fontSize", 13), e(l, "color", "#FF8E8E93"), W((s) => e(i, "label", t.name, s)), r;
    })();
  }
  var Ri = [ve, me, ze, We];
  function mi() {
    const [t, r] = z(false), [i, l] = z(false), [s, h] = z(false), [w, p] = z(0), [A, C] = z("0, 0"), [x, m] = z(false), [N, _] = z(["Alpha", "Beta", "Gamma"]);
    let b = 3;
    const v = Ht({ gallery: (k) => (() => {
      var L = o("column"), S = o("text"), E = o("row");
      return d(L, S), d(L, E), e(L, "background", "#FFF2F2F7"), e(L, "padding", 16), e(L, "gap", 12), e(L, "height", "fill"), e(S, "label", "Tap a swatch \u2014 it flies to the detail screen."), e(S, "fontSize", 13), e(S, "color", "#FF8E8E93"), e(E, "gap", 12), I(E, y(re, { each: Ri, children: (a) => (() => {
        var f = o("hero"), F = o("box");
        return d(f, F), e(f, "tag", `hero-${a}`), e(F, "width", 56), e(F, "height", 56), e(F, "background", a), e(F, "cornerRadius", 12), e(F, "onTap", () => k.router.navigate("detail", { color: a })), f;
      })() })), L;
    })(), detail: { component: (k) => (() => {
      var L = o("column"), S = o("hero"), E = o("box"), a = o("text");
      return d(L, S), d(L, a), e(L, "background", "#FFF2F2F7"), e(L, "padding", 16), e(L, "gap", 12), e(L, "height", "fill"), d(S, E), e(E, "width", "fill"), e(E, "height", 180), e(E, "cornerRadius", 20), e(a, "label", "The swatch flew here from the gallery \u2014 a shared-element transition, GPU-composited host-side."), e(a, "fontSize", 13), e(a, "color", "#FF8E8E93"), W((f) => {
        var F = `hero-${k.params.color}`, R = k.params.color;
        return F !== f.e && (f.e = e(S, "tag", F, f.e)), R !== f.t && (f.t = e(E, "background", R, f.t)), f;
      }, { e: undefined, t: undefined }), L;
    })(), title: "Detail", transition: "fade" } }, "gallery");
    return (() => {
      var k = o("scrollView"), L = o("text"), S = o("text"), E = o("text");
      return d(k, L), d(k, S), d(k, E), e(k, "background", "#FFF2F2F7"), e(k, "padding", 16), e(k, "gap", 14), e(L, "label", "Animations"), e(L, "fontSize", 24), e(L, "fontWeight", 800), e(L, "color", "#FF1C1C1E"), e(S, "label", "Host-side motion \u2014 JS flips one signal, Flutter runs the whole tween. Zero per-frame bridge traffic. See ANIMATION.md for the full plan."), e(S, "fontSize", 13), e(S, "color", "#FF8E8E93"), I(k, y(V, { title: "Implicit hot-prop tween \u2014 the animate prop", get children() {
        return [(() => {
          var a = o("row"), f = o("box");
          return d(a, f), e(a, "gap", 8), e(f, "width", 64), e(f, "height", 64), e(f, "background", "#FF0A84FF"), e(f, "cornerRadius", 14), e(f, "animate", { duration: 450, curve: "easeInOut" }), W((F) => {
            var R = t() ? 0.3 : 1, T = t() ? 1.4 : 1, D = t() ? 1.4 : 1, Q = t() ? 0.5 : 0, K = t() ? 70 : 0;
            return R !== F.e && (F.e = e(f, "opacity", R, F.e)), T !== F.t && (F.t = e(f, "scaleX", T, F.t)), D !== F.a && (F.a = e(f, "scaleY", D, F.a)), Q !== F.o && (F.o = e(f, "rotation", Q, F.o)), K !== F.i && (F.i = e(f, "translationX", K, F.i)), F;
          }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined }), a;
        })(), (() => {
          var a = o("button");
          return e(a, "onClick", () => r(!t())), W((f) => e(a, "label", t() ? "Reset" : "Animate", f)), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "opacity + scale + rotation + translation tween together \u2014 JS only flips one signal; the whole tween runs host-side."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), E), I(k, y(V, { title: "Cold-prop tween \u2014 colour \xB7 radius \xB7 padding", get children() {
        return [(() => {
          var a = o("box"), f = o("text");
          return d(a, f), e(a, "animate", { duration: 400, curve: "easeInOut" }), e(a, "width", "fill"), e(f, "label", "AnimatedContainer tweens these host-side"), e(f, "fontSize", 12), e(f, "color", "#FFFFFFFF"), W((F) => {
            var R = i() ? ht : ve, T = i() ? 32 : 8, D = i() ? 28 : 12;
            return R !== F.e && (F.e = e(a, "background", R, F.e)), T !== F.t && (F.t = e(a, "cornerRadius", T, F.t)), D !== F.a && (F.a = e(a, "padding", D, F.a)), F;
          }, { e: undefined, t: undefined, a: undefined }), a;
        })(), (() => {
          var a = o("button");
          return e(a, "onClick", () => l(!i())), W((f) => e(a, "label", i() ? "Reset" : "Animate", f)), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "background, cornerRadius and padding are cold props \u2014 the host's AnimatedContainer tweens them; JS writes each value once."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), E), I(k, y(V, { title: "Looping \u2014 repeat \xB7 reverse", get children() {
        return [(() => {
          var a = o("row"), f = o("box"), F = o("box"), R = o("box");
          return d(a, f), d(a, F), d(a, R), e(a, "gap", 20), e(f, "width", 44), e(f, "height", 44), e(f, "background", "#FF5E5CE6"), e(f, "cornerRadius", 22), e(f, "animate", { duration: 800, curve: "easeInOut", repeat: true, reverse: true }), e(f, "scaleX", 1.35), e(f, "scaleY", 1.35), e(F, "width", 44), e(F, "height", 44), e(F, "background", "#FF34C759"), e(F, "cornerRadius", 10), e(F, "animate", { duration: 1400, repeat: true }), e(F, "rotation", 6.2832), e(R, "width", 44), e(R, "height", 44), e(R, "background", "#FFFF9F0A"), e(R, "cornerRadius", 22), e(R, "animate", { duration: 900, curve: "easeInOut", repeat: true, reverse: true }), e(R, "opacity", 0.25), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "A pulse, a spin and a breathe \u2014 each loops forever host-side; JS set the endpoints once and never touches them again."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), E), I(k, y(V, { title: "Spring physics \u2014 animate.spring", get children() {
        return [(() => {
          var a = o("column"), f = o("box"), F = o("box"), R = o("box");
          return d(a, f), d(a, F), d(a, R), e(a, "gap", 10), e(f, "width", 48), e(f, "height", 48), e(f, "background", "#FF0A84FF"), e(f, "cornerRadius", 10), e(f, "animate", { duration: 700, spring: "gentle" }), e(F, "width", 48), e(F, "height", 48), e(F, "background", "#FF34C759"), e(F, "cornerRadius", 10), e(F, "animate", { duration: 700, spring: "bouncy" }), e(R, "width", 48), e(R, "height", 48), e(R, "background", "#FFFF9F0A"), e(R, "cornerRadius", 10), e(R, "animate", { duration: 700, spring: "stiff" }), W((T) => {
            var D = s() ? 150 : 0, Q = s() ? 150 : 0, K = s() ? 150 : 0;
            return D !== T.e && (T.e = e(f, "translationX", D, T.e)), Q !== T.t && (T.t = e(F, "translationX", Q, T.t)), K !== T.a && (T.a = e(R, "translationX", K, T.a)), T;
          }, { e: undefined, t: undefined, a: undefined }), a;
        })(), (() => {
          var a = o("button");
          return e(a, "onClick", () => h(!s())), W((f) => e(a, "label", s() ? "Back" : "Spring", f)), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "gentle \xB7 bouncy \xB7 stiff \u2014 three spring-like curves; bouncy overshoots and wobbles into place."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), E), I(k, y(V, { title: "Physics \u2014 real SpringSimulation (spring)", get children() {
        return [(() => {
          var a = o("column"), f = o("box"), F = o("box"), R = o("box");
          return d(a, f), d(a, F), d(a, R), e(a, "gap", 12), e(f, "width", 52), e(f, "height", 52), e(f, "background", "#FF0A84FF"), e(f, "cornerRadius", 12), e(f, "spring", "gentle"), e(F, "width", 52), e(F, "height", 52), e(F, "background", "#FF34C759"), e(F, "cornerRadius", 12), e(F, "spring", "bouncy"), e(R, "width", 52), e(R, "height", 52), e(R, "background", "#FFFF9F0A"), e(R, "cornerRadius", 12), e(R, "spring", "stiff"), W((T) => {
            var D = w(), Q = w(), K = w();
            return D !== T.e && (T.e = e(f, "translationX", D, T.e)), Q !== T.t && (T.t = e(F, "translationX", Q, T.t)), K !== T.a && (T.a = e(R, "translationX", K, T.a)), T;
          }, { e: undefined, t: undefined, a: undefined }), a;
        })(), (() => {
          var a = o("button");
          return e(a, "onClick", () => p(w() === 0 ? 175 : 0)), W((f) => e(a, "label", w() === 0 ? "Spring" : "Back", f)), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "A real SpringSimulation drives these \u2014 not a curve. Tap fast: the box retargets from its CURRENT position and velocity mid-flight, with no dead-stop restart. gentle settles, bouncy overshoots, stiff snaps."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), E), I(k, y(V, { title: "Physics \u2014 release momentum (draggable + release)", get children() {
        return [(() => {
          var a = o("box"), f = o("box"), F = o("text");
          return d(a, f), e(a, "height", 150), e(a, "background", "#FFEFEFF4"), e(a, "cornerRadius", 12), d(f, F), e(f, "draggable", true), e(f, "release", "glide"), e(f, "width", 60), e(f, "height", 60), e(f, "background", "#FF0A84FF"), e(f, "cornerRadius", 14), e(f, "onPanEnd", (R, T) => C(`${R.toFixed(0)}, ${T.toFixed(0)}`)), e(F, "label", "glide"), e(F, "fontSize", 11), e(F, "color", "#FFFFFFFF"), a;
        })(), (() => {
          var a = o("text");
          return e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), W((f) => e(a, "label", `Throw the blue box \u2014 friction carries it on after you let go and decelerates it to rest. Resting at ${A()}.`, f)), a;
        })(), (() => {
          var a = o("box"), f = o("box"), F = o("text");
          return d(a, f), e(a, "height", 150), e(a, "background", "#FFEFEFF4"), e(a, "cornerRadius", 12), d(f, F), e(f, "draggable", true), e(f, "release", "springBack"), e(f, "width", 60), e(f, "height", 60), e(f, "background", "#FF5E5CE6"), e(f, "cornerRadius", 14), e(F, "label", "spring"), e(F, "fontSize", 11), e(F, "color", "#FFFFFFFF"), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "Throw the purple box \u2014 a SpringSimulation springs it home to the origin, seeded with your fling velocity (throw harder \u2192 springs back harder). All host-side: zero per-frame bridge traffic."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), E), I(k, y(V, { title: "Cross-fade \u2014 CrossFade", get children() {
        return [(() => {
          var a = o("box"), f = o("crossFade");
          return d(a, f), e(a, "height", 92), I(f, (() => {
            var F = Mt(() => !!x());
            return () => F() ? (() => {
              var R = o("box"), T = o("text");
              return d(R, T), e(R, "width", "fill"), e(R, "height", 92), e(R, "background", "#FF5E5CE6"), e(R, "cornerRadius", 12), e(R, "padding", 16), e(T, "label", "Panel B"), e(T, "fontSize", 16), e(T, "fontWeight", 800), e(T, "color", "#FFFFFFFF"), R;
            })() : (() => {
              var R = o("box"), T = o("text");
              return d(R, T), e(R, "width", "fill"), e(R, "height", 92), e(R, "background", "#FF0A84FF"), e(R, "cornerRadius", 12), e(R, "padding", 16), e(T, "label", "Panel A"), e(T, "fontSize", 16), e(T, "fontWeight", 800), e(T, "color", "#FFFFFFFF"), R;
            })();
          })()), a;
        })(), (() => {
          var a = o("button");
          return e(a, "label", "Swap panel"), e(a, "onClick", () => m(!x())), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "AnimatedSwitcher fades the old child out as the new fades in \u2014 the outgoing element is retained through the fade."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), E), I(k, y(V, { title: "Animated list \u2014 AnimatedList", get children() {
        return [(() => {
          var a = o("animatedList");
          return e(a, "gap", 8), I(a, y(re, { get each() {
            return N();
          }, children: (f) => (() => {
            var F = o("box"), R = o("text");
            return d(F, R), e(F, "background", "#FFEFEFF4"), e(F, "cornerRadius", 8), e(F, "padding", 12), e(R, "label", f), e(R, "fontSize", 13), e(R, "color", "#FF1C1C1E"), F;
          })() })), a;
        })(), (() => {
          var a = o("row"), f = o("button"), F = o("button");
          return d(a, f), d(a, F), e(a, "gap", 8), e(f, "label", "Add"), e(f, "onClick", () => _([...N(), `Item ${++b}`])), e(F, "label", "Remove"), e(F, "onClick", () => _(N().slice(0, -1))), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "Add \u2192 a row fades + expands in; Remove \u2192 it collapses + fades out. Both host-side, via deferred teardown."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), E), I(k, y(V, { title: "Shared element \u2014 Hero", get children() {
        return [(() => {
          var a = o("box");
          return e(a, "height", 300), e(a, "borderWidth", 1), e(a, "borderColor", "#FFE5E5EA"), e(a, "cornerRadius", 8), I(a, y(v.View, {})), a;
        })(), (() => {
          var a = o("text");
          return e(a, "label", "A Hero with a matching tag on each screen flies between them across the navigator push \u2014 the navigator is a real Flutter Navigator."), e(a, "fontSize", 11), e(a, "color", "#FF8E8E93"), a;
        })()];
      } }), E), e(E, "label", "\u2014 end of animations \u2014"), e(E, "fontSize", 12), e(E, "color", "#FF8E8E93"), k;
    })();
  }
  function Ti() {
    const [t, r] = z("material"), [i, l] = z(false), [s, h] = z(true), [w, p] = z(false), [A, C] = z(40), [x, m] = z(""), [N, _] = z("none yet"), [b, v] = z(0), [k, L] = z(["Item one", "Item two", "Item three", "Item four"]);
    let S = 0;
    const [E, a] = z([]), [f, F] = z([]), [R, T] = z("M"), [D, Q] = z([]), [K, le] = z(0), [he, Je] = z(false), [gt, Gt] = z("0, 0"), [Ii, Ut] = z("\u2014"), [Ft, Ni] = z(1);
    let Dr = 1;
    const [Di, _t] = z("\u2014 try a dialog button \u2014"), [Lr, Li] = z(["First item", "Second item", "Third item", "Fourth item"]), zi = Ht({ list: { component: (ce) => y(Si, { get router() {
      return ce.router;
    } }), title: "Mailboxes" }, detail: (ce) => y(wi, { get name() {
      return ce.params.name;
    }, get router() {
      return ce.router;
    } }) }, "list"), [zr, Wi] = z(0), Xt = (ce, M) => {
      r(ce), l(M), Gn(ce, M ? 1 : 0);
    }, Vi = Ht({ home: { component: (ce) => Bi(ce.router) }, animations: { component: () => y(mi, {}), title: "Animations" } }, "home");
    function Bi(ce) {
      return (() => {
        var M = o("scrollView"), qe = o("text"), bt = o("text"), X = o("text");
        return d(M, qe), d(M, bt), d(M, X), e(M, "background", "#FFF2F2F7"), e(M, "padding", 16), e(M, "gap", 14), e(qe, "label", "Skal \u2014 Component Demo"), e(qe, "fontSize", 24), e(qe, "fontWeight", 800), e(qe, "color", "#FF1C1C1E"), e(bt, "label", "Every fast-path widget, plus animation, the design system, and dialogs."), e(bt, "fontSize", 13), e(bt, "color", "#FF8E8E93"), I(M, y(V, { title: "Design system \u2014 setDesign()", get children() {
          return [(() => {
            var n = o("text");
            return e(n, "fontSize", 13), e(n, "color", "#FF8E8E93"), W((c) => e(n, "label", `active: ${t()} \xB7 ${i() ? "dark" : "light"}`, c)), n;
          })(), (() => {
            var n = o("row"), c = o("button"), u = o("button"), g = o("button");
            return d(n, c), d(n, u), d(n, g), e(n, "gap", 8), e(c, "label", "Material"), e(c, "onClick", () => Xt("material", i())), e(u, "label", "Cupertino"), e(u, "onClick", () => Xt("cupertino", i())), e(g, "onClick", () => Xt(t(), !i())), W((P) => e(g, "label", i() ? "Light mode" : "Dark mode", P)), n;
          })(), (() => {
            var n = o("text");
            return e(n, "label", "Buttons, switches, sliders, the text field & spinner all swap Material\u2194Cupertino."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })()];
        } }), X), I(M, y(V, { title: "Layout \u2014 box \xB7 row \xB7 wrap", get children() {
          return [(() => {
            var n = o("row"), c = o("box"), u = o("box"), g = o("box");
            return d(n, c), d(n, u), d(n, g), e(n, "gap", 8), e(c, "width", 56), e(c, "height", 56), e(c, "background", "#FF0A84FF"), e(c, "cornerRadius", 10), e(u, "width", 56), e(u, "height", 56), e(u, "background", "#FF34C759"), e(u, "cornerRadius", 10), e(g, "width", 56), e(g, "height", 56), e(g, "background", "#FFFF9F0A"), e(g, "cornerRadius", 10), n;
          })(), (() => {
            var n = o("text");
            return e(n, "label", "Wrap \u2014 children flow onto new runs:"), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = o("wrap");
            return e(n, "gap", 6), I(n, y(re, { each: ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa"], children: (c) => (() => {
              var u = o("box"), g = o("text");
              return d(u, g), e(u, "background", "#FFEFEFF4"), e(u, "cornerRadius", 12), e(u, "paddingLeft", 10), e(u, "paddingRight", 10), e(u, "paddingTop", 6), e(u, "paddingBottom", 6), e(g, "label", c), e(g, "fontSize", 12), e(g, "color", "#FF1C1C1E"), u;
            })() })), n;
          })()];
        } }), X), I(M, y(V, { title: "Stack \u2014 overlap + positioned children", get children() {
          var n = o("stack"), c = o("box"), u = o("box"), g = o("text"), P = o("box");
          return d(n, c), d(n, u), d(n, P), e(n, "width", "fill"), e(n, "height", 120), e(c, "width", "fill"), e(c, "height", 120), e(c, "background", "#FF5E5CE6"), e(c, "cornerRadius", 12), d(u, g), e(u, "top", 10), e(u, "left", 10), e(u, "background", "#FFFFFFFF"), e(u, "cornerRadius", 8), e(u, "paddingLeft", 10), e(u, "paddingRight", 10), e(u, "paddingTop", 4), e(u, "paddingBottom", 4), e(g, "label", "top \xB7 left"), e(g, "fontSize", 11), e(g, "color", "#FF1C1C1E"), e(P, "bottom", 10), e(P, "right", 10), e(P, "width", 30), e(P, "height", 30), e(P, "background", "#FFFF3B30"), e(P, "cornerRadius", 15), n;
        } }), X), I(M, y(V, { title: "Text & RichText", get children() {
          return [(() => {
            var n = o("text");
            return e(n, "label", "Styled text \u2014 18sp, weight 700."), e(n, "fontSize", 18), e(n, "fontWeight", 700), e(n, "color", "#FF1C1C1E"), n;
          })(), (() => {
            var n = o("richText"), c = o("text"), u = o("text"), g = o("text"), P = o("text"), H = o("text");
            return d(n, c), d(n, u), d(n, g), d(n, P), d(n, H), e(c, "label", "Rich text "), e(c, "fontSize", 16), e(c, "color", "#FF1C1C1E"), e(u, "label", "mixes "), e(u, "fontSize", 16), e(u, "color", "#FF0A84FF"), e(u, "fontWeight", 800), e(g, "label", "size, "), e(g, "fontSize", 22), e(g, "color", "#FFFF3B30"), e(g, "fontWeight", 700), e(P, "label", "weight "), e(P, "fontSize", 16), e(P, "color", "#FF34C759"), e(P, "fontWeight", 800), e(H, "label", "and colour inline."), e(H, "fontSize", 16), e(H, "color", "#FF1C1C1E"), n;
          })()];
        } }), X), I(M, y(V, { title: "Image \u2014 network \xB7 BoxFit \xB7 rounded", get children() {
          return [(() => {
            var n = o("image");
            return e(n, "src", "https://picsum.photos/seed/skal/640/360"), e(n, "width", "fill"), e(n, "height", 160), e(n, "contentScale", 1), e(n, "cornerRadius", 12), n;
          })(), (() => {
            var n = o("text");
            return e(n, "label", "contentScale=1 (cover); cornerRadius clips the pixels. Requires network."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })()];
        } }), X), I(M, y(V, { title: "Scrolling \u2014 horizontal list \xB7 lazy grid \xB7 reorderable", get children() {
          return [(() => {
            var n = o("text");
            return e(n, "label", "listView axis=1 (horizontal, virtualized):"), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = o("listView");
            return e(n, "axis", 1), e(n, "height", 66), e(n, "gap", 8), I(n, y(re, { each: [ve, me, ze, We, ht, "#FF00C7BE", "#FFAF52DE", "#FFFFD60A"], children: (c) => (() => {
              var u = o("box");
              return e(u, "width", 66), e(u, "height", 50), e(u, "background", c), e(u, "cornerRadius", 10), u;
            })() })), n;
          })(), (() => {
            var n = o("text");
            return e(n, "label", "lazyGrid \u2014 crossAxisCount=4:"), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = o("lazyGrid");
            return e(n, "crossAxisCount", 4), e(n, "aspectRatio", 1), e(n, "gap", 8), e(n, "height", 150), I(n, y(re, { get each() {
              return Array.from({ length: 12 }, (c, u) => u);
            }, children: (c) => (() => {
              var u = o("box");
              return e(u, "background", c % 3 === 0 ? ve : c % 3 === 1 ? me : ze), e(u, "cornerRadius", 8), u;
            })() })), n;
          })(), (() => {
            var n = o("text");
            return e(n, "label", "reorderableListView \u2014 drag a row to reorder:"), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = o("reorderableListView");
            return e(n, "height", 200), e(n, "gap", 6), e(n, "onReorder", (c, u) => {
              const g = Lr().slice(), [P] = g.splice(c, 1);
              g.splice(u, 0, P), Li(g);
            }), I(n, y(re, { get each() {
              return Lr();
            }, children: (c) => (() => {
              var u = o("box"), g = o("text");
              return d(u, g), e(u, "background", "#FFEFEFF4"), e(u, "cornerRadius", 8), e(u, "padding", 12), e(g, "label", c), e(g, "fontSize", 13), e(g, "color", "#FF1C1C1E"), u;
            })() })), n;
          })()];
        } }), X), I(M, y(V, { title: "Controls \u2014 switch \xB7 checkbox \xB7 slider \xB7 text field", get children() {
          return [(() => {
            var n = o("row"), c = o("switch"), u = o("text");
            return d(n, c), d(n, u), e(n, "gap", 12), e(c, "onChange", (g) => h(g)), e(u, "fontSize", 13), e(u, "color", "#FF1C1C1E"), W((g) => {
              var P = s(), H = s() ? "switch: on" : "switch: off";
              return P !== g.e && (g.e = e(c, "checked", P, g.e)), H !== g.t && (g.t = e(u, "label", H, g.t)), g;
            }, { e: undefined, t: undefined }), n;
          })(), (() => {
            var n = o("row"), c = o("checkbox"), u = o("text");
            return d(n, c), d(n, u), e(n, "gap", 12), e(c, "onChange", (g) => p(g)), e(u, "fontSize", 13), e(u, "color", "#FF1C1C1E"), W((g) => {
              var P = w(), H = w() ? "checkbox: checked" : "checkbox: unchecked";
              return P !== g.e && (g.e = e(c, "checked", P, g.e)), H !== g.t && (g.t = e(u, "label", H, g.t)), g;
            }, { e: undefined, t: undefined }), n;
          })(), (() => {
            var n = o("slider");
            return e(n, "min", 0), e(n, "max", 100), e(n, "onChange", (c) => C(c)), W((c) => e(n, "value", A(), c)), n;
          })(), (() => {
            var n = o("text");
            return e(n, "fontSize", 13), e(n, "color", "#FF1C1C1E"), W((c) => e(n, "label", `slider: ${Math.round(A())}`, c)), n;
          })(), (() => {
            var n = o("textInput");
            return e(n, "placeholder", "Type your name\u2026"), e(n, "onChange", (c) => m(c)), e(n, "onSubmit", (c) => Sr(`Submitted: ${c}`)), W((c) => e(n, "value", x(), c)), n;
          })(), (() => {
            var n = o("text");
            return e(n, "fontSize", 13), e(n, "color", "#FF8E8E93"), W((c) => e(n, "label", x() ? `Hello, ${x()}!` : "\u2014 type above; press Enter to submit \u2014", c)), n;
          })()];
        } }), X), I(M, y(V, { title: "Indicators \u2014 spinner \xB7 progress bar", get children() {
          return [(() => {
            var n = o("row"), c = o("activityIndicator"), u = o("text");
            return d(n, c), d(n, u), e(n, "gap", 12), e(c, "color", "#FF0A84FF"), e(u, "label", "CircularProgressIndicator"), e(u, "fontSize", 13), e(u, "color", "#FF1C1C1E"), n;
          })(), (() => {
            var n = o("text");
            return e(n, "label", "determinate \u2014 tracks the slider above:"), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = o("progressBar");
            return e(n, "color", "#FF0A84FF"), W((c) => e(n, "progress", A() / 100, c)), n;
          })(), (() => {
            var n = o("text");
            return e(n, "label", "indeterminate:"), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = o("progressBar");
            return e(n, "color", "#FF34C759"), n;
          })()];
        } }), X), I(M, y(V, { title: "Animation", get children() {
          return [(() => {
            var n = o("text");
            return e(n, "label", "Implicit tweens, looping, list enter/exit, Hero \u2014 all host-side, zero per-frame bridge traffic. Opens a dedicated page."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = o("button");
            return e(n, "label", "Open Animations \u2192"), e(n, "onClick", () => ce.navigate("animations")), n;
          })()];
        } }), X), I(M, y(V, { title: "ListTile \u2014 structured rows", get children() {
          return [(() => {
            var n = o("box"), c = o("column"), u = o("listTile"), g = o("listTile"), P = o("listTile");
            return d(n, c), e(n, "background", "#FFFFFFFF"), e(n, "cornerRadius", 12), e(n, "borderWidth", 1), e(n, "borderColor", "#FFE5E5EA"), d(c, u), d(c, g), d(c, P), e(c, "padding", 0), e(c, "gap", 0), e(u, "leadingIcon", "person"), e(u, "title", "Profile"), e(u, "subtitle", "Name, photo, bio"), e(u, "trailingIcon", "explore"), e(u, "onClick", () => _("tapped Profile")), e(g, "leadingIcon", "bell"), e(g, "title", "Notifications"), e(g, "subtitle", "Sounds, badges, alerts"), e(g, "trailingIcon", "explore"), e(g, "onClick", () => _("tapped Notifications")), e(P, "leadingIcon", "settings"), e(P, "title", "Settings"), e(P, "trailingIcon", "explore"), e(P, "onClick", () => _("tapped Settings")), n;
          })(), (() => {
            var n = o("text");
            return e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), W((c) => e(n, "label", `last row: ${N()}`, c)), n;
          })()];
        } }), X), I(M, y(V, { title: "PageView \u2014 swipe between pages", get children() {
          return [(() => {
            var n = o("box"), c = o("pageView"), u = o("box"), g = o("text"), P = o("box"), H = o("text"), J = o("box"), ee = o("text");
            return d(n, c), e(n, "height", 140), d(c, u), d(c, P), d(c, J), e(c, "onChange", (j) => v(j)), d(u, g), e(u, "width", "fill"), e(u, "height", 140), e(u, "background", "#FF0A84FF"), e(u, "cornerRadius", 12), e(u, "padding", 20), e(g, "label", "Page 1 \u2014 swipe \u2192"), e(g, "fontSize", 16), e(g, "fontWeight", 800), e(g, "color", "#FFFFFFFF"), d(P, H), e(P, "width", "fill"), e(P, "height", 140), e(P, "background", "#FF34C759"), e(P, "cornerRadius", 12), e(P, "padding", 20), e(H, "label", "Page 2"), e(H, "fontSize", 16), e(H, "fontWeight", 800), e(H, "color", "#FFFFFFFF"), d(J, ee), e(J, "width", "fill"), e(J, "height", 140), e(J, "background", "#FFFF9F0A"), e(J, "cornerRadius", 12), e(J, "padding", 20), e(ee, "label", "Page 3"), e(ee, "fontSize", 16), e(ee, "fontWeight", 800), e(ee, "color", "#FFFFFFFF"), W((j) => e(c, "activeTab", b(), j)), n;
          })(), (() => {
            var n = o("row"), c = o("button"), u = o("button");
            return d(n, c), d(n, u), e(n, "gap", 8), e(c, "label", "\u25C0 Prev"), e(c, "onClick", () => v(Math.max(0, b() - 1))), e(u, "label", "Next \u25B6"), e(u, "onClick", () => v(Math.min(2, b() + 1))), n;
          })(), (() => {
            var n = o("text");
            return e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), W((c) => e(n, "label", `page ${b() + 1} of 3 \u2014 swipe or use the buttons`, c)), n;
          })()];
        } }), X), I(M, y(V, { title: "Pull-to-refresh + swipe-to-dismiss", get children() {
          return [(() => {
            var n = o("box"), c = o("listView");
            return d(n, c), e(n, "height", 210), e(n, "borderWidth", 1), e(n, "borderColor", "#FFE5E5EA"), e(n, "cornerRadius", 8), e(c, "onRefresh", async () => {
              await new Promise((u) => setTimeout(u, 900)), L([`Fresh item ${++S}`, ...k()]);
            }), I(c, y(re, { get each() {
              return k();
            }, children: (u) => (() => {
              var g = o("dismissible"), P = o("box"), H = o("text");
              return d(g, P), e(g, "onDismiss", () => L(k().filter((J) => J !== u))), d(P, H), e(P, "width", "fill"), e(P, "background", "#FFEFEFF4"), e(P, "cornerRadius", 8), e(P, "padding", 14), e(H, "label", u), e(H, "fontSize", 13), e(H, "color", "#FF1C1C1E"), g;
            })() })), n;
          })(), (() => {
            var n = o("text");
            return e(n, "label", "Pull the list down to refresh (a 900ms async task \u2014 the spinner waits for it); swipe any row sideways to dismiss it."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })()];
        } }), X), I(M, y(V, { title: "Slivers \u2014 collapsing header (CustomScrollView)", get children() {
          return [(() => {
            var n = o("box"), c = o("customScrollView"), u = o("sliverAppBar"), g = o("box"), P = o("text"), H = o("sliverList"), J = o("sliverGrid");
            return d(n, c), e(n, "height", 340), e(n, "borderWidth", 1), e(n, "borderColor", "#FFE5E5EA"), e(n, "cornerRadius", 8), d(c, u), d(c, H), d(c, J), d(u, g), e(u, "title", "Collapsing header"), e(u, "height", 170), e(u, "sliverMode", "pinned"), e(u, "background", "#FF0A84FF"), d(g, P), e(g, "width", "fill"), e(g, "height", 170), e(g, "background", "#FF5E5CE6"), e(g, "padding", 20), e(P, "label", "Parallax background"), e(P, "fontSize", 18), e(P, "fontWeight", 800), e(P, "color", "#FFFFFFFF"), I(H, y(re, { each: ["One", "Two", "Three", "Four", "Five"], children: (ee) => (() => {
              var j = o("box"), Te = o("text");
              return d(j, Te), e(j, "width", "fill"), e(j, "background", "#FFFFFFFF"), e(j, "padding", 16), e(j, "borderWidth", 1), e(j, "borderColor", "#FFE5E5EA"), e(Te, "label", `Row ${ee}`), e(Te, "fontSize", 14), e(Te, "color", "#FF1C1C1E"), j;
            })() })), e(J, "crossAxisCount", 3), e(J, "aspectRatio", 1), e(J, "gap", 8), I(J, y(re, { each: [ve, me, ze, We, ht, ve, me, ze, We], children: (ee) => (() => {
              var j = o("box");
              return e(j, "background", ee), e(j, "cornerRadius", 10), j;
            })() })), n;
          })(), (() => {
            var n = o("text");
            return e(n, "label", "Scroll the panel up \u2014 the purple header collapses into a pinned blue bar. The SliverList builds rows lazily; non-sliver children would auto-wrap in a SliverToBoxAdapter."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })()];
        } }), X), I(M, y(V, { title: "Canvas \u2014 CustomPaint 2-D drawing", get children() {
          return [(() => {
            var n = o("box"), c = o("canvas");
            return d(n, c), e(n, "background", "#FFFFFFFF"), e(n, "cornerRadius", 12), e(n, "borderWidth", 1), e(n, "borderColor", "#FFE5E5EA"), e(n, "padding", 10), e(c, "width", 300), e(c, "height", 170), e(c, "draw", (u) => {
              u.strokeStyle(Ei).lineWidth(2).beginPath().moveTo(16, 150).lineTo(284, 150).stroke(), [50, 95, 70, A() + 10, 80].forEach((g, P) => {
                u.fillStyle(P === 3 ? ve : We).fillRect(28 + P * 52, 150 - g, 34, g);
              }), u.fillStyle(me).beginPath().circle(252, 44, 22).fill(), u.fillStyle(pi).fontSize(12).fillText("bars \xB7 circle \xB7 path \xB7 text", 18, 22), E().forEach((g) => {
                u.fillStyle(g.color).beginPath().circle(g.x, g.y, g.r).fill();
              });
            }), n;
          })(), (() => {
            var n = o("row"), c = o("button"), u = o("button");
            return d(n, c), d(n, u), e(n, "gap", 8), e(c, "label", "Draw a shape"), e(c, "onClick", () => a([...E(), { x: 24 + Math.random() * 252, y: 16 + Math.random() * 120, r: 8 + Math.random() * 20, color: [ve, me, ze, ht, We][Math.floor(Math.random() * 5)] }])), e(u, "label", "Clear"), e(u, "onClick", () => a([])), n;
          })(), (() => {
            var n = o("text");
            return e(n, "label", "Bars, a circle, a stroked path, text. The 4th bar tracks the Controls slider; the buttons append/clear circles \u2014 each click flips the canvasShapes signal, so the draw callback re-records and the host repaints. Static drawings cross the bridge exactly once."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })()];
        } }), X), I(M, y(V, { title: "Drag-and-drop \u2014 DragItem onto DropZone", get children() {
          return [(() => {
            var n = o("row");
            return e(n, "gap", 8), I(n, y(re, { each: ["Apple", "Banana", "Cherry"], children: (c) => (() => {
              var u = o("dragItem"), g = o("box"), P = o("text");
              return d(u, g), e(u, "dragData", c), d(g, P), e(g, "background", "#FF5E5CE6"), e(g, "cornerRadius", 20), e(g, "padding", 12), e(P, "label", c), e(P, "fontSize", 13), e(P, "color", "#FFFFFFFF"), u;
            })() })), n;
          })(), (() => {
            var n = o("dropZone"), c = o("box"), u = o("text");
            return d(n, c), e(n, "onDrop", (g) => F([...f(), g])), d(c, u), e(c, "width", "fill"), e(c, "height", 90), e(c, "background", "#FFEFEFF4"), e(c, "cornerRadius", 12), e(c, "padding", 16), e(u, "fontSize", 13), e(u, "color", "#FF1C1C1E"), W((g) => e(u, "label", f().length ? `Basket: ${f().join(", ")}` : "Drag a chip into this zone", g)), n;
          })(), (() => {
            var n = o("row"), c = o("button");
            return d(n, c), e(n, "gap", 8), e(c, "label", "Clear basket"), e(c, "onClick", () => F([])), n;
          })(), (() => {
            var n = o("text");
            return e(n, "label", "Drag a fruit chip onto the zone \u2014 it highlights host-side while you hover; on release onDrop fires with the chip's dragData string. The whole drag is host-side; only the drop crosses the bridge."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })()];
        } }), X), I(M, y(V, { title: "More controls \u2014 radio \xB7 chip \xB7 segmented \xB7 accordion", get children() {
          return [(() => {
            var n = o("row");
            return e(n, "gap", 16), I(n, y(re, { each: ["S", "M", "L"], children: (c) => (() => {
              var u = o("row"), g = o("radio"), P = o("text");
              return d(u, g), d(u, P), e(u, "gap", 2), e(g, "onChange", () => T(c)), e(P, "label", c), e(P, "fontSize", 13), e(P, "color", "#FF1C1C1E"), W((H) => e(g, "checked", R() === c, H)), u;
            })() })), n;
          })(), (() => {
            var n = o("row");
            return e(n, "gap", 8), I(n, y(re, { each: ["Red", "Green", "Blue"], children: (c) => (() => {
              var u = o("chip");
              return e(u, "label", c), e(u, "onChange", (g) => Q(g ? [...D(), c] : D().filter((P) => P !== c))), W((g) => e(u, "checked", D().includes(c), g)), u;
            })() })), n;
          })(), (() => {
            var n = o("segmentedButton"), c = o("text"), u = o("text"), g = o("text");
            return d(n, c), d(n, u), d(n, g), e(n, "onChange", (P) => le(P)), e(c, "label", "Day"), e(c, "fontSize", 13), e(u, "label", "Week"), e(u, "fontSize", 13), e(g, "label", "Month"), e(g, "fontSize", 13), W((P) => e(n, "activeTab", K(), P)), n;
          })(), (() => {
            var n = o("box"), c = o("expansionTile"), u = o("box"), g = o("text");
            return d(n, c), e(n, "background", "#FFFFFFFF"), e(n, "cornerRadius", 8), e(n, "borderWidth", 1), e(n, "borderColor", "#FFE5E5EA"), d(c, u), e(c, "title", "Details"), e(c, "onChange", (P) => Je(P)), d(u, g), e(u, "padding", 14), e(u, "background", "#FFEFEFF4"), e(g, "label", "Body content revealed by the accordion \u2014 host-owned open state, host-side expand animation."), e(g, "fontSize", 12), e(g, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = o("text");
            return e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), W((c) => e(n, "label", `size ${R()} \xB7 chips ${D().join("/") || "\u2014"} \xB7 segment ${["Day", "Week", "Month"][K()]} \xB7 details ${he() ? "open" : "closed"}`, c)), n;
          })()];
        } }), X), I(M, y(V, { title: "Gestures \u2014 onTap \xB7 onLongPress \xB7 onDoubleTap", get children() {
          return [(() => {
            var n = o("box"), c = o("text");
            return d(n, c), e(n, "background", "#FFEFEFF4"), e(n, "cornerRadius", 12), e(n, "padding", 22), e(n, "onTap", () => _("onTap")), e(n, "onLongPress", () => _("onLongPress")), e(n, "onDoubleTap", () => _("onDoubleTap")), e(c, "label", "Tap / long-press / double-tap this box"), e(c, "fontSize", 13), e(c, "color", "#FF1C1C1E"), n;
          })(), (() => {
            var n = o("text");
            return e(n, "fontSize", 12), e(n, "color", "#FF8E8E93"), W((c) => e(n, "label", `last gesture: ${N()}`, c)), n;
          })()];
        } }), X), I(M, y(V, { title: "Drag \u2014 draggable (zero per-frame bridge traffic)", get children() {
          return [(() => {
            var n = o("box"), c = o("box"), u = o("text");
            return d(n, c), e(n, "height", 150), e(n, "background", "#FFEFEFF4"), e(n, "cornerRadius", 12), d(c, u), e(c, "draggable", true), e(c, "width", 64), e(c, "height", 64), e(c, "background", "#FF0A84FF"), e(c, "cornerRadius", 14), e(c, "onPanEnd", (g, P) => Gt(`${g.toFixed(0)}, ${P.toFixed(0)}`)), e(u, "label", "drag"), e(u, "fontSize", 12), e(u, "color", "#FFFFFFFF"), n;
          })(), (() => {
            var n = o("text");
            return e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), W((c) => e(n, "label", `Drag the blue box \u2014 the host moves it itself, no event per frame. Resting offset: ${gt()}`, c)), n;
          })()];
        } }), X), I(M, y(V, { title: "Pan \u2014 onPanUpdate delta stream", get children() {
          return [(() => {
            var n = o("box"), c = o("text");
            return d(n, c), e(n, "height", 70), e(n, "background", "#FFEFEFF4"), e(n, "cornerRadius", 12), e(n, "padding", 16), e(n, "onPanStart", () => Ut("drag started")), e(n, "onPanUpdate", (u, g) => Ut(`dx ${u.toFixed(1)}  dy ${g.toFixed(1)}`)), e(n, "onPanEnd", (u, g) => Ut(`fling v ${u.toFixed(0)}, ${g.toFixed(0)} dp/s`)), e(c, "label", "Drag anywhere on this strip"), e(c, "fontSize", 13), e(c, "color", "#FF1C1C1E"), n;
          })(), (() => {
            var n = o("text");
            return e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), W((c) => e(n, "label", `onPanUpdate: ${Ii()}`, c)), n;
          })()];
        } }), X), I(M, y(V, { title: "Scale \u2014 onScaleUpdate (pinch / rotate)", get children() {
          return [(() => {
            var n = o("box"), c = o("box"), u = o("text");
            return d(n, c), e(n, "height", 170), e(n, "background", "#FFEFEFF4"), e(n, "cornerRadius", 12), d(c, u), e(c, "width", 96), e(c, "height", 96), e(c, "background", "#FF5E5CE6"), e(c, "cornerRadius", 16), e(c, "onScaleStart", () => {
              Dr = Ft();
            }), e(c, "onScaleUpdate", (g) => Ni(Math.max(0.3, Dr * g))), e(u, "label", "pinch"), e(u, "fontSize", 13), e(u, "color", "#FFFFFFFF"), W((g) => {
              var P = Ft(), H = Ft();
              return P !== g.e && (g.e = e(c, "scaleX", P, g.e)), H !== g.t && (g.t = e(c, "scaleY", H, g.t)), g;
            }, { e: undefined, t: undefined }), n;
          })(), (() => {
            var n = o("text");
            return e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), W((c) => e(n, "label", `Pinch the purple box (two pointers / trackpad). Scale \xD7${Ft().toFixed(2)}`, c)), n;
          })()];
        } }), X), I(M, y(V, { title: "Dialogs \u2014 imperative JS API", get children() {
          return [(() => {
            var n = o("row"), c = o("button"), u = o("button");
            return d(n, c), d(n, u), e(n, "gap", 8), e(c, "label", "Alert"), e(c, "onClick", async () => {
              await pr({ title: "Heads up", message: "A plain alert dialog.", actions: [{ label: "OK", value: "ok" }] }), _t("alert: dismissed");
            }), e(u, "label", "Confirm"), e(u, "onClick", async () => {
              _t(`confirm \u2192 ${await pr({ title: "Delete file?", message: "This cannot be undone.", actions: [{ label: "Cancel", value: "cancel" }, { label: "Delete", value: "delete", style: "destructive" }] }) ?? "dismissed"}`);
            }), n;
          })(), (() => {
            var n = o("row"), c = o("button"), u = o("button");
            return d(n, c), d(n, u), e(n, "gap", 8), e(c, "label", "Action sheet"), e(c, "onClick", async () => {
              _t(`sheet \u2192 ${await Xn({ title: "Choose an action", actions: [{ label: "Copy", value: "copy" }, { label: "Share", value: "share" }, { label: "Delete", value: "delete", style: "destructive" }] }) ?? "cancelled"}`);
            }), e(u, "label", "Snackbar"), e(u, "onClick", () => {
              Sr("Hello from a snackbar \uD83D\uDC4B"), _t("snackbar: shown");
            }), n;
          })(), (() => {
            var n = o("text");
            return e(n, "fontSize", 12), e(n, "color", "#FF8E8E93"), W((c) => e(n, "label", Di(), c)), n;
          })()];
        } }), X), I(M, y(V, { title: "Navigation \u2014 push / pop with keep-alive", get children() {
          return [(() => {
            var n = o("text");
            return e(n, "label", "Tap a mailbox to push a screen; the AppBar back button (or system back) pops. Native transition; the screen behind stays mounted."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = o("box");
            return e(n, "height", 320), e(n, "borderWidth", 1), e(n, "borderColor", "#FFE5E5EA"), I(n, y(zi.View, {})), n;
          })()];
        } }), X), I(M, y(V, { title: "Tabs \u2014 bottom bar with keep-alive", get children() {
          return [(() => {
            var n = o("text");
            return e(n, "label", "Every tab subtree is built once and kept alive (IndexedStack) \u2014 switching never re-mounts; scroll & state survive."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = o("box"), c = o("tabs"), u = o("tab"), g = o("column"), P = o("text"), H = o("text"), J = o("tab"), ee = o("column"), j = o("text"), Te = o("textInput"), vt = o("tab"), Pe = o("column"), Ke = o("text"), Et = o("text");
            return d(n, c), e(n, "height", 280), e(n, "borderWidth", 1), e(n, "borderColor", "#FFE5E5EA"), e(n, "cornerRadius", 8), d(c, u), d(c, J), d(c, vt), e(c, "onChange", Wi), e(c, "height", "fill"), d(u, g), e(u, "title", "Home"), e(u, "icon", "home"), d(g, P), d(g, H), e(g, "background", "#FFF2F2F7"), e(g, "padding", 16), e(g, "gap", 8), e(g, "height", "fill"), e(P, "label", "Home"), e(P, "fontSize", 20), e(P, "fontWeight", 800), e(P, "color", "#FF1C1C1E"), e(H, "label", "Switch tabs and come back \u2014 this tab was never torn down."), e(H, "fontSize", 13), e(H, "color", "#FF8E8E93"), d(J, ee), e(J, "title", "Search"), e(J, "icon", "search"), d(ee, j), d(ee, Te), e(ee, "background", "#FFF2F2F7"), e(ee, "padding", 16), e(ee, "gap", 8), e(ee, "height", "fill"), e(j, "label", "Search"), e(j, "fontSize", 20), e(j, "fontWeight", 800), e(j, "color", "#FF1C1C1E"), e(Te, "placeholder", "Type to search\u2026"), d(vt, Pe), e(vt, "title", "Profile"), e(vt, "icon", "person"), d(Pe, Ke), d(Pe, Et), e(Pe, "background", "#FFF2F2F7"), e(Pe, "padding", 16), e(Pe, "gap", 8), e(Pe, "height", "fill"), e(Ke, "label", "Profile"), e(Ke, "fontSize", 20), e(Ke, "fontWeight", 800), e(Ke, "color", "#FF1C1C1E"), e(Et, "fontSize", 13), e(Et, "color", "#FF8E8E93"), W((xe) => {
              var Wr = zr(), Vr = `active tab index: ${zr()}`;
              return Wr !== xe.e && (xe.e = e(c, "activeTab", Wr, xe.e)), Vr !== xe.t && (xe.t = e(Et, "label", Vr, xe.t)), xe;
            }, { e: undefined, t: undefined }), n;
          })()];
        } }), X), I(M, y(V, { title: "SafeArea", get children() {
          var n = o("safeArea"), c = o("box"), u = o("text");
          return d(n, c), d(c, u), e(c, "background", "#FFEFEFF4"), e(c, "cornerRadius", 8), e(c, "padding", 14), e(u, "label", "Insets past notches & system bars. (No visible effect here \u2014 the app root already applies one.)"), e(u, "fontSize", 12), e(u, "color", "#FF1C1C1E"), n;
        } }), X), e(X, "label", "\u2014 end of UI demo \u2014"), e(X, "fontSize", 12), e(X, "color", "#FF8E8E93"), M;
      })();
    }
    return y(Vi.View, {});
  }
  var yr = ["Just shipped a new feature, feeling great about how it turned out \uD83D\uDE80", "Hot take: the best APIs are the ones you don't have to read docs for", "Spent the morning refactoring legacy code \u2014 so much cleaner now", "There's no such thing as 'just a small change' in production code", "If your tests are slow, that's a smell. Fast tests = good tests", "Bun's startup time keeps surprising me, even after a year", "Why is naming things still the hardest part of programming?", "Found a 10\xD7 speedup in a critical path today. Profilers, not guesses", "Reading 'The Art of Unix Programming' for the third time", "Premature abstraction is somehow worse than premature optimization", "Latency is a feature, throughput is an artifact of how you measure", "Half of debugging is admitting your assumption was wrong", "You don't ship the codebase you have. You ship the codebase you understand", "Cache invalidation, naming things, off-by-one. The classics", "Every config file format eventually grows a turing-complete templating layer"], Pi = Array.from({ length: 15000 }, (t, r) => ({ author: `@user${r * 2654435761 >>> 17}`, body: yr[r % yr.length], num: r + 1 })), xi = [50, 200, 500, 1000, 2000, 5000, 1e4], kr = "#FFF1F5F9", Ir = "#FF475569", Ci = "#FF22C55E", Oi = "#FFEF4444", Nr = "#FFFFFFFF";
  function Ai(t) {
    const [r, i] = z(0), [l, s] = z(false), [h, w] = z(0), [p, A] = z(false);
    return (() => {
      var C = o("column"), x = o("text"), m = o("text"), N = o("row"), _ = o("button"), b = o("button");
      return d(C, x), d(C, m), d(C, N), e(C, "background", "#FFFFFFFF"), e(C, "padding", 12), e(C, "cornerRadius", 10), e(C, "borderWidth", 1), e(C, "borderColor", "#FFE5E5EA"), e(C, "gap", 6), e(x, "fontWeight", 700), e(x, "fontSize", 14), e(x, "color", "#FF1DA1F2"), e(m, "fontSize", 14), e(m, "color", "#FF1F2937"), e(m, "maxLines", 3), e(m, "textOverflow", 1), d(N, _), d(N, b), e(N, "gap", 10), e(_, "fontSize", 12), e(_, "padding", 6), e(_, "cornerRadius", 16), e(_, "onClick", () => {
        const v = !l();
        s(v), i(r() + (v ? 1 : -1));
      }), e(b, "fontSize", 12), e(b, "padding", 6), e(b, "cornerRadius", 16), e(b, "onClick", () => {
        const v = !p();
        A(v), w(h() + (v ? 1 : -1));
      }), W((v) => {
        var k = `#${t.num} \xB7 ${t.author}`, L = t.body, S = `\u2665 ${r()}`, E = l() ? Ci : kr, a = l() ? Nr : Ir, f = `\u21A9 ${h()}`, F = p() ? Oi : kr, R = p() ? Nr : Ir;
        return k !== v.e && (v.e = e(x, "label", k, v.e)), L !== v.t && (v.t = e(m, "label", L, v.t)), S !== v.a && (v.a = e(_, "label", S, v.a)), E !== v.o && (v.o = e(_, "background", E, v.o)), a !== v.i && (v.i = e(_, "color", a, v.i)), f !== v.n && (v.n = e(b, "label", f, v.n)), F !== v.s && (v.s = e(b, "background", F, v.s)), R !== v.h && (v.h = e(b, "color", R, v.h)), v;
      }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined, n: undefined, s: undefined, h: undefined }), C;
    })();
  }
  function $i() {
    const [t, r] = z(50), [i, l] = z(""), s = tt(() => Pi.slice(0, t()));
    return (() => {
      var h = o("listView"), w = o("text"), p = o("text"), A = o("wrap"), C = o("text");
      return d(h, w), d(h, p), d(h, A), d(h, C), e(h, "background", "#FFF2F2F7"), e(h, "padding", 16), e(h, "gap", 12), e(w, "label", "Tweet feed \u2014 virtualized"), e(w, "fontSize", 24), e(w, "fontWeight", 800), e(w, "color", "#FF1C1C1E"), e(p, "label", "ListView.builder materializes only the visible window; the source pool is 15 000 items. Tap a count to mount N."), e(p, "fontSize", 13), e(p, "color", "#FF8E8E93"), e(A, "gap", 6), I(A, y(re, { each: xi, children: (x) => (() => {
        var m = o("button");
        return e(m, "label", `${x}`), e(m, "onClick", () => {
          const N = performance.now();
          try {
            r(x), l(`mounted ${x} in ${(performance.now() - N).toFixed(2)} ms`);
          } catch (_) {
            l(`ERROR @ ${x}: ${_ && (_.message || String(_)) || "unknown"}`);
          }
        }), m;
      })() })), e(C, "fontSize", 12), e(C, "color", "#FF8E8E93"), I(h, y(re, { get each() {
        return s();
      }, children: (x) => y(Ai, { get author() {
        return x.author;
      }, get body() {
        return x.body;
      }, get num() {
        return x.num;
      } }) }), null), W((x) => e(C, "label", i() || `showing ${t()} tweets`, x)), h;
    })();
  }
  function yi() {
    const [t, r] = z("\u2014 waiting for counter events \u2014"), i = vi(), [l, s] = z("\u2014 tap a button to RPC the Ticker \u2014"), [h, w] = z(null), [p, A] = z(false);
    return (() => {
      var C = o("scrollView"), x = o("text"), m = o("text"), N = o("text");
      return d(C, x), d(C, m), d(C, N), e(C, "background", "#FFF2F2F7"), e(C, "padding", 16), e(C, "gap", 14), e(x, "label", "Libraries \u2014 codegen-wrapped widgets"), e(x, "fontSize", 24), e(x, "fontWeight", 800), e(x, "color", "#FF1C1C1E"), e(m, "label", "Custom adapters + real pub.dev packages, brought into JSX by skal_codegen. Imported from 'skal-flutter'."), e(m, "fontSize", 13), e(m, "color", "#FF8E8E93"), I(C, y(V, { title: "Greeting \u2014 hand-written adapter", get children() {
        var _ = o("greeting");
        return e(_, "name", "Skal"), e(_, "color", "#FF1DA1F2"), e(_, "fontSize", 20), _;
      } }), N), I(C, y(V, { title: "Shimmer \u2014 pub.dev, named-ctor wrap", get children() {
        return [(() => {
          var _ = o("text");
          return e(_, "label", "ShimmerFromColors \u2014 codegen-synthesized from the Shimmer.fromColors named constructor."), e(_, "fontSize", 11), e(_, "color", "#FF8E8E93"), _;
        })(), (() => {
          var _ = o("shimmerFromColors"), b = o("greeting");
          return d(_, b), e(_, "baseColor", 4290624957), e(_, "highlightColor", 4292927712), e(_, "period", 1500), e(b, "name", "loading\u2026"), e(b, "color", "#FF333333"), e(b, "fontSize", 28), _;
        })()];
      } }), N), I(C, y(V, { title: "QR code \u2014 qr_flutter, pub.dev wrap", get children() {
        return [(() => {
          var _ = o("qrImageView");
          return e(_, "data", "https://skal.dev"), e(_, "size", 200), _;
        })(), (() => {
          var _ = o("text");
          return e(_, "label", "QrImageView, generated against qr_flutter's class."), e(_, "fontSize", 11), e(_, "color", "#FF8E8E93"), _;
        })()];
      } }), N), I(C, y(V, { title: "Camera \u2014 host-pattern wrap (controller lifecycle)", get children() {
        return [(() => {
          var _ = o("text");
          return e(_, "label", "A synthesized _CameraHost owns the CameraController (init in initState, dispose on unmount). The controller initializes only once Start mounts <Camera> \u2014 no camera / permission \u2192 an inline error banner."), e(_, "fontSize", 11), e(_, "color", "#FF8E8E93"), _;
        })(), (() => {
          var _ = o("button");
          return e(_, "onClick", () => A(!p())), W((b) => e(_, "label", p() ? "Stop camera" : "Start camera", b)), _;
        })(), Mt(() => Mt(() => !!p())() && (() => {
          var _ = o("box"), b = o("camera");
          return d(_, b), e(_, "background", "#FF000000"), e(_, "padding", 4), e(_, "cornerRadius", 8), e(b, "resolutionIndex", 1), _;
        })())];
      } }), N), I(C, y(V, { title: "Counter \u2014 typed callbacks back to JSX", get children() {
        return [(() => {
          var _ = o("counter");
          return e(_, "initial", 0), e(_, "onChanged", (b) => r(`onChanged(${b})`)), e(_, "onReset", () => r("onReset()")), _;
        })(), (() => {
          var _ = o("text");
          return e(_, "fontSize", 13), e(_, "color", "#FF1C1C1E"), W((b) => e(_, "label", t(), b)), _;
        })()];
      } }), N), I(C, y(V, { title: "Ticker \u2014 JS \u2192 Dart imperative RPC", get children() {
        return [(() => {
          var _ = o("ticker");
          return _i(i, _), e(_, "intervalMs", 500), _;
        })(), (() => {
          var _ = o("wrap"), b = o("button"), v = o("button"), k = o("button"), L = o("button"), S = o("button"), E = o("button"), a = o("button"), f = o("button");
          return d(_, b), d(_, v), d(_, k), d(_, L), d(_, S), d(_, E), d(_, a), d(_, f), e(_, "gap", 6), e(b, "label", "pause"), e(b, "onClick", async () => {
            await i.pause(), s("pause() \u2713");
          }), e(v, "label", "resume"), e(v, "onClick", async () => {
            await i.resume(), s("resume() \u2713");
          }), e(k, "label", "reset"), e(k, "onClick", async () => {
            await i.reset(), s("reset() \u2713");
          }), e(L, "label", "+10"), e(L, "onClick", async () => {
            await i.bump(10), s(`bump(10), now getValue() \u2192 ${await i.getValue()}`);
          }), e(S, "label", "read"), e(S, "onClick", async () => {
            s(`getValue() \u2192 ${await i.getValue()}, isPaused() \u2192 ${await i.isPaused()}`);
          }), e(E, "label", "describe"), e(E, "onClick", async () => {
            s(`describe() \u2192 ${await i.describe("hello from JSX")}`);
          }), e(a, "label", "snapshot"), e(a, "onClick", async () => {
            const F = await i.snapshot();
            s(`snapshot() \u2192 value=${F.value} paused=${F.paused} ts=${F.timestamp}`);
          }), e(f, "label", "sub/unsub"), e(f, "onClick", () => {
            if (h())
              h()(), w(() => null), s("unsubscribed from ticks$");
            else {
              const F = i.ticks$((R) => {
                s(`stream tick: ${R}`);
              });
              w(() => F), s("subscribed to ticks$ \u2014 wait for emissions\u2026");
            }
          }), _;
        })(), (() => {
          var _ = o("text");
          return e(_, "fontSize", 13), e(_, "color", "#FF1C1C1E"), W((b) => e(_, "label", l(), b)), _;
        })()];
      } }), N), I(C, y(V, { title: "Stickers \u2014 List<Widget> children + gradient prop", get children() {
        var _ = o("stickers"), b = o("greeting"), v = o("greeting"), k = o("greeting");
        return d(_, b), d(_, v), d(_, k), e(_, "gap", 6), e(_, "padding", 10), e(_, "gradient", { type: "linear", colors: ["#FFFFE082", "#FFB0F0D0", "#FFB0E0FF"], stops: [0, 0.5, 1], begin: "topLeft", end: "bottomRight" }), e(b, "name", "multi-child A"), e(b, "color", "#FF6B4F00"), e(b, "fontSize", 14), e(v, "name", "multi-child B"), e(v, "color", "#FF6B4F00"), e(v, "fontSize", 14), e(k, "name", "multi-child C"), e(k, "color", "#FF6B4F00"), e(k, "fontSize", 14), _;
      } }), N), e(N, "label", "\u2014 end of Libs demo \u2014"), e(N, "fontSize", 12), e(N, "color", "#FF8E8E93"), C;
    })();
  }
  function ki() {
    const [t, r] = z(0);
    return (() => {
      var i = o("tabs"), l = o("tab"), s = o("tab"), h = o("tab");
      return d(i, l), d(i, s), d(i, h), e(i, "onChange", r), e(i, "height", "fill"), e(l, "title", "UI"), e(l, "icon", "grid"), I(l, y(Ti, {})), e(s, "title", "List"), e(s, "icon", "list"), I(s, y($i, {})), e(h, "title", "Libs"), e(h, "icon", "explore"), I(h, y(yi, {})), W((w) => e(i, "activeTab", t(), w)), i;
    })();
  }
  Fi(() => y(ki, {}), bi);
})();
})
