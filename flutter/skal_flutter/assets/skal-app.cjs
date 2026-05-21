// @bun @bytecode @bun-cjs
(function(exports, require, module, __filename, __dirname) {// ../flutter/skal_flutter/assets/skal-app.js
(function() {
  var ue = { context: undefined, registry: undefined, effects: undefined, done: false, getContextId() {
    return Yr(this.context.count);
  }, getNextContextId() {
    return Yr(this.context.count++);
  } };
  function Yr(t) {
    const r = String(t), i = r.length - 1;
    return ue.context.id + (i ? String.fromCharCode(96 + i) : "") + r;
  }
  function gr(t) {
    ue.context = t;
  }
  function ri() {
    return { ...ue.context, id: ue.getNextContextId(), count: 0 };
  }
  var ni = (t, r) => t === r, Pe = Symbol("solid-proxy"), ii = typeof Proxy == "function", _r = Symbol("solid-track"), Ut = { equals: ni }, Zr = null, Qr = an, Se = 1, St = 2, en = { owned: null, cleanups: null, context: null, owner: null }, Q = null, L = null, mt = null, ot = null, ne = null, ce = null, fe = null, Vt = 0;
  function Ht(t, r) {
    const i = ne, o = Q, a = t.length === 0, f = r === undefined ? o : r, h = a ? en : { owned: null, cleanups: null, context: f ? f.context : null, owner: f }, p = a ? t : () => t(() => ze(() => Ne(h)));
    Q = h, ne = null;
    try {
      return Te(p, true);
    } finally {
      ne = i, Q = o;
    }
  }
  function G(t, r) {
    r = r ? Object.assign({}, Ut, r) : Ut;
    const i = { value: t, observers: null, observerSlots: null, comparator: r.equals || undefined }, o = (a) => (typeof a == "function" && (L && L.running && L.sources.has(i) ? a = a(i.tValue) : a = a(i.value)), ln(i, a));
    return [on.bind(i), o];
  }
  function De(t, r, i) {
    const o = vr(t, r, false, Se);
    mt && L && L.running ? ce.push(o) : wt(o);
  }
  function br(t, r, i) {
    Qr = ui;
    const o = vr(t, r, false, Se), a = Fr && si(Fr);
    a && (o.suspense = a), (!i || !i.render) && (o.user = true), fe ? fe.push(o) : wt(o);
  }
  function Gt(t, r, i) {
    i = i ? Object.assign({}, Ut, i) : Ut;
    const o = vr(t, r, true, 0);
    return o.observers = null, o.observerSlots = null, o.comparator = i.equals || undefined, mt && L && L.running ? (o.tState = Se, ce.push(o)) : wt(o), on.bind(o);
  }
  function tn(t) {
    return Te(t, false);
  }
  function ze(t) {
    if (!ot && ne === null)
      return t();
    const r = ne;
    ne = null;
    try {
      return ot ? ot.untrack(t) : t();
    } finally {
      ne = r;
    }
  }
  function oi(t) {
    br(() => ze(t));
  }
  function rn(t) {
    return Q === null || (Q.cleanups === null ? Q.cleanups = [t] : Q.cleanups.push(t)), t;
  }
  function pr() {
    return ne;
  }
  function li(t) {
    if (L && L.running)
      return t(), L.done;
    const r = ne, i = Q;
    return Promise.resolve().then(() => {
      ne = r, Q = i;
      let o;
      return (mt || Fr) && (o = L || (L = { sources: new Set, effects: [], promises: new Set, disposed: new Set, queue: new Set, running: true }), o.done || (o.done = new Promise((a) => o.resolve = a)), o.running = true), Te(t, false), ne = Q = null, o ? o.done : undefined;
    });
  }
  var [xl, nn] = G(false);
  function si(t) {
    let r;
    return Q && Q.context && (r = Q.context[t.id]) !== undefined ? r : t.defaultValue;
  }
  var Fr;
  function on() {
    const t = L && L.running;
    if (this.sources && (t ? this.tState : this.state))
      if ((t ? this.tState : this.state) === Se)
        wt(this);
      else {
        const r = ce;
        ce = null, Te(() => jt(this), false), ce = r;
      }
    if (ne) {
      const r = this.observers ? this.observers.length : 0;
      ne.sources ? (ne.sources.push(this), ne.sourceSlots.push(r)) : (ne.sources = [this], ne.sourceSlots = [r]), this.observers ? (this.observers.push(ne), this.observerSlots.push(ne.sources.length - 1)) : (this.observers = [ne], this.observerSlots = [ne.sources.length - 1]);
    }
    return t && L.sources.has(this) ? this.tValue : this.value;
  }
  function ln(t, r, i) {
    let o = L && L.running && L.sources.has(t) ? t.tValue : t.value;
    if (!t.comparator || !t.comparator(o, r)) {
      if (L) {
        const a = L.running;
        (a || !i && L.sources.has(t)) && (L.sources.add(t), t.tValue = r), a || (t.value = r);
      } else
        t.value = r;
      t.observers && t.observers.length && Te(() => {
        for (let a = 0;a < t.observers.length; a += 1) {
          const f = t.observers[a], h = L && L.running;
          h && L.disposed.has(f) || ((h ? !f.tState : !f.state) && (f.pure ? ce.push(f) : fe.push(f), f.observers && cn(f)), h ? f.tState = Se : f.state = Se);
        }
        if (ce.length > 1e6)
          throw ce = [], new Error;
      }, false);
    }
    return r;
  }
  function wt(t) {
    if (!t.fn)
      return;
    Ne(t);
    const r = Vt;
    sn(t, L && L.running && L.sources.has(t) ? t.tValue : t.value, r), L && !L.running && L.sources.has(t) && queueMicrotask(() => {
      Te(() => {
        L && (L.running = true), ne = Q = t, sn(t, t.tValue, r), ne = Q = null;
      }, false);
    });
  }
  function sn(t, r, i) {
    let o;
    const a = Q, f = ne;
    ne = Q = t;
    try {
      o = t.fn(r);
    } catch (h) {
      return t.pure && (L && L.running ? (t.tState = Se, t.tOwned && t.tOwned.forEach(Ne), t.tOwned = undefined) : (t.state = Se, t.owned && t.owned.forEach(Ne), t.owned = null)), t.updatedAt = i + 1, Er(h);
    } finally {
      ne = f, Q = a;
    }
    (!t.updatedAt || t.updatedAt <= i) && (t.updatedAt != null && ("observers" in t) ? ln(t, o, true) : L && L.running && t.pure ? (L.sources.has(t) || (t.value = o), L.sources.add(t), t.tValue = o) : t.value = o, t.updatedAt = i);
  }
  function vr(t, r, i, o = Se, a) {
    const f = { fn: t, state: o, updatedAt: null, owned: null, sources: null, sourceSlots: null, cleanups: null, value: r, owner: Q, context: Q ? Q.context : null, pure: i };
    if (L && L.running && (f.state = 0, f.tState = o), Q === null || Q !== en && (L && L.running && Q.pure ? Q.tOwned ? Q.tOwned.push(f) : Q.tOwned = [f] : Q.owned ? Q.owned.push(f) : Q.owned = [f]), ot && f.fn) {
      const h = f.fn, [p, g] = G(undefined, { equals: false }), F = ot.factory(h, g);
      rn(() => F.dispose());
      let R;
      const P = () => li(g).then(() => {
        R && (R.dispose(), R = undefined);
      });
      f.fn = (O) => (p(), L && L.running ? (R || (R = ot.factory(h, P)), R.track(O)) : F.track(O));
    }
    return f;
  }
  function yt(t) {
    const r = L && L.running;
    if ((r ? t.tState : t.state) === 0)
      return;
    if ((r ? t.tState : t.state) === St)
      return jt(t);
    if (t.suspense && ze(t.suspense.inFallback))
      return t.suspense.effects.push(t);
    const i = [t];
    for (;(t = t.owner) && (!t.updatedAt || t.updatedAt < Vt); ) {
      if (r && L.disposed.has(t))
        return;
      (r ? t.tState : t.state) && i.push(t);
    }
    for (let o = i.length - 1;o >= 0; o--) {
      if (t = i[o], r) {
        let a = t, f = i[o + 1];
        for (;(a = a.owner) && a !== f; )
          if (L.disposed.has(a))
            return;
      }
      if ((r ? t.tState : t.state) === Se)
        wt(t);
      else if ((r ? t.tState : t.state) === St) {
        const a = ce;
        ce = null, Te(() => jt(t, i[0]), false), ce = a;
      }
    }
  }
  function Te(t, r) {
    if (ce)
      return t();
    let i = false;
    r || (ce = []), fe ? i = true : fe = [], Vt++;
    try {
      const o = t();
      return ai(i), o;
    } catch (o) {
      i || (fe = null), ce = null, Er(o);
    }
  }
  function ai(t) {
    if (ce && (mt && L && L.running ? ci(ce) : an(ce), ce = null), t)
      return;
    let r;
    if (L) {
      if (!L.promises.size && !L.queue.size) {
        const { sources: o, disposed: a } = L;
        fe.push.apply(fe, L.effects), r = L.resolve;
        for (const f of fe)
          "tState" in f && (f.state = f.tState), delete f.tState;
        L = null, Te(() => {
          for (const f of a)
            Ne(f);
          for (const f of o) {
            if (f.value = f.tValue, f.owned)
              for (let h = 0, p = f.owned.length;h < p; h++)
                Ne(f.owned[h]);
            f.tOwned && (f.owned = f.tOwned), delete f.tValue, delete f.tOwned, f.tState = 0;
          }
          nn(false);
        }, false);
      } else if (L.running) {
        L.running = false, L.effects.push.apply(L.effects, fe), fe = null, nn(true);
        return;
      }
    }
    const i = fe;
    fe = null, i.length && Te(() => Qr(i), false), r && r();
  }
  function an(t) {
    for (let r = 0;r < t.length; r++)
      yt(t[r]);
  }
  function ci(t) {
    for (let r = 0;r < t.length; r++) {
      const i = t[r], o = L.queue;
      o.has(i) || (o.add(i), mt(() => {
        o.delete(i), Te(() => {
          L.running = true, yt(i);
        }, false), L && (L.running = false);
      }));
    }
  }
  function ui(t) {
    let r, i = 0;
    for (r = 0;r < t.length; r++) {
      const o = t[r];
      o.user ? t[i++] = o : yt(o);
    }
    if (ue.context) {
      if (ue.count) {
        ue.effects || (ue.effects = []), ue.effects.push(...t.slice(0, i));
        return;
      }
      gr();
    }
    for (ue.effects && (ue.done || !ue.count) && (t = [...ue.effects, ...t], i += ue.effects.length, delete ue.effects), r = 0;r < i; r++)
      yt(t[r]);
  }
  function jt(t, r) {
    const i = L && L.running;
    i ? t.tState = 0 : t.state = 0;
    for (let o = 0;o < t.sources.length; o += 1) {
      const a = t.sources[o];
      if (a.sources) {
        const f = i ? a.tState : a.state;
        f === Se ? a !== r && (!a.updatedAt || a.updatedAt < Vt) && yt(a) : f === St && jt(a, r);
      }
    }
  }
  function cn(t) {
    const r = L && L.running;
    for (let i = 0;i < t.observers.length; i += 1) {
      const o = t.observers[i];
      (r ? !o.tState : !o.state) && (r ? o.tState = St : o.state = St, o.pure ? ce.push(o) : fe.push(o), o.observers && cn(o));
    }
  }
  function Ne(t) {
    let r;
    if (t.sources)
      for (;t.sources.length; ) {
        const i = t.sources.pop(), o = t.sourceSlots.pop(), a = i.observers;
        if (a && a.length) {
          const f = a.pop(), h = i.observerSlots.pop();
          o < a.length && (f.sourceSlots[h] = o, a[o] = f, i.observerSlots[o] = h);
        }
      }
    if (t.tOwned) {
      for (r = t.tOwned.length - 1;r >= 0; r--)
        Ne(t.tOwned[r]);
      delete t.tOwned;
    }
    if (L && L.running && t.pure)
      un(t, true);
    else if (t.owned) {
      for (r = t.owned.length - 1;r >= 0; r--)
        Ne(t.owned[r]);
      t.owned = null;
    }
    if (t.cleanups) {
      for (r = t.cleanups.length - 1;r >= 0; r--)
        t.cleanups[r]();
      t.cleanups = null;
    }
    L && L.running ? t.tState = 0 : t.state = 0;
  }
  function un(t, r) {
    if (r || (t.tState = 0, L.disposed.add(t)), t.owned)
      for (let i = 0;i < t.owned.length; i++)
        un(t.owned[i]);
  }
  function fi(t) {
    return t instanceof Error ? t : new Error(typeof t == "string" ? t : "Unknown error", { cause: t });
  }
  function fn(t, r, i) {
    try {
      for (const o of r)
        o(t);
    } catch (o) {
      Er(o, i && i.owner || null);
    }
  }
  function Er(t, r = Q) {
    const i = Zr && r && r.context && r.context[Zr], o = fi(t);
    if (!i)
      throw o;
    fe ? fe.push({ fn() {
      fn(o, i, r);
    }, state: Se }) : fn(o, i, r);
  }
  var di = Symbol("fallback");
  function dn(t) {
    for (let r = 0;r < t.length; r++)
      t[r]();
  }
  function hi(t, r, i = {}) {
    let o = [], a = [], f = [], h = 0, p = r.length > 1 ? [] : null;
    return rn(() => dn(f)), () => {
      let g = t() || [], F = g.length, R, P;
      return g[_r], ze(() => {
        let w, x, E, k, V, T, A, d, S;
        if (F === 0)
          h !== 0 && (dn(f), f = [], o = [], a = [], h = 0, p && (p = [])), i.fallback && (o = [di], a[0] = Ht((y) => (f[0] = y, i.fallback())), h = 1);
        else if (h === 0) {
          for (a = new Array(F), P = 0;P < F; P++)
            o[P] = g[P], a[P] = Ht(O);
          h = F;
        } else {
          for (E = new Array(F), k = new Array(F), p && (V = new Array(F)), T = 0, A = Math.min(h, F);T < A && o[T] === g[T]; T++)
            ;
          for (A = h - 1, d = F - 1;A >= T && d >= T && o[A] === g[d]; A--, d--)
            E[d] = a[A], k[d] = f[A], p && (V[d] = p[A]);
          for (w = new Map, x = new Array(d + 1), P = d;P >= T; P--)
            S = g[P], R = w.get(S), x[P] = R === undefined ? -1 : R, w.set(S, P);
          for (R = T;R <= A; R++)
            S = o[R], P = w.get(S), P !== undefined && P !== -1 ? (E[P] = a[R], k[P] = f[R], p && (V[P] = p[R]), P = x[P], w.set(S, P)) : f[R]();
          for (P = T;P < F; P++)
            P in E ? (a[P] = E[P], f[P] = k[P], p && (p[P] = V[P], p[P](P))) : a[P] = Ht(O);
          a = a.slice(0, h = F), o = g.slice(0);
        }
        return a;
      });
      function O(w) {
        if (f[P] = w, p) {
          const [x, E] = G(P);
          return p[P] = E, r(g[P], x);
        }
        return r(g[P]);
      }
    };
  }
  var gi = false;
  function _i(t, r) {
    if (gi && ue.context) {
      const i = ue.context;
      gr(ri());
      const o = ze(() => t(r || {}));
      return gr(i), o;
    }
    return ze(() => t(r || {}));
  }
  function qt() {
    return true;
  }
  var bi = { get(t, r, i) {
    return r === Pe ? i : t.get(r);
  }, has(t, r) {
    return r === Pe ? true : t.has(r);
  }, set: qt, deleteProperty: qt, getOwnPropertyDescriptor(t, r) {
    return { configurable: true, enumerable: true, get() {
      return t.get(r);
    }, set: qt, deleteProperty: qt };
  }, ownKeys(t) {
    return t.keys();
  } };
  function Sr(t) {
    return (t = typeof t == "function" ? t() : t) ? t : {};
  }
  function pi() {
    for (let t = 0, r = this.length;t < r; ++t) {
      const i = this[t]();
      if (i !== undefined)
        return i;
    }
  }
  function hn(...t) {
    let r = false;
    for (let h = 0;h < t.length; h++) {
      const p = t[h];
      r = r || !!p && Pe in p, t[h] = typeof p == "function" ? (r = true, Gt(p)) : p;
    }
    if (ii && r)
      return new Proxy({ get(h) {
        for (let p = t.length - 1;p >= 0; p--) {
          const g = Sr(t[p])[h];
          if (g !== undefined)
            return g;
        }
      }, has(h) {
        for (let p = t.length - 1;p >= 0; p--)
          if (h in Sr(t[p]))
            return true;
        return false;
      }, keys() {
        const h = [];
        for (let p = 0;p < t.length; p++)
          h.push(...Object.keys(Sr(t[p])));
        return [...new Set(h)];
      } }, bi);
    const i = {}, o = Object.create(null);
    for (let h = t.length - 1;h >= 0; h--) {
      const p = t[h];
      if (!p)
        continue;
      const g = Object.getOwnPropertyNames(p);
      for (let F = g.length - 1;F >= 0; F--) {
        const R = g[F];
        if (R === "__proto__" || R === "constructor")
          continue;
        const P = Object.getOwnPropertyDescriptor(p, R);
        if (!o[R])
          o[R] = P.get ? { enumerable: true, configurable: true, get: pi.bind(i[R] = [P.get.bind(p)]) } : P.value !== undefined ? P : undefined;
        else {
          const O = i[R];
          O && (P.get ? O.push(P.get.bind(p)) : P.value !== undefined && O.push(() => P.value));
        }
      }
    }
    const a = {}, f = Object.keys(o);
    for (let h = f.length - 1;h >= 0; h--) {
      const p = f[h], g = o[p];
      g && g.get ? Object.defineProperty(a, p, g) : a[p] = g ? g.value : undefined;
    }
    return a;
  }
  function le(t) {
    const r = "fallback" in t && { fallback: () => t.fallback };
    return Gt(hi(() => t.each, t.children, r || undefined));
  }
  var Fi = (t) => Gt(() => t());
  function vi({ createElement: t, createTextNode: r, isTextNode: i, replaceText: o, insertNode: a, removeNode: f, setProperty: h, getParentNode: p, getFirstChild: g, getNextSibling: F }) {
    function R(T, A, d, S) {
      if (d !== undefined && !S && (S = []), typeof A != "function")
        return P(T, A, S, d);
      De((y) => P(T, A(), y, d), S);
    }
    function P(T, A, d, S, y) {
      for (;typeof d == "function"; )
        d = d();
      if (A === d)
        return d;
      const C = typeof A, I = S !== undefined;
      if (C === "string" || C === "number")
        if (C === "number" && (A = A.toString()), I) {
          let W = d[0];
          W && i(W) ? o(W, A) : W = r(A), d = x(T, d, S, W);
        } else
          d !== "" && typeof d == "string" ? o(g(T), d = A) : (x(T, d, S, r(A)), d = A);
      else if (A == null || C === "boolean")
        d = x(T, d, S);
      else {
        if (C === "function")
          return De(() => {
            let W = A();
            for (;typeof W == "function"; )
              W = W();
            d = P(T, W, d, S);
          }), () => d;
        if (Array.isArray(A)) {
          const W = [];
          if (O(W, A, y))
            return De(() => d = P(T, W, d, S, true)), () => d;
          if (W.length === 0) {
            const ae = x(T, d, S);
            if (I)
              return d = ae;
          } else
            Array.isArray(d) ? d.length === 0 ? E(T, W, S) : w(T, d, W) : d == null || d === "" ? E(T, W) : w(T, I && d || [g(T)], W);
          d = W;
        } else {
          if (Array.isArray(d)) {
            if (I)
              return d = x(T, d, S, A);
            x(T, d, null, A);
          } else
            d == null || d === "" || !g(T) ? a(T, A) : k(T, A, g(T));
          d = A;
        }
      }
      return d;
    }
    function O(T, A, d) {
      let S = false;
      for (let y = 0, C = A.length;y < C; y++) {
        let I = A[y], W;
        if (!(I == null || I === true || I === false))
          if (Array.isArray(I))
            S = O(T, I) || S;
          else if ((W = typeof I) == "string" || W === "number")
            T.push(r(I));
          else if (W === "function")
            if (d) {
              for (;typeof I == "function"; )
                I = I();
              S = O(T, Array.isArray(I) ? I : [I]) || S;
            } else
              T.push(I), S = true;
          else
            T.push(I);
      }
      return S;
    }
    function w(T, A, d) {
      let S = d.length, y = A.length, C = S, I = 0, W = 0, ae = F(A[y - 1]), re = null;
      for (;I < y || W < C; ) {
        if (A[I] === d[W]) {
          I++, W++;
          continue;
        }
        for (;A[y - 1] === d[C - 1]; )
          y--, C--;
        if (y === I) {
          const be = C < S ? W ? F(d[W - 1]) : d[C - W] : ae;
          for (;W < C; )
            a(T, d[W++], be);
        } else if (C === W)
          for (;I < y; )
            (!re || !re.has(A[I])) && f(T, A[I]), I++;
        else if (A[I] === d[C - 1] && d[W] === A[y - 1]) {
          const be = F(A[--y]);
          a(T, d[W++], F(A[I++])), a(T, d[--C], be), A[y] = d[C];
        } else {
          if (!re) {
            re = new Map;
            let ie = W;
            for (;ie < C; )
              re.set(d[ie], ie++);
          }
          const be = re.get(A[I]);
          if (be != null)
            if (W < be && be < C) {
              let ie = I, pe = 1, Qe;
              for (;++ie < y && ie < C && !((Qe = re.get(A[ie])) == null || Qe !== be + pe); )
                pe++;
              if (pe > be - W) {
                const Et = A[I];
                for (;W < be; )
                  a(T, d[W++], Et);
              } else
                k(T, d[W++], A[I++]);
            } else
              I++;
          else
            f(T, A[I++]);
        }
      }
    }
    function x(T, A, d, S) {
      if (d === undefined) {
        let C;
        for (;C = g(T); )
          f(T, C);
        return S && a(T, S), "";
      }
      const y = S || r("");
      if (A.length) {
        let C = false;
        for (let I = A.length - 1;I >= 0; I--) {
          const W = A[I];
          if (y !== W) {
            const ae = p(W) === T;
            !C && !I ? ae ? k(T, y, W) : a(T, y, d) : ae && f(T, W);
          } else
            C = true;
        }
      } else
        a(T, y, d);
      return [y];
    }
    function E(T, A, d) {
      for (let S = 0, y = A.length;S < y; S++)
        a(T, A[S], d);
    }
    function k(T, A, d) {
      a(T, A, d), f(T, d);
    }
    function V(T, A, d = {}, S) {
      return A || (A = {}), S || De(() => d.children = P(T, A.children, d.children)), De(() => A.ref && A.ref(T)), De(() => {
        for (const y in A) {
          if (y === "children" || y === "ref")
            continue;
          const C = A[y];
          C !== d[y] && (h(T, y, C, d[y]), d[y] = C);
        }
      }), d;
    }
    return { render(T, A) {
      let d;
      return Ht((S) => {
        d = S, R(A, T());
      }), d;
    }, insert: R, spread(T, A, d) {
      typeof A == "function" ? De((S) => V(T, A(), S, d)) : V(T, A, undefined, d);
    }, createElement: t, createTextNode: r, insertNode: a, setProp(T, A, d, S) {
      return h(T, A, d, S), d;
    }, mergeProps: hn, effect: De, memo: Fi, createComponent: _i, use(T, A, d) {
      return ze(() => T(A, d));
    } };
  }
  function Ei(t) {
    const r = vi(t);
    return r.mergeProps = hn, r;
  }
  var gn = 6 * 1024 * 1024, Si = 64, Pl = Si, _n = 4 * 1024 * 1024, lt = 64 + _n, mr = 768 * 1024, wr = lt + mr, mi = 256 * 1024, yr = wr + mi, bn = lt + mr, wi = 0, yi = 8, xi = 12, Pi = 16, Ti = 24, Ri = 28, Ai = 32, $i = 40, Ci = 44, Oi = yi >> 2, ki = xi >> 2, Ii = Ti >> 2, pn = Ri >> 2, Di = $i >> 2;
  Ci >> 2;
  var zi = wi >> 3, Ni = Pi >> 3, Li = Ai >> 3, Tl = 1, Rl = 2, Al = 3, $l = 4, Cl = 16, Ol = 17, kl = 20, Il = 21, Dl = 22, zl = 23, Nl = 24, Ll = 25, Bl = 26, Ml = 27, Wl = 28, Ul = 29, Vl = 30, Hl = 31, Gl = 32, jl = 33, ql = 34, Kl = 35, Xl = 36, Jl = 37, Yl = 38, Zl = 39, Ql = 0, es = 1, ts = 2, rs = 3, ns = 4, is = 5, os = 6, ls = 7, ss = 9, as = 10, cs = 11, us = 12, fs = 13, ds = 14, hs = 15, gs = 16, _s = 17, bs = 18, ps = 19, Fs = 20, vs = 21, Es = 22, Ss = 23, ms = 24, ws = 25, ys = 26, xs = 27, Ps = 28, Ts = 29, Rs = 30, As = 31, $s = 32, Cs = 33, Os = 34, ks = 35, Is = 36, Ds = 37, zs = 38, Ns = 39, Ls = 40, Bs = 41, Ms = 42, Ws = 43, Us = 44, Vs = 45, Hs = 46, Gs = 47, js = 48, qs = 1, Ks = 2, Xs = 3, Js = 4, Ys = 5, Zs = 6, Qs = 7, ea = 8, ta = 9, ra = 10, na = 11, ia = 12, oa = 13, la = 14, sa = 15, aa = 16, ca = 17, ua = 18, fa = 19, da = 20, ha = 21, ga = 22, _a = 23, ba = 0, pa = 1, Fa = 2, va = 3, Ea = 4, Sa = 5, ma = 6, wa = 7, ya = 0, xa = 1, Pa = 2, Ta = 3, Ra = 4, Aa = 5, $a = 6, Ca = 7, Oa = 8, ka = 9, Ia = 10, Da = 11, za = 12, Na = 13, La = 14, Ba = 15, Ma = 16, Wa = 32, Ua = 33, Va = 34, Ha = 35, Ga = 36, ja = 37, qa = 64, Ka = 65, Xa = 66, Ja = 67, Ya = 68, Za = 69, Qa = 70, ec = 71, tc = 72, rc = 73, nc = 74, ic = 75, oc = 96, lc = 97, sc = 98, ac = 99, cc = 128, uc = 129, fc = 130, dc = 131, hc = 132, gc = 133, _c = 134, bc = 135, pc = 136, Fc = 137, vc = 160, Ec = 161, Sc = 162, mc = 163, wc = 164, yc = 165, xc = 166, Pc = 167, Tc = 168, Rc = 169, Ac = 170, $c = 171, Cc = 172, Oc = 173, kc = 174, Ic = 175, Dc = 176, zc = 177, Nc = 178, Lc = 179, Bc = 180, Mc = 181, Wc = 182, Uc = -1, Bi = 2147483646, Mi = 2147483645, Ve = globalThis.__skal_acquireBridge();
  if (!Ve || Ve.byteLength !== gn)
    throw new Error(`Skal: bridge buffer not available (got ${Ve && Ve.byteLength})`);
  var Fn = new Uint8Array(Ve), _e = new Uint32Array(Ve), xr = new BigInt64Array(Ve), Wi = new TextEncoder, xt = 16, Ui = 64 + _n >> 2, Vi = 16384, Hi = Ui - 4, Kt = 0n, Le = xt, st = lt, Xt = xt;
  function Pr() {
    _e[Oi] = Le - xt << 2, _e[ki] = st - lt, Kt += 1n, Atomics.store(xr, zi, Kt), Xt = Le;
  }
  function vn() {
    Pr();
    const t = Kt, r = performance.now() + 5000;
    for (;!(Atomics.load(xr, Li) >= t); )
      if (performance.now() > r) {
        console.warn("Skal: drain spin timeout \u2014 UI thread slow; ring will overwrite");
        break;
      }
    Le = xt, st = lt, Xt = xt;
  }
  function ee(t, r, i, o) {
    let a = Le;
    a >= Hi && (vn(), a = Le), _e[a] = t >>> 0, _e[a + 1] = r >>> 0, _e[a + 2] = i >>> 0, _e[a + 3] = o >>> 0, Le = a + 4, Le - Xt >= Vi && Pr();
  }
  var He = 0, Ge = 0;
  function at(t) {
    st + t.length * 3 > bn && vn();
    const r = st - lt, i = Fn.subarray(st, bn), { read: o, written: a } = Wi.encodeInto(t, i);
    if (o !== t.length)
      throw new Error(`Skal: string too large for heap (${t.length} code units > ${mr} bytes)`);
    st += a, He = r, Ge = a;
  }
  function Jt(t, r) {
    at(r), ee(20, t, He, Ge);
  }
  var Tr = false;
  function Gi() {
    Tr = false, Le !== Xt && Pr();
  }
  function J() {
    Tr || (Tr = true, queueMicrotask(Gi));
  }
  var Re = 1024, M = new Int8Array(256);
  M.fill(-1), M[0] = 0, M[1] = 1, M[2] = 2, M[3] = 3, M[4] = 4, M[5] = 5, M[6] = 6, M[7] = 7, M[8] = 8, M[9] = 9, M[32] = 10, M[33] = 11, M[34] = 12, M[35] = 13, M[36] = 14, M[37] = 15, M[64] = 16, M[65] = 17, M[66] = 18, M[67] = 19, M[68] = 20, M[69] = 21, M[70] = 22, M[96] = 23, M[97] = 24, M[128] = 25, M[129] = 26, M[130] = 27, M[131] = 28, M[160] = 29, M[161] = 30, M[162] = 31, M[10] = 32, M[11] = 33, M[12] = 34, M[13] = 35, M[14] = 36, M[15] = 37, M[16] = 38, M[132] = 39, M[133] = 40, M[134] = 41, M[135] = 42, M[136] = 43, M[163] = 44, M[164] = 45, M[165] = 46, M[166] = 47, M[71] = 48, M[98] = 49, M[137] = 50, M[72] = 51, M[167] = 52, M[168] = 53, M[169] = 54, M[170] = 55, M[171] = 56, M[172] = 57, M[173] = 58, M[174] = 59, M[73] = 60, M[99] = 61, M[175] = 62, M[74] = 63;
  var Fe = 64, Yt = new Int32Array(Re * Fe), Pt = new Float32Array(Re * Fe), Zt = new Array(Re * Fe), Tt = new Uint8Array(Re * Fe), ct = 6, ut = new Float32Array(Re * ct);
  ut.fill(NaN);
  var Qt = new Map, En = [], ji = 0;
  function qi() {
    const t = Re * 2, r = Re * Fe, i = t * Fe, o = Re * ct, a = t * ct, f = new Int32Array(i);
    f.set(Yt), Yt = f;
    const h = new Uint8Array(i);
    h.set(Tt), Tt = h;
    const p = new Float32Array(i);
    p.set(Pt), p.fill(NaN, r), Pt = p;
    const g = new Float32Array(a);
    g.set(ut), g.fill(NaN, o), ut = g, Zt.length = i, Re = t;
  }
  function er(t) {
    let r = Qt.get(t);
    if (r === undefined) {
      r = En.pop(), r === undefined && (r = ji++), r >= Re && qi(), Qt.set(t, r);
      const i = r * Fe;
      Tt.fill(0, i, i + Fe), Pt.fill(NaN, i, i + Fe);
      for (let o = i;o < i + Fe; o++)
        Zt[o] = undefined;
    }
    return r;
  }
  var Sn = new Map, mn = new Map, wn = new Map, ft = new Map;
  function Ki(t) {
    const r = Qt.get(t);
    if (r !== undefined) {
      Qt.delete(t), En.push(r);
      const i = r * ct;
      ut.fill(NaN, i, i + ct);
    }
    Sn.delete(t), mn.delete(t), wn.delete(t), _o(t);
  }
  var we = 0, Be = 0, dt = new Float32Array(1), Rt = new Uint32Array(dt.buffer);
  function he(t, r, i) {
    const o = i | 0, a = M[r];
    if (a < 0) {
      ee(16, t, r, o), we++;
      return;
    }
    const f = er(t) * Fe + a;
    if (Tt[f] !== 0 && Yt[f] === o) {
      Be++;
      return;
    }
    Yt[f] = o, Tt[f] = 1, ee(16, t, r, o), we++;
  }
  function yn(t, r, i) {
    const o = M[r];
    if (o < 0) {
      dt[0] = i, ee(17, t, r, Rt[0]), we++;
      return;
    }
    const a = er(t) * Fe + o;
    if (Pt[a] === i) {
      Be++;
      return;
    }
    Pt[a] = i, dt[0] = i, ee(17, t, r, Rt[0]), we++;
  }
  function Xi(t, r, i) {
    const o = M[r];
    if (o < 0) {
      at(i == null ? "" : String(i)), ee(22, t, (r & 255) << 24 | He & 16777215, Ge), we++;
      return;
    }
    const a = er(t) * Fe + o;
    if (Zt[a] === i) {
      Be++;
      return;
    }
    Zt[a] = i, at(i == null ? "" : String(i)), ee(22, t, (r & 255) << 24 | He & 16777215, Ge), we++;
  }
  function ht(t, r, i, o) {
    const a = er(t) * ct + i;
    if (ut[a] === o) {
      Be++;
      return;
    }
    ut[a] = o, dt[0] = o, ee(r, t, 0, Rt[0]), we++;
  }
  function Ji(t, r) {
    ht(t, 32, 0, r);
  }
  function Yi(t, r) {
    ht(t, 33, 1, r);
  }
  function Zi(t, r) {
    ht(t, 34, 2, r);
  }
  function Qi(t, r) {
    ht(t, 35, 3, r);
  }
  function eo(t, r) {
    ht(t, 36, 4, r);
  }
  function to(t, r) {
    ht(t, 37, 5, r);
  }
  var ro = { material: 0, cupertino: 1, adaptive: 2 }, no = { light: 0, dark: 1 };
  function io(t, r) {
    ee(38, typeof t == "string" ? ro[t] ?? 0 : t | 0, typeof r == "string" ? no[r] ?? 0 : r | 0, 0), J();
  }
  function oo(t) {
    ee(39, t, 0, 0), J();
  }
  function xn(t) {
    return qe(1, "showDialog", [JSON.stringify(t || {})]);
  }
  function lo(t) {
    return qe(1, "showActionSheet", [JSON.stringify(t || {})]);
  }
  function Pn(t) {
    return qe(1, "showSnackbar", [JSON.stringify(typeof t == "string" ? { message: t } : t || {})]);
  }
  function so(t) {
    return qe(1, "showDatePicker", [JSON.stringify(t || {})]);
  }
  function ao(t) {
    return qe(1, "showTimePicker", [JSON.stringify(t || {})]);
  }
  function co() {
    return qe(1, "getDataDir", []);
  }
  var Tn = new Map;
  function uo(t) {
    let r = 2166136261;
    for (let i = 0;i < t.length; i++)
      r ^= t.charCodeAt(i), r = Math.imul(r, 16777619) >>> 0;
    return r;
  }
  function je(t) {
    let r = Tn.get(t);
    return r !== undefined || (r = uo(t), at(t), ee(23, r, He, Ge), Tn.set(t, r)), r;
  }
  function fo(t, r) {
    ee(4, t, je(r), 0);
  }
  function Rr(t, r) {
    let i = t.get(r);
    return i === undefined && (i = new Map, t.set(r, i)), i;
  }
  function Rn(t, r, i) {
    const o = je(r), a = i >>> 0, f = Rr(Sn, t);
    if (f.get(o) === a) {
      Be++;
      return;
    }
    f.set(o, a), ee(24, t, o, a), we++;
  }
  function An(t, r, i) {
    const o = je(r), a = Rr(mn, t);
    if (a.get(o) === i) {
      Be++;
      return;
    }
    a.set(o, i), dt[0] = i, ee(25, t, o, Rt[0]), we++;
  }
  function $n(t, r, i) {
    const o = je(r), a = i == null ? "" : String(i), f = Rr(wn, t);
    if (f.get(o) === a) {
      Be++;
      return;
    }
    f.set(o, a), at(a);
    const h = He & 16777215, p = Ge & 255;
    ee(26, t, o, h << 8 | p), we++;
  }
  function ho(t, r, i) {
    ee(27, t, je(r), i);
  }
  var At = new Map, Ae = new Map, Cn = 1;
  function On(t, r) {
    for (let i = 0;i < r.length; i++) {
      const o = r[i];
      if (typeof o == "number")
        Number.isInteger(o) ? ee(29, t, 1, o | 0) : (dt[0] = o, ee(29, t, 2, Rt[0]));
      else if (typeof o == "boolean")
        ee(29, t, 3, o ? 1 : 0);
      else if (typeof o == "string") {
        at(o);
        const a = He >>> 0;
        ee(29, t, 4 | (Ge & 16777215) << 8, a);
      } else
        ee(29, t, 0, 0);
    }
  }
  function qe(t, r, i) {
    const o = je(r), a = Cn++;
    return On(a, i), ee(28, t, o, a), J(), new Promise((f, h) => {
      At.set(a, { resolve: f, reject: h });
    });
  }
  function go(t, r, i, o, a) {
    const f = je(r), h = Cn++;
    On(h, i), ee(30, t, f, h), J(), Ae.set(h, { nodeId: t, onValue: o, onError: a && a.onError, onDone: a && a.onDone });
    let p = ft.get(t);
    return p === undefined && (p = new Set, ft.set(t, p)), p.add(h), function() {
      if (!Ae.has(h))
        return;
      Ae.delete(h);
      const F = ft.get(t);
      F && (F.delete(h), F.size === 0 && ft.delete(t)), ee(31, h, 0, 0), J();
    };
  }
  function _o(t) {
    const r = ft.get(t);
    if (r !== undefined) {
      for (const i of r)
        Ae.has(i) && (Ae.delete(i), ee(31, i, 0, 0));
      ft.delete(t), J();
    }
  }
  var Ar = new Map, bo = 1;
  function $r(t) {
    const r = bo++;
    return Ar.set(r, t), r;
  }
  function kn(t, r, i) {
    ee(21, t, r, i);
  }
  var Cr = 0n, Ke = null, In = gn - yr, Or = yr >> 2, po = yr + In >> 2, Fo = In / 16 | 0, Dn = new ArrayBuffer(4), kr = new Float32Array(Dn), Ir = new Uint32Array(Dn), vo = new TextDecoder("utf-8");
  function Dr(t, r) {
    return r === 0 ? "" : vo.decode(Fn.subarray(wr + t, wr + t + r));
  }
  function zr(t, r) {
    _e[Di] = t + r;
  }
  globalThis.__skal_drainEvents = function() {
    const t = Atomics.load(xr, Ni);
    if (t === Cr)
      return;
    const r = Or + (_e[Ii] >> 2);
    let i = Or + (_e[pn] >> 2);
    const o = po, a = Or;
    let f = Fo;
    for (;i !== r && f-- > 0; ) {
      const h = _e[i + 0], p = h & 255, g = h >>> 8 & 255, F = _e[i + 1], R = _e[i + 2], P = _e[i + 3];
      let O, w = false;
      if (g === 1)
        O = R | 0, w = true;
      else if (g === 2)
        Ir[0] = R, O = kr[0], w = true;
      else if (g === 3)
        O = R !== 0, w = true;
      else if (g === 4)
        O = Dr(P, R), w = true, zr(P, R);
      else if (g === 5) {
        const x = Dr(P, R);
        try {
          O = JSON.parse(x);
        } catch {
          O = x;
        }
        w = true, zr(P, R);
      } else if (g === 6) {
        const x = Dr(P, R);
        try {
          O = JSON.parse(x);
        } catch {
          O = [];
        }
        w = true, zr(P, R);
      } else if (g === 7) {
        Ir[0] = R;
        const x = kr[0];
        Ir[0] = P, O = [x, kr[0]], w = true;
      }
      if (p === 3) {
        const x = At.get(F);
        if (x) {
          At.delete(F);
          try {
            x.resolve(w ? O : undefined);
          } catch (E) {
            Ke = E && (E.stack || E.message || String(E)) || "unknown";
          }
        }
      } else if (p === 4) {
        const x = At.get(F);
        if (x) {
          At.delete(F);
          try {
            const E = typeof O == "string" ? O : `skal RPC error (status ${O})`;
            x.reject(new Error(E));
          } catch (E) {
            Ke = E && (E.stack || E.message || String(E)) || "unknown";
          }
        }
      } else if (p === 5) {
        const x = Ae.get(F);
        if (x)
          try {
            x.onValue(w ? O : undefined);
          } catch (E) {
            Ke = E && (E.stack || E.message || String(E)) || "unknown";
          }
      } else if (p === 6) {
        const x = Ae.get(F);
        if (x) {
          Ae.delete(F);
          try {
            x.onDone && x.onDone();
          } catch (E) {
            Ke = E && (E.stack || E.message || String(E)) || "unknown";
          }
        }
      } else if (p === 7) {
        const x = Ae.get(F);
        if (x) {
          Ae.delete(F);
          try {
            x.onError && x.onError(new Error(typeof O == "string" ? O : "skal stream error"));
          } catch (E) {
            Ke = E && (E.stack || E.message || String(E)) || "unknown";
          }
        }
      } else {
        const x = Ar.get(F);
        if (x)
          try {
            w ? (g === 6 || g === 7) && Array.isArray(O) ? x(...O) : x(O) : x();
          } catch (E) {
            Ke = E && (E.stack || E.message || String(E)) || "unknown";
          }
      }
      i += 4, i >= o && (i = a);
    }
    _e[pn] = i - a << 2, Cr = t;
  }, globalThis.skalStatus = () => JSON.stringify({ handlerCount: Ar.size, opSeq: Number(Kt), lastEventSeq: Number(Cr), lastHandlerError: Ke, propWrites: we, propSkips: Be });
  var Vc = 1, Eo = 2;
  function zn() {
    return Eo++;
  }
  var So = { box: 0, column: 1, scrollView: 5, listView: 6, reorderableListView: 7, row: 2, text: 3, button: 4, image: 9, stack: 10, switch: 11, slider: 12, checkbox: 13, activityIndicator: 14, progressBar: 15, lazyGrid: 16, wrap: 17, safeArea: 18, richText: 19, textInput: 20, navigator: 21, screen: 22, tabs: 23, tab: 24, animatedList: 25, crossFade: 26, hero: 27, listTile: 28, pageView: 29, dismissible: 30, customScrollView: 31, sliverAppBar: 32, sliverList: 33, sliverGrid: 34, canvas: 35, dragItem: 36, dropZone: 37, radio: 38, chip: 39, segmentedButton: 40, expansionTile: 41, dropdown: 42, stepper: 43, step: 44, drawer: 45, bottomSheet: 46, backdropFilter: 47, interactiveViewer: 48 };
  function mo() {
    const t = [], r = { _cmds: t, fillStyle(i) {
      return t.push(["fillStyle", Nr(i)]), r;
    }, strokeStyle(i) {
      return t.push(["strokeStyle", Nr(i)]), r;
    }, lineWidth(i) {
      return t.push(["lineWidth", +i || 0]), r;
    }, fillRect(i, o, a, f) {
      return t.push(["fillRect", +i, +o, +a, +f]), r;
    }, strokeRect(i, o, a, f) {
      return t.push(["strokeRect", +i, +o, +a, +f]), r;
    }, circle(i, o, a) {
      return t.push(["circle", +i, +o, +a]), r;
    }, line(i, o, a, f) {
      return t.push(["line", +i, +o, +a, +f]), r;
    }, beginPath() {
      return t.push(["beginPath"]), r;
    }, moveTo(i, o) {
      return t.push(["moveTo", +i, +o]), r;
    }, lineTo(i, o) {
      return t.push(["lineTo", +i, +o]), r;
    }, closePath() {
      return t.push(["closePath"]), r;
    }, fill() {
      return t.push(["fill"]), r;
    }, stroke() {
      return t.push(["stroke"]), r;
    }, fontSize(i) {
      return t.push(["fontSize", +i || 14]), r;
    }, fillText(i, o, a) {
      return t.push(["fillText", String(i), +o, +a]), r;
    } };
    return r;
  }
  var wo = { padding: [0, "u32"], paddingTop: [1, "u32"], paddingRight: [2, "u32"], paddingBottom: [3, "u32"], paddingLeft: [4, "u32"], width: [5, "dim"], height: [6, "dim"], weight: [7, "f32"], alignment: [8, "u32"], gap: [9, "u32"], axis: [10, "u32"], top: [11, "u32"], right: [12, "u32"], bottom: [13, "u32"], left: [14, "u32"], crossAxisCount: [15, "u32"], aspectRatio: [16, "f32"], background: [32, "color"], color: [33, "color"], cornerRadius: [34, "u32"], borderWidth: [35, "u32"], borderColor: [36, "color"], shadow: [37, "u32"], fontSize: [64, "u32"], fontWeight: [65, "u32"], fontFamily: [66, "u32"], textAlign: [67, "u32"], lineHeight: [68, "u32"], maxLines: [69, "u32"], textOverflow: [70, "u32"], src: [96, "str"], contentScale: [97, "u32"], placeholder: [128, "str"], value: [129, "str"], keyboardType: [130, "u32"], secureEntry: [131, "u32"], checked: [132, "u32"], min: [134, "f32"], max: [135, "f32"], progress: [136, "f32"], initialSize: [176, "f32"], minSize: [177, "f32"], maxSize: [178, "f32"], presentation: [166, "u32"], title: [71, "str"], icon: [98, "str"], leadingIcon: [98, "str"], subtitle: [73, "str"], trailingIcon: [99, "str"], activeTab: [137, "u32"], tag: [72, "str"], transition: [171, "u32"], enabled: [160, "u32"], focusable: [161, "u32"], visible: [162, "u32"], draggable: [172, "u32"], spring: [173, "u32"], release: [174, "u32"], sliverMode: [175, "u32"], dragData: [74, "str"], scrollbar: [179, "u32"], blurRadius: [180, "u32"], minScale: [181, "f32"], maxScale: [182, "f32"], semanticLabel: [75, "str"] }, yo = { opacity: Ji, translationX: Yi, translationY: Zi, scaleX: Qi, scaleY: eo, rotation: to }, xo = { onClick: 1, onclick: 1, onTap: 1, onLongPress: 8, onDoubleTap: 9, onChange: 2, onSubmit: 10, onReorder: 11, onPop: 12, onDismiss: 20, onPanStart: 13, onPanUpdate: 14, onPanEnd: 15, onScaleStart: 16, onScaleUpdate: 17, onScaleEnd: 18, onDrop: 21, onHover: 22, onKey: 23 }, Po = { linear: 0, easeIn: 1, easeOut: 2, easeInOut: 3, bounce: 4, elastic: 5, fastOutSlowIn: 6 }, To = { gentle: 1, bouncy: 2, stiff: 3 };
  function Nr(t) {
    if (typeof t == "number")
      return t | 0;
    if (typeof t != "string")
      return 0;
    let r = t.trim();
    r.startsWith("#") && (r = r.slice(1));
    let i = 0, o = 0, a = 0, f = 255;
    return r.length === 3 ? (i = parseInt(r[0] + r[0], 16), o = parseInt(r[1] + r[1], 16), a = parseInt(r[2] + r[2], 16)) : r.length === 4 ? (i = parseInt(r[0] + r[0], 16), o = parseInt(r[1] + r[1], 16), a = parseInt(r[2] + r[2], 16), f = parseInt(r[3] + r[3], 16)) : r.length === 6 ? (i = parseInt(r.slice(0, 2), 16), o = parseInt(r.slice(2, 4), 16), a = parseInt(r.slice(4, 6), 16)) : r.length === 8 && (f = parseInt(r.slice(0, 2), 16), i = parseInt(r.slice(2, 4), 16), o = parseInt(r.slice(4, 6), 16), a = parseInt(r.slice(6, 8), 16)), (f & 255) << 24 | (i & 255) << 16 | (o & 255) << 8 | a & 255 | 0;
  }
  function Ro(t) {
    return typeof t == "number" ? t | 0 : t === "fill" ? Bi : t === "wrap" ? Mi : -1;
  }
  function Ao(t) {
    if (Array.isArray(t))
      return true;
    const r = Object.getPrototypeOf(t);
    return r === Object.prototype || r === null;
  }
  function $o(t, r, i) {
    if (i == null)
      return;
    if (r === "ref" && i && typeof i.__skalBind == "function") {
      i.__skalBind(t.id);
      return;
    }
    const o = typeof i;
    if (o === "object" && Ao(i)) {
      $n(t.id, r, JSON.stringify(i)), J();
      return;
    }
    if (o === "function") {
      const a = $r(i);
      ho(t.id, r, a), J();
      return;
    }
    if (o === "number") {
      Number.isInteger(i) && i >= 0 && i <= 4294967295 && Rn(t.id, r, i | 0), An(t.id, r, i), J();
      return;
    }
    if (o === "string") {
      $n(t.id, r, i), J();
      return;
    }
    if (o === "boolean") {
      Rn(t.id, r, i ? 1 : 0), J();
      return;
    }
  }
  function Co(t) {
    const r = [t];
    for (;r.length > 0; ) {
      const i = r.pop();
      Ki(i.id);
      let o = i.firstChild;
      for (;o; )
        r.push(o), o = o.nextSibling;
    }
  }
  var tr = class {
    constructor(t, r, i = false, o = false) {
      this.tag = t, this.id = r, this.isText = i, this.isCustom = o, this.parent = null, this.firstChild = null, this.lastChild = null, this.nextSibling = null, this.prevSibling = null, this.text = "";
    }
  }, Oo = Ei({ createElement(t) {
    const r = zn(), i = So[t];
    return i !== undefined ? (ee(1, r, i, 0), J(), new tr(t, r, false, false)) : (fo(r, t), J(), new tr(t, r, false, true));
  }, createTextNode(t) {
    const r = zn();
    ee(1, r, 3, 0);
    const i = t == null ? "" : String(t);
    i.length > 0 && Jt(r, i), J();
    const o = new tr("#text", r, true);
    return o.text = i, o;
  }, replaceText(t, r) {
    const i = r == null ? "" : String(r);
    t.text !== i && (t.text = i, Jt(t.id, i), J());
  }, setProperty(t, r, i, o) {
    if (t.isCustom) {
      $o(t, r, i);
      return;
    }
    if (r === "onRefresh") {
      if (typeof i == "function") {
        const p = t.id, g = i, R = $r(async () => {
          try {
            await g();
          } finally {
            oo(p);
          }
        });
        kn(t.id, 19, R), J();
      }
      return;
    }
    if (r === "draw" && typeof i == "function") {
      const p = i, g = t;
      br(() => {
        const F = mo();
        try {
          p(F);
        } catch {}
        const R = JSON.stringify(F._cmds);
        R !== g._skalCanvasProgram && (g._skalCanvasProgram = R, Jt(g.id, R), J());
      });
      return;
    }
    const a = xo[r];
    if (a !== undefined) {
      if (typeof i == "function") {
        const p = $r(i);
        kn(t.id, a, p), J();
      }
      return;
    }
    if (r === "value" && t.tag === "slider") {
      yn(t.id, 133, Number(i) || 0), J();
      return;
    }
    if (r === "draggable" && typeof i == "string") {
      he(t.id, 172, { free: 1, both: 1, horizontal: 2, x: 2, vertical: 3, y: 3 }[i] ?? 0), J();
      return;
    }
    if (r === "spring" && typeof i == "string") {
      he(t.id, 173, { gentle: 1, bouncy: 2, stiff: 3, wobbly: 2 }[i] ?? 0), J();
      return;
    }
    if (r === "release" && typeof i == "string") {
      he(t.id, 174, { none: 0, glide: 1, friction: 1, springback: 2, spring: 2 }[i.toLowerCase()] ?? 0), J();
      return;
    }
    if (r === "sliverMode" && typeof i == "string") {
      he(t.id, 175, { normal: 0, pinned: 1, floating: 2, both: 3 }[i.toLowerCase()] ?? 0), J();
      return;
    }
    if (r === "animate" && i && typeof i == "object") {
      if (he(t.id, 163, i.duration | 0), i.curve != null) {
        const p = typeof i.curve == "string" ? Po[i.curve] ?? 0 : i.curve | 0;
        he(t.id, 164, p);
      }
      if (i.delay != null && he(t.id, 165, i.delay | 0), i.repeat != null && he(t.id, 167, i.repeat ? 1 : 0), i.reverse != null && he(t.id, 168, i.reverse ? 1 : 0), i.loop != null && he(t.id, 169, i.loop | 0), i.spring != null) {
        const p = typeof i.spring == "string" ? To[i.spring] ?? 0 : i.spring ? 2 : 0;
        he(t.id, 170, p);
      }
      J();
      return;
    }
    if (r === "label" && (t.tag === "button" || t.tag === "text" || t.tag === "chip")) {
      const p = i == null ? "" : String(i);
      Jt(t.id, p), J();
      return;
    }
    const f = yo[r];
    if (f !== undefined) {
      typeof i == "number" && (f(t.id, i), J());
      return;
    }
    const h = wo[r];
    if (h !== undefined) {
      const [p, g] = h;
      if (i == null)
        return;
      switch (g) {
        case "u32":
          typeof i == "number" ? (he(t.id, p, i | 0), J()) : typeof i == "boolean" && (he(t.id, p, i ? 1 : 0), J());
          return;
        case "f32":
          typeof i == "number" && (yn(t.id, p, i), J());
          return;
        case "str":
          Xi(t.id, p, String(i)), J();
          return;
        case "color":
          he(t.id, p, Nr(i)), J();
          return;
        case "dim":
          he(t.id, p, Ro(i)), J();
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
      const a = r.parent;
      r.prevSibling ? r.prevSibling.nextSibling = r.nextSibling : a.firstChild === r && (a.firstChild = r.nextSibling), r.nextSibling ? r.nextSibling.prevSibling = r.prevSibling : a.lastChild === r && (a.lastChild = r.prevSibling), r.prevSibling = null, r.nextSibling = null;
    }
    const o = i ? i.id : 0;
    ee(3, t.id, r.id, o), J(), r.parent = t, i ? (r.nextSibling = i, r.prevSibling = i.prevSibling, i.prevSibling ? i.prevSibling.nextSibling = r : t.firstChild = r, i.prevSibling = r) : (r.prevSibling = t.lastChild, r.nextSibling = null, t.lastChild ? t.lastChild.nextSibling = r : t.firstChild = r, t.lastChild = r);
  }, removeNode(t, r) {
    ee(2, r.id, 0, 0), Co(r), J(), r.prevSibling ? r.prevSibling.nextSibling = r.nextSibling : t.firstChild = r.nextSibling, r.nextSibling ? r.nextSibling.prevSibling = r.prevSibling : t.lastChild = r.prevSibling, r.parent = null, r.prevSibling = null, r.nextSibling = null;
  }, isTextNode(t) {
    return t.isText;
  }, getParentNode(t) {
    return t.parent;
  }, getFirstChild(t) {
    return t.firstChild;
  }, getNextSibling(t) {
    return t.nextSibling;
  } }), { render: ko, effect: U, memo: Lr, createComponent: D, createElement: l, createTextNode: Hc, insertNode: _, insert: N, spread: Gc, setProp: e, mergeProps: jc, use: Io } = Oo;
  ee(1, 1, 0, 0), J();
  var Do = new tr("box", 1, false);
  function zo() {
    let t = 0;
    const r = function() {};
    return r.__skalBind = (i) => {
      t = i;
    }, new Proxy(r, { apply(i, o, a) {
      const f = a[0];
      f && typeof f.id == "number" && (t = f.id);
    }, get(i, o) {
      if (o === "__skalBind" || typeof o == "symbol")
        return r[o];
      if (typeof o == "string" && o.endsWith("$") && o.length > 1) {
        const a = o.slice(0, -1);
        return (...f) => {
          if (t === 0)
            throw new Error(`skal ref: cannot call .${String(o)}() before the host mounts. Move the call into a JSX event handler.`);
          const h = f[f.length - 1];
          if (typeof h != "function")
            throw new TypeError(`skal ref: .${String(o)}() requires a callback as its last argument (got ${typeof h})`);
          const p = f.slice(0, -1);
          return go(t, a, p, h);
        };
      }
      return (...a) => t === 0 ? Promise.reject(new Error(`skal ref: cannot call .${String(o)}() before the host mounts. Move the call into a JSX event handler.`)) : qe(t, o, a);
    } });
  }
  function Br(t, r, i) {
    const o = (x) => {
      const E = t[x];
      return typeof E == "function" ? E : E && E.component || null;
    }, a = (x) => {
      const E = t[x];
      return E && typeof E == "object" ? E.title : undefined;
    }, f = (x) => {
      const E = t[x];
      return E && typeof E == "object" ? E.transition : undefined;
    }, h = (x) => x === "fade" ? 1 : x === "none" ? 2 : typeof x == "number" ? x : 0, p = !!(i && i.linking), g = typeof window < "u", F = () => {
      if (!g)
        return null;
      const x = (window.location.hash || "").replace(/^#\/?/, "").split("?")[0];
      return x && t[x] ? x : null;
    };
    let R = typeof r == "string" ? r : r && r.name || Object.keys(t)[0];
    if (p) {
      const x = F();
      x && (R = x);
    }
    const [P, O] = G([{ name: R, params: {}, title: a(R), transition: f(R) }]), w = { stack: P, navigate(x, E, k) {
      O([...P(), { name: x, params: E || {}, presentation: k && k.presentation, title: (k && k.title) !== undefined ? k.title : a(x), transition: (k && k.transition) !== undefined ? k.transition : f(x) }]);
    }, back() {
      const x = P();
      x.length > 1 && O(x.slice(0, -1));
    }, replace(x, E, k) {
      O([...P().slice(0, -1), { name: x, params: E || {}, title: (k && k.title) !== undefined ? k.title : a(x), transition: (k && k.transition) !== undefined ? k.transition : f(x) }]);
    }, reset(x, E) {
      O([{ name: x, params: E || {}, title: a(x), transition: f(x) }]);
    }, canGoBack() {
      return P().length > 1;
    } };
    return p && g && br(() => {
      const x = P(), E = "#/" + x[x.length - 1].name;
      window.location.hash !== E && window.history.replaceState({}, "", E);
    }), w.View = () => (() => {
      var x = l("navigator");
      return e(x, "onPop", () => w.back()), N(x, D(le, { get each() {
        return P();
      }, children: (E) => {
        const k = o(E.name);
        return (() => {
          var V = l("screen");
          return N(V, k ? D(k, { get params() {
            return E.params || {};
          }, router: w }) : null), U((T) => {
            var A = E.presentation === "modal" ? 1 : 0, d = E.title || "", S = h(E.transition);
            return A !== T.e && (T.e = e(V, "presentation", A, T.e)), d !== T.t && (T.t = e(V, "title", d, T.t)), S !== T.a && (T.a = e(V, "transition", S, T.a)), T;
          }, { e: undefined, t: undefined, a: undefined }), V;
        })();
      } })), x;
    })(), w;
  }
  var rr = Symbol("store-raw"), gt = Symbol("store-node"), Oe = Symbol("store-has"), Nn = Symbol("store-self");
  function Ln(t) {
    let r = t[Pe];
    if (!r && (Object.defineProperty(t, Pe, { value: r = new Proxy(t, Bo) }), !Array.isArray(t))) {
      const i = Object.keys(t), o = Object.getOwnPropertyDescriptors(t);
      for (let a = 0, f = i.length;a < f; a++) {
        const h = i[a];
        o[h].get && Object.defineProperty(t, h, { enumerable: o[h].enumerable, get: o[h].get.bind(r) });
      }
    }
    return r;
  }
  function _t(t) {
    let r;
    return t != null && typeof t == "object" && (t[Pe] || !(r = Object.getPrototypeOf(t)) || r === Object.prototype || Array.isArray(t));
  }
  function bt(t, r = new Set) {
    let i, o, a, f;
    if (i = t != null && t[rr])
      return i;
    if (!_t(t) || r.has(t))
      return t;
    if (Array.isArray(t)) {
      Object.isFrozen(t) ? t = t.slice(0) : r.add(t);
      for (let h = 0, p = t.length;h < p; h++)
        a = t[h], (o = bt(a, r)) !== a && (t[h] = o);
    } else {
      Object.isFrozen(t) ? t = Object.assign({}, t) : r.add(t);
      const h = Object.keys(t), p = Object.getOwnPropertyDescriptors(t);
      for (let g = 0, F = h.length;g < F; g++)
        f = h[g], !p[f].get && (a = t[f], (o = bt(a, r)) !== a && (t[f] = o));
    }
    return t;
  }
  function nr(t, r) {
    let i = t[r];
    return i || Object.defineProperty(t, r, { value: i = Object.create(null) }), i;
  }
  function $t(t, r, i) {
    if (t[r])
      return t[r];
    const [o, a] = G(i, { equals: false, internal: true });
    return o.$ = a, t[r] = o;
  }
  function No(t, r) {
    const i = Reflect.getOwnPropertyDescriptor(t, r);
    return !i || i.get || !i.configurable || r === Pe || r === gt || (delete i.value, delete i.writable, i.get = () => t[Pe][r]), i;
  }
  function Bn(t) {
    pr() && $t(nr(t, gt), Nn)();
  }
  function Lo(t) {
    return Bn(t), Reflect.ownKeys(t);
  }
  var Bo = { get(t, r, i) {
    if (r === rr)
      return t;
    if (r === Pe)
      return i;
    if (r === _r)
      return Bn(t), i;
    const o = nr(t, gt), a = o[r];
    let f = a ? a() : t[r];
    if (r === gt || r === Oe || r === "__proto__")
      return f;
    if (!a) {
      const h = Object.getOwnPropertyDescriptor(t, r);
      pr() && (typeof f != "function" || t.hasOwnProperty(r)) && !(h && h.get) && (f = $t(o, r, f)());
    }
    return _t(f) ? Ln(f) : f;
  }, has(t, r) {
    return r === rr || r === Pe || r === _r || r === gt || r === Oe || r === "__proto__" ? true : (pr() && $t(nr(t, Oe), r)(), (r in t));
  }, set() {
    return true;
  }, deleteProperty() {
    return true;
  }, ownKeys: Lo, getOwnPropertyDescriptor: No };
  function pt(t, r, i, o = false) {
    if (!o && t[r] === i)
      return;
    const a = t[r], f = t.length;
    i === undefined ? (delete t[r], t[Oe] && t[Oe][r] && a !== undefined && t[Oe][r].$()) : (t[r] = i, t[Oe] && t[Oe][r] && a === undefined && t[Oe][r].$());
    let h = nr(t, gt), p;
    if ((p = $t(h, r, a)) && p.$(() => i), Array.isArray(t) && t.length !== f) {
      for (let g = t.length;g < f; g++)
        (p = h[g]) && p.$();
      (p = $t(h, "length", f)) && p.$(t.length);
    }
    (p = h[Nn]) && p.$();
  }
  function Mn(t, r) {
    const i = Object.keys(r);
    for (let o = 0;o < i.length; o += 1) {
      const a = i[o];
      pt(t, a, r[a]);
    }
  }
  function Mo(t, r) {
    if (typeof r == "function" && (r = r(t)), r = bt(r), Array.isArray(r)) {
      if (t === r)
        return;
      let i = 0, o = r.length;
      for (;i < o; i++) {
        const a = r[i];
        t[i] !== a && pt(t, i, a);
      }
      pt(t, "length", o);
    } else
      Mn(t, r);
  }
  function Ct(t, r, i = []) {
    let o, a = t;
    if (r.length > 1) {
      o = r.shift();
      const h = typeof o, p = Array.isArray(t);
      if (Array.isArray(o)) {
        for (let g = 0;g < o.length; g++)
          Ct(t, [o[g]].concat(r), i);
        return;
      } else if (p && h === "function") {
        for (let g = 0;g < t.length; g++)
          o(t[g], g) && Ct(t, [g].concat(r), i);
        return;
      } else if (p && h === "object") {
        const { from: g = 0, to: F = t.length - 1, by: R = 1 } = o;
        for (let P = g;P <= F; P += R)
          Ct(t, [P].concat(r), i);
        return;
      } else if (r.length > 1) {
        Ct(t[o], r, [o].concat(i));
        return;
      }
      a = t[o], i = [o].concat(i);
    }
    let f = r[0];
    typeof f == "function" && (f = f(a, i), f === a) || o === undefined && f == null || (f = bt(f), o === undefined || _t(a) && _t(f) && !Array.isArray(f) ? Mn(a, f) : pt(t, o, f));
  }
  function Wo(...[t, r]) {
    const i = bt(t || {}), o = Array.isArray(i), a = Ln(i);
    function f(...h) {
      tn(() => {
        o && h.length === 1 ? Mo(i, h[0]) : Ct(i, h);
      });
    }
    return [a, f];
  }
  var ir = new WeakMap, Wn = { get(t, r) {
    if (r === rr)
      return t;
    const i = t[r];
    let o;
    return _t(i) ? ir.get(i) || (ir.set(i, o = new Proxy(i, Wn)), o) : i;
  }, set(t, r, i) {
    return pt(t, r, bt(i)), true;
  }, deleteProperty(t, r) {
    return pt(t, r, undefined, true), true;
  } };
  function or(t) {
    return (r) => {
      if (_t(r)) {
        let i;
        (i = ir.get(r)) || ir.set(r, i = new Proxy(r, Wn)), t(i);
      }
      return r;
    };
  }
  var qc = 15, Uo = (() => {
    const t = new Uint32Array(256);
    for (let r = 0;r < 256; r++) {
      let i = r;
      for (let o = 0;o < 8; o++)
        i = i & 1 ? 3988292384 ^ i >>> 1 : i >>> 1;
      t[r] = i >>> 0;
    }
    return t;
  })();
  function Un(t, r = 0, i = t.length) {
    let o = 4294967295;
    for (let a = r;a < i; a++)
      o = Uo[(o ^ t[a]) & 255] ^ o >>> 8;
    return (o ^ 4294967295) >>> 0;
  }
  function Vn(t, r, i, o, a, f) {
    const h = 15 + a.length + f.length, p = new DataView(t.buffer, t.byteOffset + r, h);
    return p.setUint32(4, i >>> 0, true), t[r + 8] = o & 255, p.setUint16(9, a.length, true), p.setUint32(11, f.length, true), t.set(a, r + 15), t.set(f, r + 15 + a.length), p.setUint32(0, Un(t, r + 4, r + h), true), h;
  }
  function lr(t, r, i = true) {
    if (r + 15 > t.length)
      return null;
    const o = new DataView(t.buffer, t.byteOffset, t.byteLength), a = o.getUint32(r, true), f = o.getUint32(r + 4, true), h = t[r + 8], p = o.getUint16(r + 9, true), g = o.getUint32(r + 11, true), F = 15 + p + g;
    if (r + F > t.length || i && Un(t, r + 4, r + F) !== a)
      return null;
    const R = r + 15, P = R + p;
    return { seq: f, flags: h, total: F, key: t.subarray(R, P), value: t.subarray(P, P + g) };
  }
  var Xe = 256 * 1024, Vo = 0.4, Ho = 1000, Go = 8, jo = 16, qo = new TextEncoder, Ko = new TextDecoder, Mr = (t) => qo.encode(t), Wr = (t) => Ko.decode(t), Hn = () => Date.now(), Gn = new Uint8Array(0), jn = 1397442609, Ur = new Function("m", "return import(m);"), Vr = (t, r) => t && t[r] ? t : t && t.default || t, Hr = class {
    constructor() {
      this.kind = "memory", this._segs = new Map, this._meta = new Map;
    }
    listSegments() {
      return [...this._segs.keys()].sort((t, r) => t - r);
    }
    appendSegment(t, r) {
      const i = this._segs.get(t);
      if (!i) {
        this._segs.set(t, r.slice());
        return;
      }
      const o = new Uint8Array(i.length + r.length);
      o.set(i), o.set(r, i.length), this._segs.set(t, o);
    }
    getSegment(t) {
      return this._segs.get(t) || null;
    }
    dropSegment(t) {
      this._segs.delete(t);
    }
    flush() {}
    metaGet(t) {
      return this._meta.get(t) || null;
    }
    metaPut(t, r) {
      this._meta.set(t, r.slice());
    }
  }, Xo = class {
    constructor(t, r, i) {
      this.kind = "fs", this._fs = t, this._p = r, this.root = i;
    }
    _seg(t) {
      return this._p.join(this.root, `seg-${String(t).padStart(5, "0")}.log`);
    }
    listSegments() {
      let t = [];
      try {
        t = this._fs.readdirSync(this.root);
      } catch {
        return [];
      }
      return t.filter((r) => /^seg-\d+\.log$/.test(r)).map((r) => parseInt(r.slice(4), 10)).sort((r, i) => r - i);
    }
    appendSegment(t, r) {
      this._fs.appendFileSync(this._seg(t), r);
    }
    getSegment(t) {
      try {
        return new Uint8Array(this._fs.readFileSync(this._seg(t)));
      } catch {
        return null;
      }
    }
    dropSegment(t) {
      try {
        this._fs.unlinkSync(this._seg(t));
      } catch {}
    }
    flush() {}
    metaGet(t) {
      try {
        return new Uint8Array(this._fs.readFileSync(this._p.join(this.root, `meta-${t}`)));
      } catch {
        return null;
      }
    }
    metaPut(t, r) {
      this._fs.writeFileSync(this._p.join(this.root, `meta-${t}`), r);
    }
  }, Jo = class {
    constructor(t, r, i, o) {
      this.kind = "mmap", this.directActive = true, this._mmap = t, this._fs = r, this._p = i, this.root = o, this._open = new Map;
      try {
        for (const a of r.readdirSync(o))
          if (a.endsWith(".dead"))
            try {
              r.unlinkSync(i.join(o, a));
            } catch {}
      } catch {}
    }
    _segPath(t) {
      return this._p.join(this.root, `seg-${String(t).padStart(5, "0")}.log`);
    }
    _handle(t) {
      let r = this._open.get(t);
      if (r)
        return this._open.delete(t), this._open.set(t, r), r;
      const i = this._mmap(this._segPath(t), { shared: true });
      let o = 0;
      for (;o < i.length; ) {
        const a = lr(i, o);
        if (!a)
          break;
        o += a.total;
      }
      return r = { mapped: i, cursor: o }, this._open.set(t, r), this._evictOpen(t), r;
    }
    _evictOpen(t) {
      for (;this._open.size > jo; ) {
        const r = this._open.keys().next().value;
        if (r === t)
          break;
        this._open.delete(r);
      }
    }
    createSegment(t, r) {
      const i = this._segPath(t);
      this._fs.writeFileSync(i, new Uint8Array(r));
      const o = { mapped: this._mmap(i, { shared: true }), cursor: 0 };
      return this._open.set(t, o), this._evictOpen(t), o;
    }
    segmentCapacity(t) {
      const r = this._open.get(t);
      if (r)
        return r.mapped.length;
      try {
        return this._handle(t).mapped.length;
      } catch {
        return 0;
      }
    }
    listSegments() {
      let t = [];
      try {
        t = this._fs.readdirSync(this.root);
      } catch {
        return [];
      }
      return t.filter((r) => /^seg-\d+\.log$/.test(r)).map((r) => parseInt(r.slice(4), 10)).sort((r, i) => r - i);
    }
    segmentLen(t) {
      try {
        return this._handle(t).cursor;
      } catch {
        return 0;
      }
    }
    reserve(t, r) {
      const i = this._handle(t), o = i.cursor;
      return i.cursor += r, { mapped: i.mapped, offset: o };
    }
    getSegment(t) {
      let r;
      try {
        r = this._handle(t);
      } catch {
        return null;
      }
      return r.mapped.subarray(0, r.cursor);
    }
    dropSegment(t) {
      this._open.delete(t);
      try {
        this._fs.renameSync(this._segPath(t), this._segPath(t) + ".dead");
      } catch {}
    }
    flush() {}
    metaGet(t) {
      try {
        return new Uint8Array(this._fs.readFileSync(this._p.join(this.root, `meta-${t}`)));
      } catch {
        return null;
      }
    }
    metaPut(t, r) {
      this._fs.writeFileSync(this._p.join(this.root, `meta-${t}`), r);
    }
  };
  function Ot(t, r) {
    return t.diag = r, t;
  }
  async function Yo(t) {
    let r, i, o;
    try {
      const h = Promise.all([Ur("node:fs"), Ur("node:os"), Ur("node:path")]), p = new Promise((P, O) => setTimeout(() => O(new Error("module import timed out")), 2000)), [g, F, R] = await Promise.race([h, p]);
      if (r = Vr(g, "readFileSync"), i = Vr(F, "tmpdir"), o = Vr(R, "join"), typeof r.readFileSync != "function" || typeof r.writeFileSync != "function" || typeof i.tmpdir != "function" || typeof o.join != "function")
        return Ot(new Hr, "node:fs/os/path resolved but missing methods");
    } catch (h) {
      return Ot(new Hr, "node: import failed \u2014 " + (h && h.message || h));
    }
    const a = t && t.length ? t : o.join(i.tmpdir(), "skal-store");
    let f = "";
    try {
      if (typeof Bun < "u" && typeof Bun.mmap == "function") {
        const h = o.join(a, "mmap");
        r.mkdirSync(h, { recursive: true });
        const p = o.join(h, ".mmap-probe");
        r.writeFileSync(p, new Uint8Array(64));
        const g = Bun.mmap(p, { shared: true });
        if (g && g.length >= 64)
          return Ot(new Jo((F, R) => Bun.mmap(F, R), r, o, h), "mmap @ " + h);
        f += "Bun.mmap probe unusable; ";
      } else
        f += "Bun.mmap absent; ";
    } catch (h) {
      f += "mmap \u2014 " + (h && h.message || h) + "; ";
    }
    try {
      if (typeof r.appendFileSync == "function") {
        const h = o.join(a, "fs");
        return r.mkdirSync(h, { recursive: true }), r.writeFileSync(o.join(h, ".fs-probe"), new Uint8Array(1)), Ot(new Xo(r, o, h), f + "fs @ " + h);
      }
      f += "fs.appendFileSync absent; ";
    } catch (h) {
      f += "fs \u2014 " + (h && h.message || h) + "; ";
    }
    return Ot(new Hr, f + "memory fallback");
  }
  var Zo = class {
    constructor(t) {
      this._b = t, this._keydir = new Map, this._dead = new Map, this._cache = new Map, this._seq = 0, this._active = null, this._lastHintMs = 0;
    }
    get backendKind() {
      return this._b.kind;
    }
    open() {
      const t = this._b.listSegments(), r = this._loadHint(t);
      if (r && (this._keydir = r.keydir, this._dead = r.dead, this._seq = r.seq), t.length === 0) {
        const h = r ? r.tail.id : 0;
        this._active = this._b.directActive ? { id: h, direct: true } : { id: h, buf: new Uint8Array(Xe), len: 0, persisted: 0 };
        return;
      }
      const i = t[t.length - 1], o = r ? r.tail.id : i, a = r ? r.tail.id : t[0];
      let f = null;
      for (const h of t) {
        if (h < a)
          continue;
        const p = this._b.getSegment(h) || new Uint8Array(0);
        let g = r && h === r.tail.id ? r.tail.len : 0;
        for (;g < p.length; ) {
          const F = lr(p, g);
          if (!F)
            break;
          const R = Wr(F.key), P = this._keydir.get(R);
          P && this._addDead(P.seg, P.len), F.flags & 1 ? (this._keydir.delete(R), this._addDead(h, F.total)) : this._keydir.set(R, { seg: h, off: g, len: F.total, seq: F.seq }), F.seq > this._seq && (this._seq = F.seq), g += F.total;
        }
        h === o ? f = p : this._cacheSet(h, p);
      }
      if (this._cache.delete(o), this._b.directActive)
        this._b.getSegment(o), this._active = { id: o, direct: true };
      else {
        f == null && (f = this._b.getSegment(o) || new Uint8Array(0));
        const h = new Uint8Array(Math.max(Xe, f.length));
        h.set(f), this._active = { id: o, buf: h, len: f.length, persisted: f.length };
      }
    }
    _addDead(t, r) {
      this._dead.set(t, (this._dead.get(t) || 0) + r);
    }
    _cacheGet(t) {
      const r = this._cache.get(t);
      return r !== undefined && (this._cache.delete(t), this._cache.set(t, r)), r;
    }
    _cacheSet(t, r) {
      for (this._cache.delete(t), this._cache.set(t, r);this._cache.size > Go; )
        this._cache.delete(this._cache.keys().next().value);
    }
    _loadHint(t) {
      let r;
      try {
        r = this._b.metaGet("hint");
      } catch {
        return null;
      }
      if (!r || r.length < 20)
        return null;
      const i = new DataView(r.buffer, r.byteOffset, r.byteLength);
      if (i.getUint32(0, true) !== jn)
        return null;
      const o = i.getUint32(4, true), a = i.getUint32(8, true), f = i.getUint32(12, true), h = i.getUint32(16, true), p = new Set(t), g = new Map;
      let F = 20;
      try {
        for (let O = 0;O < h; O++) {
          const w = i.getUint16(F, true);
          if (F += 2, F + w + 16 > r.length)
            return null;
          const x = Wr(r.subarray(F, F + w));
          F += w;
          const E = i.getUint32(F, true);
          F += 4;
          const k = i.getUint32(F, true);
          F += 4;
          const V = i.getUint32(F, true);
          F += 4;
          const T = i.getUint32(F, true);
          if (F += 4, !p.has(E))
            return null;
          g.set(x, { seg: E, off: k, len: V, seq: T });
        }
        const R = i.getUint32(F, true);
        F += 4;
        const P = new Map;
        for (let O = 0;O < R; O++) {
          const w = i.getUint32(F, true);
          F += 4, P.set(w, i.getUint32(F, true)), F += 4;
        }
        return !p.has(a) && f !== 0 ? null : { seq: o, tail: { id: a, len: f }, keydir: g, dead: P };
      } catch {
        return null;
      }
    }
    _tailLen() {
      const t = this._active;
      return t ? t.direct ? this._b.segmentLen(t.id) : t.persisted : 0;
    }
    _writeHint() {
      this._lastHintMs = Hn();
      const t = this._active, r = [];
      let i = 20;
      for (const [h, p] of this._keydir) {
        const g = Mr(h);
        r.push([g, p]), i += 2 + g.length + 16;
      }
      i += 4 + this._dead.size * 8;
      const o = new Uint8Array(i), a = new DataView(o.buffer);
      a.setUint32(0, jn, true), a.setUint32(4, this._seq >>> 0, true), a.setUint32(8, t ? t.id : 0, true), a.setUint32(12, this._tailLen(), true), a.setUint32(16, r.length, true);
      let f = 20;
      for (const [h, p] of r)
        a.setUint16(f, h.length, true), f += 2, o.set(h, f), f += h.length, a.setUint32(f, p.seg, true), f += 4, a.setUint32(f, p.off, true), f += 4, a.setUint32(f, p.len, true), f += 4, a.setUint32(f, p.seq >>> 0, true), f += 4;
      a.setUint32(f, this._dead.size, true), f += 4;
      for (const [h, p] of this._dead)
        a.setUint32(f, h, true), f += 4, a.setUint32(f, p, true), f += 4;
      try {
        this._b.metaPut("hint", o);
      } catch {}
    }
    _seal() {
      const t = this._active;
      if (t.direct) {
        this._active = { id: t.id + 1, direct: true };
        return;
      }
      t.len > t.persisted && this._b.appendSegment(t.id, t.buf.subarray(t.persisted, t.len)), this._cacheSet(t.id, t.buf.slice(0, t.len)), this._active = { id: t.id + 1, buf: new Uint8Array(Xe), len: 0, persisted: 0 };
    }
    _writeFrame(t, r, i, o) {
      const a = 15 + i.length + o.length, f = this._active;
      if (f.direct) {
        const g = this._b.segmentCapacity(f.id);
        g === 0 ? this._b.createSegment(f.id, Math.max(Xe, a)) : this._b.segmentLen(f.id) + a > g && (this._seal(), this._b.createSegment(this._active.id, Math.max(Xe, a)));
        const F = this._b.reserve(this._active.id, a);
        return Vn(F.mapped, F.offset, t, r, i, o), F.offset;
      }
      f.len > 0 && f.len + a > Xe && this._seal();
      const h = this._active;
      if (h.len + a > h.buf.length) {
        const g = new Uint8Array(Math.max(h.buf.length * 2, h.len + a));
        g.set(h.buf.subarray(0, h.len)), h.buf = g;
      }
      const p = h.len;
      return Vn(h.buf, p, t, r, i, o), h.len += a, p;
    }
    put(t, r) {
      const i = ++this._seq, o = Mr(t), a = this._writeFrame(i, 0, o, r), f = this._keydir.get(t);
      f && this._addDead(f.seg, f.len), this._keydir.set(t, { seg: this._active.id, off: a, len: 15 + o.length + r.length, seq: i });
    }
    del(t) {
      const r = this._keydir.get(t);
      r && (this._writeFrame(++this._seq, 1, Mr(t), Gn), this._addDead(r.seg, r.len), this._keydir.delete(t));
    }
    delPrefix(t) {
      if (!t)
        return;
      const r = t + ".", i = t + "#", o = [];
      for (const a of this._keydir.keys())
        (a.startsWith(r) || a.startsWith(i)) && o.push(a);
      for (const a of o)
        this.del(a);
    }
    get(t) {
      const r = this._keydir.get(t);
      if (!r)
        return null;
      const i = this._segBytes(r.seg);
      if (!i)
        return null;
      const o = lr(i, r.off, false);
      return !o || o.flags & 1 ? null : o.value.slice();
    }
    _segBytes(t) {
      if (this._active && t === this._active.id)
        return this._active.direct ? this._b.getSegment(t) : this._active.buf.subarray(0, this._active.len);
      let r = this._cacheGet(t);
      return r || (r = this._b.getSegment(t), r && this._cacheSet(t, r)), r;
    }
    flush() {
      const t = this._active;
      t && !t.direct && t.len > t.persisted && (this._b.appendSegment(t.id, t.buf.subarray(t.persisted, t.len)), t.persisted = t.len), this._b.flush(), Hn() - this._lastHintMs >= Ho && this._writeHint();
    }
    compact() {
      let t = -1, r = 0;
      for (const [h, p] of this._dead)
        this._active && h === this._active.id || p > r && (r = p, t = h);
      if (t < 0 || r < Xe * Vo)
        return false;
      const i = this._segBytes(t);
      if (!i)
        return false;
      const o = this._b.listSegments(), a = o.length > 0 && t === o[0];
      let f = 0;
      for (;f < i.length; ) {
        const h = lr(i, f);
        if (!h)
          break;
        const p = Wr(h.key);
        if (h.flags & 1)
          !a && !this._keydir.has(p) && (this._writeFrame(++this._seq, 1, h.key, Gn), this._addDead(this._active.id, 15 + h.key.length));
        else {
          const g = this._keydir.get(p);
          g && g.seg === t && g.off === f && this.put(p, h.value.slice());
        }
        f += h.total;
      }
      return this.flush(), this._b.dropSegment(t), this._cache.delete(t), this._dead.delete(t), this._writeHint(), true;
    }
    stats() {
      let t = 0;
      for (const r of this._dead.values())
        t += r;
      return { backend: this._b.kind, records: this._keydir.size, segments: this._b.listSegments().length, activeSegment: this._active ? this._active.id : -1, deadBytes: t, seq: this._seq };
    }
  }, Qo = class {
    constructor(t) {
      this.backendKind = "native", this._dir = t, this._h = 0;
    }
    open() {
      const t = globalThis.__skal_store_open;
      if (this._h = typeof t == "function" && t(this._dir) || 0, !this._h)
        throw new Error("skal-store: native engine open failed @ " + this._dir);
    }
    put(t, r) {
      globalThis.__skal_store_put(this._h, t, r);
    }
    del(t) {
      globalThis.__skal_store_del(this._h, t);
    }
    delPrefix(t) {
      const r = globalThis.__skal_store_del_prefix;
      typeof r == "function" && r(this._h, t);
    }
    get(t) {
      const r = globalThis.__skal_store_get(this._h, t);
      return r ? new Uint8Array(r) : null;
    }
    flush() {}
    compact() {
      return !!globalThis.__skal_store_compact(this._h);
    }
    stats() {
      const t = this._h ? globalThis.__skal_store_stats(this._h) : null;
      if (!t)
        return { backend: "native", records: 0, segments: 0, deadBytes: 0, seq: 0 };
      const r = new DataView(t);
      return { backend: "native", records: r.getUint32(0, true), segments: r.getUint32(4, true), deadBytes: r.getUint32(8, true), seq: r.getUint32(12, true) };
    }
  }, el = 60, tl = 8192, sr = Symbol("skal.indexDirty"), rl = new TextEncoder, nl = new TextDecoder;
  function Je(t) {
    return rl.encode(JSON.stringify(t));
  }
  function ye(t) {
    return JSON.parse(nl.decode(t));
  }
  var Gr = Symbol.for("skal.store"), ve = (t) => t !== null && typeof t == "object" && !Array.isArray(t), Ye = (t) => Array.isArray(t) && t.every(ve), jr = (t) => typeof t == "string" && /^(0|[1-9]\d*)$/.test(t), de = (t, r) => t ? t + "." + r : r, kt = () => typeof performance < "u" && performance.now ? performance.now() : Date.now();
  function Ft(t) {
    if (Array.isArray(t))
      return t.map(Ft);
    if (ve(t)) {
      const r = {};
      for (const i of Object.keys(t))
        r[i] = Ft(t[i]);
      return r;
    }
    return t;
  }
  async function il() {
    const t = globalThis.__skal_data_dir;
    if (typeof t == "string" && t.length)
      return t;
    for (let r = 0;r < 5; r++) {
      try {
        const i = await Promise.race([co(), new Promise((o, a) => setTimeout(() => a(new Error("getDataDir timeout")), 800))]);
        if (typeof i == "string" && i.length)
          return i;
      } catch {}
      await new Promise((i) => setTimeout(i, 150));
    }
    return "";
  }
  function ol(t, r = {}) {
    const i = { name: r.name || "store", paths: r.paths || null, residentMax: r.residentMax || 1e4, version: r.version || 0, migrate: r.migrate || null };
    let o = false, a = false;
    if (i.paths)
      for (const m in i.paths) {
        const b = i.paths[m];
        b && b.lazy === true && (o = true), b && b.persist === false && (a = true);
      }
    const f = new Map;
    function h(m) {
      const b = f.get(m);
      if (b)
        return b;
      let n = true, s = false;
      if (i.paths) {
        const u = [];
        for (const v in i.paths)
          (v === m || m.startsWith(v + ".")) && u.push(v);
        u.sort((v, $) => v.length - $.length);
        for (const v of u) {
          const $ = i.paths[v];
          $.persist !== undefined && (n = $.persist), $.lazy !== undefined && (s = $.lazy);
        }
      }
      const c = { persist: n, lazy: s };
      return f.set(m, c), c;
    }
    const [p, g] = Wo(Ft(t)), [F, R] = G(false), [P, O] = G("\u2026"), [w, x] = G(null);
    let E = null;
    const k = new Map, V = new Map, T = new Map, A = new Set;
    let d = null, S = 0;
    function y(m) {
      const b = V.get(m) || 1;
      return V.set(m, b + 1), String(b);
    }
    function C() {
      d == null && (d = setTimeout(() => {
        d = null, I();
      }, el));
    }
    function I() {
      if (!(!E || k.size === 0 && A.size === 0)) {
        if (A.size > 0 && E.delPrefix) {
          for (const m of A)
            E.delPrefix(m);
          A.clear();
        }
        for (const [m, b] of k)
          if (b === null)
            E.del(m);
          else if (b === sr) {
            const n = m.slice(2, -2), s = re(n === "" ? [] : n.split("."));
            Array.isArray(s) && E.put(m, Je({ ids: s.map((c) => c && c._id), nextId: V.get(n) || s.length + 1 }));
          } else
            E.put(m, b);
        k.clear(), E.flush(), S++;
      }
    }
    function W() {
      d != null && (clearTimeout(d), d = null), I();
    }
    function ae(m) {
      const b = [];
      let n = p;
      for (const s of m)
        if (s !== null && typeof s == "object") {
          let c = -1;
          if (Array.isArray(n)) {
            const u = s.hint;
            u >= 0 && u < n.length && n[u] && n[u]._id === s.__id ? c = u : (c = n.findIndex((v) => v && v._id === s.__id), s.hint = c);
          }
          b.push(c), n = c < 0 ? undefined : n[c];
        } else
          b.push(s), n = n?.[s];
      return { path: b, value: n };
    }
    function re(m) {
      let b = p;
      for (let n = 0;n < m.length; n++) {
        const s = m[n];
        if (s !== null && typeof s == "object") {
          let c = -1;
          if (Array.isArray(b)) {
            const u = s.hint;
            u >= 0 && u < b.length && b[u] && b[u]._id === s.__id ? c = u : (c = b.findIndex((v) => v && v._id === s.__id), s.hint = c);
          }
          b = c < 0 ? undefined : b[c];
        } else
          b = b?.[s];
        if (b == null)
          return;
      }
      return b;
    }
    function be(m, b) {
      let n = p;
      for (let s = 0;s < m.length; s++) {
        const c = m[s];
        if (c !== null && typeof c == "object") {
          let u = -1;
          if (Array.isArray(n)) {
            const v = c.hint;
            v >= 0 && v < n.length && n[v] && n[v]._id === c.__id ? u = v : (u = n.findIndex(($) => $ && $._id === c.__id), c.hint = u);
          }
          n = u < 0 ? undefined : n[u];
        } else
          n = n?.[c];
        if (n == null)
          return;
      }
      return n[b];
    }
    function ie(m, ...b) {
      for (let n = 0;n < m.length; n++) {
        const s = m[n];
        if (s !== null && typeof s == "object") {
          const c = ae(m);
          if (c.path.indexOf(-1) >= 0)
            return;
          g(...c.path, ...b);
          return;
        }
      }
      g(...m, ...b);
    }
    const pe = new Map;
    function Qe(m) {
      let b = t;
      for (const n of m.split(".")) {
        if (b == null)
          return;
        b = b[n];
      }
      return Ft(b);
    }
    function Et(m) {
      for (pe.delete(m), pe.set(m, true);pe.size > i.residentMax; ) {
        const b = pe.keys().next().value;
        if (b === m)
          break;
        pe.delete(b), ie(b.split("."), Qe(b));
      }
    }
    function ar(m, b) {
      if (!(!E || pe.has(b))) {
        if (Array.isArray(re(m)))
          q(m, b);
        else {
          const n = E.get("k:" + b);
          n != null && ie(m, ye(n));
        }
        Et(b);
      }
    }
    function et(m, b, n, s) {
      if (n) {
        k.set("k:" + n.storeKey, Je(re(n.solidPath)));
        return;
      }
      if (Ye(s)) {
        for (const c of s)
          k.set("k:" + de(b, c._id), Je(c));
        k.set("k:" + b + "#x", sr);
        return;
      }
      if (b === "" && ve(s)) {
        for (const c of Object.keys(s)) {
          const u = de(b, c);
          h(u).persist && et([...m, c], u, null, s[c]);
        }
        return;
      }
      k.set("k:" + b, Je(s));
    }
    function Dt(m, b) {
      if (Ye(b)) {
        for (const n of b)
          n && n._id != null && k.set("k:" + de(m, n._id), null);
        k.set("k:" + m + "#x", null);
        return;
      }
      k.set("k:" + m, null), m && b !== null && typeof b == "object" && A.add(m);
    }
    function qr(m, b, n, s) {
      let c = s;
      !n && Ye(s) && (c = s.map(($) => $._id != null ? $ : { ...$, _id: y(b) }));
      let u = false;
      for (let $ = 0;$ < m.length; $++) {
        const z = m[$];
        if (z !== null && typeof z == "object") {
          u = true;
          break;
        }
      }
      if (u) {
        const $ = ae(m);
        if ($.path.indexOf(-1) >= 0)
          return;
        g(...$.path, c);
      } else
        g(...m, c);
      Array.isArray(c) && T.delete(b), b && xe > 0 && Ce(b, c !== null && typeof c == "object");
      let v = true;
      if (o || a) {
        const $ = h(b);
        !n && $.lazy && Et(b), v = $.persist;
      }
      v && (!n && b && c !== null && typeof c == "object" && A.add(b), et(m, b, n, c), C());
    }
    const $e = { effects: null, children: null };
    let xe = 0, zt = new Set, Nt = false;
    function Kr() {
      Nt || (Nt = true, queueMicrotask(Lt));
    }
    function Lt() {
      Nt = false;
      const m = zt;
      zt = new Set;
      for (const b of m)
        if (!b._disposed) {
          b._dirty = false;
          try {
            tt(b);
          } catch (n) {
            console.error("[skal] effect threw:", n);
          }
        }
    }
    function tt(m) {
      const { _sps: b, _vals: n } = m;
      for (let s = 0;s < b.length; s++)
        n[s] = re(b[s]);
      m._fn(n);
    }
    function cr(m) {
      for (const b of m)
        b._dirty || (b._dirty = true, zt.add(b));
    }
    function ur(m, b) {
      let n = $e;
      if (b !== "") {
        const s = b.split(".");
        for (const c of s) {
          n.children || (n.children = new Map);
          let u = n.children.get(c);
          u || (u = { effects: null, children: null }, n.children.set(c, u)), n = u;
        }
      }
      n.effects || (n.effects = new Set), n.effects.has(m) || (n.effects.add(m), xe++);
    }
    function Xr(m, b) {
      if (b === "") {
        $e.effects && $e.effects.delete(m) && (xe--, $e.effects.size === 0 && ($e.effects = null));
        return;
      }
      const n = b.split("."), s = [$e];
      let c = $e;
      for (const u of n) {
        if (!c.children)
          return;
        const v = c.children.get(u);
        if (!v)
          return;
        s.push(v), c = v;
      }
      c.effects && c.effects.delete(m) && (xe--, c.effects.size === 0 && (c.effects = null));
      for (let u = s.length - 1;u > 0; u--) {
        const v = s[u];
        if (v.effects || v.children && v.children.size > 0)
          break;
        const $ = s[u - 1];
        $.children.delete(n[u - 1]), $.children.size === 0 && ($.children = null);
      }
    }
    function rt(m) {
      if (m.effects && cr(m.effects), m.children)
        for (const [, b] of m.children)
          rt(b);
    }
    function Ce(m, b) {
      let n = $e;
      if (m !== "") {
        const s = m.split(".");
        for (const c of s) {
          if (!n.children)
            return;
          const u = n.children.get(c);
          if (!u)
            return;
          n = u;
        }
      }
      if (!(!n.effects && (!b || !n.children))) {
        if (n.effects && cr(n.effects), b && n.children)
          for (const [, s] of n.children)
            rt(s);
        Kr();
      }
    }
    function fr(m, b) {
      const n = new Array(m.length);
      for (let u = 0;u < m.length; u++)
        n[u] = m[u].split(".");
      const s = { _fn: b, _paths: m, _sps: n, _vals: new Array(m.length), _dirty: false, _disposed: false };
      for (let u = 0;u < m.length; u++)
        ur(s, m[u]);
      const c = () => {
        if (!s._disposed) {
          s._disposed = true;
          for (let u = 0;u < s._paths.length; u++)
            Xr(s, s._paths[u]);
        }
      };
      try {
        tt(s);
      } catch (u) {
        throw c(), u;
      }
      return c;
    }
    const Bt = { ready: F, backendKind: P, initTiming: w, flushNow: W, version: () => i.version, pending: () => k.size, flushes: () => S, resident: () => pe.size, engineStats: () => E && E.stats ? E.stats() : null, createEffect: fr }, Ie = new Map;
    function nt(m, b, n, s) {
      s === undefined && (s = Array.isArray(re(m)));
      const c = Ie.get(b);
      if (c !== undefined && c.isArray === s)
        return c.node;
      const u = s ? Wt(m, b, n) : Jr(m, b, n);
      return Ie.set(b, { node: u, isArray: s }), Ie.size > tl && Ie.delete(Ie.keys().next().value), u;
    }
    function Mt(m) {
      if (m.length) {
        for (const b of Ie.keys())
          for (const n of m)
            if (b === n || b.startsWith(n + ".") || b.startsWith(n + "#")) {
              Ie.delete(b);
              break;
            }
      }
    }
    function Jr(m, b, n) {
      return new Proxy({}, { get(s, c) {
        if (c === Gr)
          return Bt;
        if (typeof c == "symbol")
          return;
        if (o && !n) {
          const v = b ? b + "." + c : c;
          !pe.has(v) && h(v).lazy && ze(() => ar(m.length === 0 ? [c] : [...m, c], v));
        }
        const u = be(m, c);
        return u !== null && typeof u == "object" ? nt(m.length === 0 ? [c] : [...m, c], b ? b + "." + c : c, n, Array.isArray(u)) : u;
      }, set(s, c, u) {
        return typeof c == "symbol" ? false : (qr(m.length === 0 ? [c] : [...m, c], b ? b + "." + c : c, n, u), true);
      }, has(s, c) {
        const u = re(m);
        return u != null && c in u;
      }, ownKeys() {
        const s = re(m);
        return s ? Reflect.ownKeys(s) : [];
      }, getOwnPropertyDescriptor(s, c) {
        const u = re(m);
        if (u != null && c in u)
          return { enumerable: c !== "_id", configurable: true };
      }, deleteProperty(s, c) {
        if (typeof c == "symbol")
          return false;
        const u = b ? b + "." + c : c, v = re(m.length === 0 ? [c] : [...m, c]);
        return ie(m, or(($) => {
          $ != null && delete $[c];
        })), n ? et(m, b, n, null) : (!a || h(u).persist) && Dt(u, v), v !== null && typeof v == "object" && (Mt([u]), T.delete(u)), u && xe > 0 && Ce(u, true), C(), true;
      } });
    }
    function Wt(m, b, n) {
      const s = () => re(m) || [], c = () => {
        (n || !a || h(b).persist) && et(m, b, n, s()), C();
      };
      function u(z, B, ...H) {
        const Y = s(), te = Y.length;
        z = z < 0 ? Math.max(0, te + z) : Math.min(z, te), B = B === undefined ? te - z : Math.max(0, Math.min(B, te - z));
        const Z = Y.slice(z, z + B);
        let X = H;
        if (n || (X = H.map((K) => ve(K) && K._id == null ? { ...K, _id: y(b) } : K)), B === 0 && z === te && X.length > 0)
          for (let K = 0;K < X.length; K++)
            ie([...m, te + K], X[K]);
        else
          ie(m, or((K) => {
            K.splice(z, B, ...X);
          }));
        if (!n) {
          const K = [];
          for (const Ee of Z)
            if (Ee && Ee._id != null) {
              const Ue = de(b, Ee._id);
              k.set("k:" + Ue, null), K.push(Ue);
            }
          Mt(K);
        }
        let oe = false;
        if (!n) {
          const K = T.get(b);
          oe = K === undefined ? Ye(Y) : K, oe && (oe = X.every(ve)), T.set(b, oe);
        }
        if (oe) {
          for (const K of X)
            K && K._id != null && k.set("k:" + de(b, K._id), Je(K));
          k.set("k:" + b + "#x", sr), C();
        } else
          c();
        return xe > 0 && Ce(b, true), Z;
      }
      function v(z, B) {
        ie(m, or(z));
        const H = T.get(b);
        return B && !n && (H === undefined ? Ye(s()) : H) ? (k.set("k:" + b + "#x", sr), C()) : c(), xe > 0 && Ce(b, true), s();
      }
      const $ = { splice: u, push: (...z) => (u(s().length, 0, ...z), s().length), unshift: (...z) => (u(0, 0, ...z), s().length), pop: () => u(s().length - 1, 1)[0], shift: () => u(0, 1)[0], sort: (z) => v((B) => {
        B.sort(z);
      }, true), reverse: () => v((z) => {
        z.reverse();
      }, true), fill: (z, B, H) => v((Y) => {
        Y.fill(z, B, H);
      }, false), copyWithin: (z, B, H) => v((Y) => {
        Y.copyWithin(z, B, H);
      }, false) };
      return new Proxy([], { get(z, B) {
        if (B === Gr)
          return Bt;
        if (B === "length")
          return s().length;
        if (typeof B == "string" && Object.hasOwn($, B))
          return $[B];
        if (jr(B)) {
          const te = s(), Z = +B, X = te[Z];
          if (X !== null && typeof X == "object") {
            if (!n && X._id != null) {
              const Ee = de(b, X._id), Ue = [...m, { __id: X._id, hint: Z }];
              return nt(Ue, Ee, { solidPath: Ue, storeKey: Ee }, false);
            }
            const oe = de(b, B), K = [...m, Z];
            return n ? nt(K, oe, n, Array.isArray(X)) : nt(K, oe, { solidPath: m, storeKey: b }, Array.isArray(X));
          }
          return X;
        }
        const H = s(), Y = H[B];
        return typeof Y == "function" ? Y.bind(H) : Y;
      }, set(z, B, H) {
        if (B === "length")
          return ie(m, or((Y) => {
            Y.length = +H;
          })), T.delete(b), c(), xe > 0 && Ce(b, true), true;
        if (jr(B)) {
          const Y = +B, te = s()[Y];
          let Z = H;
          !n && ve(H) && H._id == null && (Z = { ...H, _id: te && te._id != null ? te._id : y(b) }), ie(m, Y, Z);
          let X = false;
          if (!n) {
            const oe = T.get(b);
            X = oe === undefined ? Ye(s()) : oe, X && !ve(Z) && (X = false), T.set(b, X);
          }
          if (X && Z && Z._id != null ? (k.set("k:" + de(b, Z._id), Je(Z)), C()) : c(), xe > 0) {
            const oe = Z !== null && typeof Z == "object";
            Ce(de(b, B), oe);
            const K = Z && Z._id != null ? Z._id : null;
            X && K != null && Ce(de(b, K), oe);
            const Ee = te && te._id != null ? te._id : null;
            Ee != null && Ee !== K && Ce(de(b, Ee), true);
          }
          return true;
        }
        return false;
      }, has(z, B) {
        return B === "length" || typeof B == "string" && Object.hasOwn($, B) ? true : (B in s());
      }, ownKeys() {
        return Reflect.ownKeys(s());
      }, getOwnPropertyDescriptor(z, B) {
        const H = s();
        if (B === "length")
          return { value: H.length, writable: true, enumerable: false, configurable: false };
        if (jr(B) && +B < H.length)
          return { enumerable: true, configurable: true };
      } });
    }
    function dr(m, b, n) {
      if (Array.isArray(m)) {
        const c = E.get("k:" + b + "#x");
        if (c != null) {
          n.push(b + "#x");
          const v = ye(c), $ = [];
          for (const z of v.ids || []) {
            const B = de(b, z);
            n.push(B);
            const H = E.get("k:" + B);
            H != null && $.push(ye(H));
          }
          return $;
        }
        const u = E.get("k:" + b);
        return u != null ? (n.push(b), ye(u)) : Ft(m);
      }
      if (ve(m)) {
        const c = {};
        for (const u of Object.keys(m))
          c[u] = dr(m[u], de(b, u), n);
        return c;
      }
      const s = E.get("k:" + b);
      return s != null ? (n.push(b), ye(s)) : m;
    }
    function hr(m, b) {
      if (Ye(m)) {
        let n = 0;
        for (const s of m) {
          const c = s._id == null ? 0 : +s._id;
          c > n && (n = c);
        }
        n + 1 > (V.get(b) || 1) && V.set(b, n + 1);
        for (const s of m)
          s._id == null && (s._id = y(b));
      } else if (ve(m))
        for (const n of Object.keys(m))
          hr(m[n], de(b, n));
    }
    function ge(m, b, n) {
      for (const s of Object.keys(m)) {
        const c = m[s], u = [...b, s], v = de(n, s), $ = h(v);
        if (Array.isArray(c))
          $.persist && !$.lazy && q(u, v);
        else if (ve(c)) {
          let z = true;
          if ($.persist && !$.lazy && !k.has("k:" + v)) {
            const B = E.get("k:" + v);
            if (B != null) {
              const H = ye(B);
              ie(u, H), ve(H) || (z = false, E.delPrefix && A.add(v));
            }
          }
          z && ge(c, u, v);
        } else {
          if (!$.persist || $.lazy || k.has("k:" + v))
            continue;
          const z = E.get("k:" + v);
          if (z != null) {
            const B = ye(z);
            ie(u, B), ve(B) && ge(B, u, v);
          }
        }
      }
    }
    function q(m, b) {
      if (!h(b).persist || k.has("k:" + b + "#x") || k.has("k:" + b))
        return;
      T.delete(b);
      const n = E.get("k:" + b + "#x");
      if (n != null) {
        const c = ye(n);
        V.set(b, c.nextId || 1);
        const u = [];
        for (const v of c.ids || []) {
          const $ = E.get("k:" + de(b, v));
          $ != null && u.push(ye($));
        }
        ie(m, u);
        return;
      }
      const s = E.get("k:" + b);
      s != null && ie(m, ye(s));
    }
    async function it() {
      const m = kt();
      let b = m, n = m, s = m;
      try {
        const $ = await il();
        if (b = kt(), typeof globalThis.__skal_store_open == "function" && $)
          try {
            const te = new Qo($ + "/" + i.name);
            te.open(), E = te, O("native");
          } catch {
            E = null;
          }
        if (!E) {
          const te = await Yo($), Z = new Zo(te);
          Z.open(), E = Z, O(te.kind);
        }
        n = kt();
        let z = null;
        const B = E.get("k:#meta");
        if (B != null)
          try {
            z = ye(B);
          } catch {
            z = null;
          }
        const H = z ? z.version | 0 : 0;
        let Y = false;
        if (z && z.shape && i.migrate && H < i.version) {
          const te = [], Z = dr(z.shape, "", te);
          let X = null;
          try {
            X = i.migrate(Z, H);
          } catch {
            X = null;
          }
          if (ve(X)) {
            for (const oe of te)
              k.set("k:" + oe, null);
            hr(X, ""), T.clear(), ie([], X), et([], "", null, X), Y = true;
          }
        }
        (!z || H !== i.version) && k.set("k:#meta", Je({ version: i.version, shape: Ft(t) })), s = kt(), Y || ge(t, [], ""), C();
      } catch {}
      const c = kt(), u = E && E.stats ? E.stats() : null, v = ($) => Math.round($ * 10) / 10;
      x({ total: v(c - m), dir: v(b - m), open: v(n - b), migrate: v(s - n), hydrate: v(c - s), records: u ? u.records : 0 }), R(true);
    }
    return it(), nt([], "", null, Array.isArray(t));
  }
  var ll = "#FFFFFFFF", sl = "#FFE5E5EA", qn = "#FF1C1C1E", Kn = "#FF8E8E93", ke = "#FF0A84FF", Me = "#FF34C759", Ze = "#FFFF9F0A", It = "#FFFF3B30", vt = "#FF5E5CE6";
  function j(t) {
    return (() => {
      var r = l("column"), i = l("text");
      return _(r, i), e(r, "background", "#FFFFFFFF"), e(r, "cornerRadius", 14), e(r, "padding", 16), e(r, "gap", 12), e(r, "borderWidth", 1), e(r, "borderColor", "#FFE5E5EA"), e(i, "fontSize", 15), e(i, "fontWeight", 800), e(i, "color", "#FF1C1C1E"), N(r, () => t.children, null), U((o) => e(i, "label", t.title, o)), r;
    })();
  }
  function al(t) {
    const r = ["Inbox", "Starred", "Drafts", "Archive"];
    return [(() => {
      var i = l("column");
      return e(i, "background", "#FFF2F2F7"), e(i, "padding", 16), e(i, "gap", 8), e(i, "height", "fill"), N(i, D(le, { each: r, children: (o) => (() => {
        var a = l("box"), f = l("text");
        return _(a, f), e(a, "background", "#FFFFFFFF"), e(a, "cornerRadius", 8), e(a, "padding", 12), e(a, "onTap", () => t.router.navigate("detail", { name: o }, { title: o })), e(f, "label", `${o}   \u203A`), e(f, "fontSize", 14), e(f, "color", "#FF1C1C1E"), a;
      })() })), i;
    })(), (() => {
      var i = l("drawer"), o = l("box"), a = l("text");
      return _(i, o), e(i, "background", "#FFFFFFFF"), _(o, a), e(o, "padding", 20), e(o, "background", "#FF0A84FF"), e(a, "label", "Mail"), e(a, "fontSize", 20), e(a, "fontWeight", 800), e(a, "color", "#FFFFFF"), N(i, D(le, { each: r, children: (f) => (() => {
        var h = l("box"), p = l("text");
        return _(h, p), e(h, "padding", 14), e(p, "label", f), e(p, "fontSize", 14), e(p, "color", "#FF1C1C1E"), h;
      })() }), null), i;
    })()];
  }
  function cl(t) {
    return (() => {
      var r = l("column"), i = l("text"), o = l("text");
      return _(r, i), _(r, o), e(r, "background", "#FFF2F2F7"), e(r, "padding", 16), e(r, "gap", 10), e(r, "height", "fill"), e(i, "fontSize", 20), e(i, "fontWeight", 800), e(i, "color", "#FF1C1C1E"), e(o, "label", "The AppBar's \u2039 back button (and the system back / swipe gesture) all pop this route. The list screen behind stayed mounted \u2014 back is instant, no re-render, scroll preserved."), e(o, "fontSize", 13), e(o, "color", "#FF8E8E93"), U((a) => e(i, "label", t.name, a)), r;
    })();
  }
  var ul = [ke, Me, Ze, vt];
  function fl() {
    const [t, r] = G(false), [i, o] = G(false), [a, f] = G(false), [h, p] = G(0), [g, F] = G("0, 0"), [R, P] = G(false), [O, w] = G(["Alpha", "Beta", "Gamma"]);
    let x = 3;
    const E = Br({ gallery: (k) => (() => {
      var V = l("column"), T = l("text"), A = l("row");
      return _(V, T), _(V, A), e(V, "background", "#FFF2F2F7"), e(V, "padding", 16), e(V, "gap", 12), e(V, "height", "fill"), e(T, "label", "Tap a swatch \u2014 it flies to the detail screen."), e(T, "fontSize", 13), e(T, "color", "#FF8E8E93"), e(A, "gap", 12), N(A, D(le, { each: ul, children: (d) => (() => {
        var S = l("hero"), y = l("box");
        return _(S, y), e(S, "tag", `hero-${d}`), e(y, "width", 56), e(y, "height", 56), e(y, "background", d), e(y, "cornerRadius", 12), e(y, "onTap", () => k.router.navigate("detail", { color: d })), S;
      })() })), V;
    })(), detail: { component: (k) => (() => {
      var V = l("column"), T = l("hero"), A = l("box"), d = l("text");
      return _(V, T), _(V, d), e(V, "background", "#FFF2F2F7"), e(V, "padding", 16), e(V, "gap", 12), e(V, "height", "fill"), _(T, A), e(A, "width", "fill"), e(A, "height", 180), e(A, "cornerRadius", 20), e(d, "label", "The swatch flew here from the gallery \u2014 a shared-element transition, GPU-composited host-side."), e(d, "fontSize", 13), e(d, "color", "#FF8E8E93"), U((S) => {
        var y = `hero-${k.params.color}`, C = k.params.color;
        return y !== S.e && (S.e = e(T, "tag", y, S.e)), C !== S.t && (S.t = e(A, "background", C, S.t)), S;
      }, { e: undefined, t: undefined }), V;
    })(), title: "Detail", transition: "fade" } }, "gallery");
    return (() => {
      var k = l("scrollView"), V = l("text"), T = l("text"), A = l("text");
      return _(k, V), _(k, T), _(k, A), e(k, "background", "#FFF2F2F7"), e(k, "padding", 16), e(k, "gap", 14), e(V, "label", "Animations"), e(V, "fontSize", 24), e(V, "fontWeight", 800), e(V, "color", "#FF1C1C1E"), e(T, "label", "Host-side motion \u2014 JS flips one signal, Flutter runs the whole tween. Zero per-frame bridge traffic. See ANIMATION.md for the full plan."), e(T, "fontSize", 13), e(T, "color", "#FF8E8E93"), N(k, D(j, { title: "Implicit hot-prop tween \u2014 the animate prop", get children() {
        return [(() => {
          var d = l("row"), S = l("box");
          return _(d, S), e(d, "gap", 8), e(S, "width", 64), e(S, "height", 64), e(S, "background", "#FF0A84FF"), e(S, "cornerRadius", 14), e(S, "animate", { duration: 450, curve: "easeInOut" }), U((y) => {
            var C = t() ? 0.3 : 1, I = t() ? 1.4 : 1, W = t() ? 1.4 : 1, ae = t() ? 0.5 : 0, re = t() ? 70 : 0;
            return C !== y.e && (y.e = e(S, "opacity", C, y.e)), I !== y.t && (y.t = e(S, "scaleX", I, y.t)), W !== y.a && (y.a = e(S, "scaleY", W, y.a)), ae !== y.o && (y.o = e(S, "rotation", ae, y.o)), re !== y.i && (y.i = e(S, "translationX", re, y.i)), y;
          }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined }), d;
        })(), (() => {
          var d = l("button");
          return e(d, "onClick", () => r(!t())), U((S) => e(d, "label", t() ? "Reset" : "Animate", S)), d;
        })(), (() => {
          var d = l("text");
          return e(d, "label", "opacity + scale + rotation + translation tween together \u2014 JS only flips one signal; the whole tween runs host-side."), e(d, "fontSize", 11), e(d, "color", "#FF8E8E93"), d;
        })()];
      } }), A), N(k, D(j, { title: "Cold-prop tween \u2014 colour \xB7 radius \xB7 padding", get children() {
        return [(() => {
          var d = l("box"), S = l("text");
          return _(d, S), e(d, "animate", { duration: 400, curve: "easeInOut" }), e(d, "width", "fill"), e(S, "label", "AnimatedContainer tweens these host-side"), e(S, "fontSize", 12), e(S, "color", "#FFFFFFFF"), U((y) => {
            var C = i() ? It : ke, I = i() ? 32 : 8, W = i() ? 28 : 12;
            return C !== y.e && (y.e = e(d, "background", C, y.e)), I !== y.t && (y.t = e(d, "cornerRadius", I, y.t)), W !== y.a && (y.a = e(d, "padding", W, y.a)), y;
          }, { e: undefined, t: undefined, a: undefined }), d;
        })(), (() => {
          var d = l("button");
          return e(d, "onClick", () => o(!i())), U((S) => e(d, "label", i() ? "Reset" : "Animate", S)), d;
        })(), (() => {
          var d = l("text");
          return e(d, "label", "background, cornerRadius and padding are cold props \u2014 the host's AnimatedContainer tweens them; JS writes each value once."), e(d, "fontSize", 11), e(d, "color", "#FF8E8E93"), d;
        })()];
      } }), A), N(k, D(j, { title: "Looping \u2014 repeat \xB7 reverse", get children() {
        return [(() => {
          var d = l("row"), S = l("box"), y = l("box"), C = l("box");
          return _(d, S), _(d, y), _(d, C), e(d, "gap", 20), e(S, "width", 44), e(S, "height", 44), e(S, "background", "#FF5E5CE6"), e(S, "cornerRadius", 22), e(S, "animate", { duration: 800, curve: "easeInOut", repeat: true, reverse: true }), e(S, "scaleX", 1.35), e(S, "scaleY", 1.35), e(y, "width", 44), e(y, "height", 44), e(y, "background", "#FF34C759"), e(y, "cornerRadius", 10), e(y, "animate", { duration: 1400, repeat: true }), e(y, "rotation", 6.2832), e(C, "width", 44), e(C, "height", 44), e(C, "background", "#FFFF9F0A"), e(C, "cornerRadius", 22), e(C, "animate", { duration: 900, curve: "easeInOut", repeat: true, reverse: true }), e(C, "opacity", 0.25), d;
        })(), (() => {
          var d = l("text");
          return e(d, "label", "A pulse, a spin and a breathe \u2014 each loops forever host-side; JS set the endpoints once and never touches them again."), e(d, "fontSize", 11), e(d, "color", "#FF8E8E93"), d;
        })()];
      } }), A), N(k, D(j, { title: "Spring physics \u2014 animate.spring", get children() {
        return [(() => {
          var d = l("column"), S = l("box"), y = l("box"), C = l("box");
          return _(d, S), _(d, y), _(d, C), e(d, "gap", 10), e(S, "width", 48), e(S, "height", 48), e(S, "background", "#FF0A84FF"), e(S, "cornerRadius", 10), e(S, "animate", { duration: 700, spring: "gentle" }), e(y, "width", 48), e(y, "height", 48), e(y, "background", "#FF34C759"), e(y, "cornerRadius", 10), e(y, "animate", { duration: 700, spring: "bouncy" }), e(C, "width", 48), e(C, "height", 48), e(C, "background", "#FFFF9F0A"), e(C, "cornerRadius", 10), e(C, "animate", { duration: 700, spring: "stiff" }), U((I) => {
            var W = a() ? 150 : 0, ae = a() ? 150 : 0, re = a() ? 150 : 0;
            return W !== I.e && (I.e = e(S, "translationX", W, I.e)), ae !== I.t && (I.t = e(y, "translationX", ae, I.t)), re !== I.a && (I.a = e(C, "translationX", re, I.a)), I;
          }, { e: undefined, t: undefined, a: undefined }), d;
        })(), (() => {
          var d = l("button");
          return e(d, "onClick", () => f(!a())), U((S) => e(d, "label", a() ? "Back" : "Spring", S)), d;
        })(), (() => {
          var d = l("text");
          return e(d, "label", "gentle \xB7 bouncy \xB7 stiff \u2014 three spring-like curves; bouncy overshoots and wobbles into place."), e(d, "fontSize", 11), e(d, "color", "#FF8E8E93"), d;
        })()];
      } }), A), N(k, D(j, { title: "Physics \u2014 real SpringSimulation (spring)", get children() {
        return [(() => {
          var d = l("column"), S = l("box"), y = l("box"), C = l("box");
          return _(d, S), _(d, y), _(d, C), e(d, "gap", 12), e(S, "width", 52), e(S, "height", 52), e(S, "background", "#FF0A84FF"), e(S, "cornerRadius", 12), e(S, "spring", "gentle"), e(y, "width", 52), e(y, "height", 52), e(y, "background", "#FF34C759"), e(y, "cornerRadius", 12), e(y, "spring", "bouncy"), e(C, "width", 52), e(C, "height", 52), e(C, "background", "#FFFF9F0A"), e(C, "cornerRadius", 12), e(C, "spring", "stiff"), U((I) => {
            var W = h(), ae = h(), re = h();
            return W !== I.e && (I.e = e(S, "translationX", W, I.e)), ae !== I.t && (I.t = e(y, "translationX", ae, I.t)), re !== I.a && (I.a = e(C, "translationX", re, I.a)), I;
          }, { e: undefined, t: undefined, a: undefined }), d;
        })(), (() => {
          var d = l("button");
          return e(d, "onClick", () => p(h() === 0 ? 175 : 0)), U((S) => e(d, "label", h() === 0 ? "Spring" : "Back", S)), d;
        })(), (() => {
          var d = l("text");
          return e(d, "label", "A real SpringSimulation drives these \u2014 not a curve. Tap fast: the box retargets from its CURRENT position and velocity mid-flight, with no dead-stop restart. gentle settles, bouncy overshoots, stiff snaps."), e(d, "fontSize", 11), e(d, "color", "#FF8E8E93"), d;
        })()];
      } }), A), N(k, D(j, { title: "Physics \u2014 release momentum (draggable + release)", get children() {
        return [(() => {
          var d = l("box"), S = l("box"), y = l("text");
          return _(d, S), e(d, "height", 150), e(d, "background", "#FFEFEFF4"), e(d, "cornerRadius", 12), _(S, y), e(S, "draggable", true), e(S, "release", "glide"), e(S, "width", 60), e(S, "height", 60), e(S, "background", "#FF0A84FF"), e(S, "cornerRadius", 14), e(S, "onPanEnd", (C, I) => F(`${C.toFixed(0)}, ${I.toFixed(0)}`)), e(y, "label", "glide"), e(y, "fontSize", 11), e(y, "color", "#FFFFFFFF"), d;
        })(), (() => {
          var d = l("text");
          return e(d, "fontSize", 11), e(d, "color", "#FF8E8E93"), U((S) => e(d, "label", `Throw the blue box \u2014 friction carries it on after you let go and decelerates it to rest. Resting at ${g()}.`, S)), d;
        })(), (() => {
          var d = l("box"), S = l("box"), y = l("text");
          return _(d, S), e(d, "height", 150), e(d, "background", "#FFEFEFF4"), e(d, "cornerRadius", 12), _(S, y), e(S, "draggable", true), e(S, "release", "springBack"), e(S, "width", 60), e(S, "height", 60), e(S, "background", "#FF5E5CE6"), e(S, "cornerRadius", 14), e(y, "label", "spring"), e(y, "fontSize", 11), e(y, "color", "#FFFFFFFF"), d;
        })(), (() => {
          var d = l("text");
          return e(d, "label", "Throw the purple box \u2014 a SpringSimulation springs it home to the origin, seeded with your fling velocity (throw harder \u2192 springs back harder). All host-side: zero per-frame bridge traffic."), e(d, "fontSize", 11), e(d, "color", "#FF8E8E93"), d;
        })()];
      } }), A), N(k, D(j, { title: "Cross-fade \u2014 CrossFade", get children() {
        return [(() => {
          var d = l("box"), S = l("crossFade");
          return _(d, S), e(d, "height", 92), N(S, (() => {
            var y = Lr(() => !!R());
            return () => y() ? (() => {
              var C = l("box"), I = l("text");
              return _(C, I), e(C, "width", "fill"), e(C, "height", 92), e(C, "background", "#FF5E5CE6"), e(C, "cornerRadius", 12), e(C, "padding", 16), e(I, "label", "Panel B"), e(I, "fontSize", 16), e(I, "fontWeight", 800), e(I, "color", "#FFFFFFFF"), C;
            })() : (() => {
              var C = l("box"), I = l("text");
              return _(C, I), e(C, "width", "fill"), e(C, "height", 92), e(C, "background", "#FF0A84FF"), e(C, "cornerRadius", 12), e(C, "padding", 16), e(I, "label", "Panel A"), e(I, "fontSize", 16), e(I, "fontWeight", 800), e(I, "color", "#FFFFFFFF"), C;
            })();
          })()), d;
        })(), (() => {
          var d = l("button");
          return e(d, "label", "Swap panel"), e(d, "onClick", () => P(!R())), d;
        })(), (() => {
          var d = l("text");
          return e(d, "label", "AnimatedSwitcher fades the old child out as the new fades in \u2014 the outgoing element is retained through the fade."), e(d, "fontSize", 11), e(d, "color", "#FF8E8E93"), d;
        })()];
      } }), A), N(k, D(j, { title: "Animated list \u2014 AnimatedList", get children() {
        return [(() => {
          var d = l("animatedList");
          return e(d, "gap", 8), N(d, D(le, { get each() {
            return O();
          }, children: (S) => (() => {
            var y = l("box"), C = l("text");
            return _(y, C), e(y, "background", "#FFEFEFF4"), e(y, "cornerRadius", 8), e(y, "padding", 12), e(C, "label", S), e(C, "fontSize", 13), e(C, "color", "#FF1C1C1E"), y;
          })() })), d;
        })(), (() => {
          var d = l("row"), S = l("button"), y = l("button");
          return _(d, S), _(d, y), e(d, "gap", 8), e(S, "label", "Add"), e(S, "onClick", () => w([...O(), `Item ${++x}`])), e(y, "label", "Remove"), e(y, "onClick", () => w(O().slice(0, -1))), d;
        })(), (() => {
          var d = l("text");
          return e(d, "label", "Add \u2192 a row fades + expands in; Remove \u2192 it collapses + fades out. Both host-side, via deferred teardown."), e(d, "fontSize", 11), e(d, "color", "#FF8E8E93"), d;
        })()];
      } }), A), N(k, D(j, { title: "Shared element \u2014 Hero", get children() {
        return [(() => {
          var d = l("box");
          return e(d, "height", 300), e(d, "borderWidth", 1), e(d, "borderColor", "#FFE5E5EA"), e(d, "cornerRadius", 8), N(d, D(E.View, {})), d;
        })(), (() => {
          var d = l("text");
          return e(d, "label", "A Hero with a matching tag on each screen flies between them across the navigator push \u2014 the navigator is a real Flutter Navigator."), e(d, "fontSize", 11), e(d, "color", "#FF8E8E93"), d;
        })()];
      } }), A), e(A, "label", "\u2014 end of animations \u2014"), e(A, "fontSize", 12), e(A, "color", "#FF8E8E93"), k;
    })();
  }
  function dl() {
    const [t, r] = G("material"), [i, o] = G(false), [a, f] = G(true), [h, p] = G(false), [g, F] = G(40), [R, P] = G(""), [O, w] = G("none yet"), [x, E] = G(0), [k, V] = G(["Item one", "Item two", "Item three", "Item four"]);
    let T = 0;
    const [A, d] = G([]), [S, y] = G([]), [C, I] = G("M"), [W, ae] = G([]), [re, be] = G(0), [ie, pe] = G(false), [Qe, Et] = G(0), [ar, et] = G(0), [Dt, qr] = G(false), [$e, xe] = G("\u2014"), [zt, Nt] = G("0, 0"), [Kr, Lt] = G("\u2014"), [tt, cr] = G(1);
    let ur = 1;
    const [Xr, rt] = G("\u2014 try a dialog button \u2014"), [Ce, fr] = G("\u2014 no date / time picked \u2014"), [Bt, Ie] = G(["First item", "Second item", "Third item", "Fourth item"]), nt = Br({ list: { component: (ge) => D(al, { get router() {
      return ge.router;
    } }), title: "Mailboxes" }, detail: (ge) => D(cl, { get name() {
      return ge.params.name;
    }, get router() {
      return ge.router;
    } }) }, "list"), [Mt, Jr] = G(0), Wt = (ge, q) => {
      r(ge), o(q), io(ge, q ? 1 : 0);
    }, dr = Br({ home: { component: (ge) => hr(ge.router) }, animations: { component: () => D(fl, {}), title: "Animations" } }, "home");
    function hr(ge) {
      return (() => {
        var q = l("scrollView"), it = l("text"), m = l("text"), b = l("text");
        return _(q, it), _(q, m), _(q, b), e(q, "background", "#FFF2F2F7"), e(q, "padding", 16), e(q, "gap", 14), e(q, "scrollbar", true), e(it, "label", "Skal \u2014 Component Demo"), e(it, "fontSize", 24), e(it, "fontWeight", 800), e(it, "color", "#FF1C1C1E"), e(m, "label", "Every fast-path widget, plus animation, the design system, and dialogs."), e(m, "fontSize", 13), e(m, "color", "#FF8E8E93"), N(q, D(j, { title: "Design system \u2014 setDesign()", get children() {
          return [(() => {
            var n = l("text");
            return e(n, "fontSize", 13), e(n, "color", "#FF8E8E93"), U((s) => e(n, "label", `active: ${t()} \xB7 ${i() ? "dark" : "light"}`, s)), n;
          })(), (() => {
            var n = l("row"), s = l("button"), c = l("button"), u = l("button");
            return _(n, s), _(n, c), _(n, u), e(n, "gap", 8), e(s, "label", "Material"), e(s, "onClick", () => Wt("material", i())), e(c, "label", "Cupertino"), e(c, "onClick", () => Wt("cupertino", i())), e(u, "onClick", () => Wt(t(), !i())), U((v) => e(u, "label", i() ? "Light mode" : "Dark mode", v)), n;
          })(), (() => {
            var n = l("text");
            return e(n, "label", "Buttons, switches, sliders, the text field & spinner all swap Material\u2194Cupertino."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })()];
        } }), b), N(q, D(j, { title: "Layout \u2014 box \xB7 row \xB7 wrap", get children() {
          return [(() => {
            var n = l("row"), s = l("box"), c = l("box"), u = l("box");
            return _(n, s), _(n, c), _(n, u), e(n, "gap", 8), e(s, "width", 56), e(s, "height", 56), e(s, "background", "#FF0A84FF"), e(s, "cornerRadius", 10), e(c, "width", 56), e(c, "height", 56), e(c, "background", "#FF34C759"), e(c, "cornerRadius", 10), e(u, "width", 56), e(u, "height", 56), e(u, "background", "#FFFF9F0A"), e(u, "cornerRadius", 10), n;
          })(), (() => {
            var n = l("text");
            return e(n, "label", "Wrap \u2014 children flow onto new runs:"), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = l("wrap");
            return e(n, "gap", 6), N(n, D(le, { each: ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa"], children: (s) => (() => {
              var c = l("box"), u = l("text");
              return _(c, u), e(c, "background", "#FFEFEFF4"), e(c, "cornerRadius", 12), e(c, "paddingLeft", 10), e(c, "paddingRight", 10), e(c, "paddingTop", 6), e(c, "paddingBottom", 6), e(u, "label", s), e(u, "fontSize", 12), e(u, "color", "#FF1C1C1E"), c;
            })() })), n;
          })()];
        } }), b), N(q, D(j, { title: "Stack \u2014 overlap + positioned children", get children() {
          var n = l("stack"), s = l("box"), c = l("box"), u = l("text"), v = l("box");
          return _(n, s), _(n, c), _(n, v), e(n, "width", "fill"), e(n, "height", 120), e(s, "width", "fill"), e(s, "height", 120), e(s, "background", "#FF5E5CE6"), e(s, "cornerRadius", 12), _(c, u), e(c, "top", 10), e(c, "left", 10), e(c, "background", "#FFFFFFFF"), e(c, "cornerRadius", 8), e(c, "paddingLeft", 10), e(c, "paddingRight", 10), e(c, "paddingTop", 4), e(c, "paddingBottom", 4), e(u, "label", "top \xB7 left"), e(u, "fontSize", 11), e(u, "color", "#FF1C1C1E"), e(v, "bottom", 10), e(v, "right", 10), e(v, "width", 30), e(v, "height", 30), e(v, "background", "#FFFF3B30"), e(v, "cornerRadius", 15), n;
        } }), b), N(q, D(j, { title: "Text & RichText", get children() {
          return [(() => {
            var n = l("text");
            return e(n, "label", "Styled text \u2014 18sp, weight 700."), e(n, "fontSize", 18), e(n, "fontWeight", 700), e(n, "color", "#FF1C1C1E"), n;
          })(), (() => {
            var n = l("richText"), s = l("text"), c = l("text"), u = l("text"), v = l("text"), $ = l("text");
            return _(n, s), _(n, c), _(n, u), _(n, v), _(n, $), e(s, "label", "Rich text "), e(s, "fontSize", 16), e(s, "color", "#FF1C1C1E"), e(c, "label", "mixes "), e(c, "fontSize", 16), e(c, "color", "#FF0A84FF"), e(c, "fontWeight", 800), e(u, "label", "size, "), e(u, "fontSize", 22), e(u, "color", "#FFFF3B30"), e(u, "fontWeight", 700), e(v, "label", "weight "), e(v, "fontSize", 16), e(v, "color", "#FF34C759"), e(v, "fontWeight", 800), e($, "label", "and colour inline."), e($, "fontSize", 16), e($, "color", "#FF1C1C1E"), n;
          })()];
        } }), b), N(q, D(j, { title: "Image \u2014 network \xB7 BoxFit \xB7 rounded", get children() {
          return [(() => {
            var n = l("image");
            return e(n, "src", "https://picsum.photos/seed/skal/640/360"), e(n, "width", "fill"), e(n, "height", 160), e(n, "contentScale", 1), e(n, "cornerRadius", 12), n;
          })(), (() => {
            var n = l("text");
            return e(n, "label", "contentScale=1 (cover); cornerRadius clips the pixels. Requires network."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })()];
        } }), b), N(q, D(j, { title: "Scrolling \u2014 horizontal list \xB7 lazy grid \xB7 reorderable", get children() {
          return [(() => {
            var n = l("text");
            return e(n, "label", "listView axis=1 (horizontal, virtualized):"), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = l("listView");
            return e(n, "axis", 1), e(n, "height", 66), e(n, "gap", 8), N(n, D(le, { each: [ke, Me, Ze, vt, It, "#FF00C7BE", "#FFAF52DE", "#FFFFD60A"], children: (s) => (() => {
              var c = l("box");
              return e(c, "width", 66), e(c, "height", 50), e(c, "background", s), e(c, "cornerRadius", 10), c;
            })() })), n;
          })(), (() => {
            var n = l("text");
            return e(n, "label", "lazyGrid \u2014 crossAxisCount=4:"), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = l("lazyGrid");
            return e(n, "crossAxisCount", 4), e(n, "aspectRatio", 1), e(n, "gap", 8), e(n, "height", 150), N(n, D(le, { get each() {
              return Array.from({ length: 12 }, (s, c) => c);
            }, children: (s) => (() => {
              var c = l("box");
              return e(c, "background", s % 3 === 0 ? ke : s % 3 === 1 ? Me : Ze), e(c, "cornerRadius", 8), c;
            })() })), n;
          })(), (() => {
            var n = l("text");
            return e(n, "label", "reorderableListView \u2014 drag a row to reorder:"), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = l("reorderableListView");
            return e(n, "height", 200), e(n, "gap", 6), e(n, "onReorder", (s, c) => {
              const u = Bt().slice(), [v] = u.splice(s, 1);
              u.splice(c, 0, v), Ie(u);
            }), N(n, D(le, { get each() {
              return Bt();
            }, children: (s) => (() => {
              var c = l("box"), u = l("text");
              return _(c, u), e(c, "background", "#FFEFEFF4"), e(c, "cornerRadius", 8), e(c, "padding", 12), e(u, "label", s), e(u, "fontSize", 13), e(u, "color", "#FF1C1C1E"), c;
            })() })), n;
          })()];
        } }), b), N(q, D(j, { title: "Controls \u2014 switch \xB7 checkbox \xB7 slider \xB7 text field", get children() {
          return [(() => {
            var n = l("row"), s = l("switch"), c = l("text");
            return _(n, s), _(n, c), e(n, "gap", 12), e(s, "onChange", (u) => f(u)), e(c, "fontSize", 13), e(c, "color", "#FF1C1C1E"), U((u) => {
              var v = a(), $ = a() ? "switch: on" : "switch: off";
              return v !== u.e && (u.e = e(s, "checked", v, u.e)), $ !== u.t && (u.t = e(c, "label", $, u.t)), u;
            }, { e: undefined, t: undefined }), n;
          })(), (() => {
            var n = l("row"), s = l("checkbox"), c = l("text");
            return _(n, s), _(n, c), e(n, "gap", 12), e(s, "onChange", (u) => p(u)), e(c, "fontSize", 13), e(c, "color", "#FF1C1C1E"), U((u) => {
              var v = h(), $ = h() ? "checkbox: checked" : "checkbox: unchecked";
              return v !== u.e && (u.e = e(s, "checked", v, u.e)), $ !== u.t && (u.t = e(c, "label", $, u.t)), u;
            }, { e: undefined, t: undefined }), n;
          })(), (() => {
            var n = l("slider");
            return e(n, "min", 0), e(n, "max", 100), e(n, "onChange", (s) => F(s)), U((s) => e(n, "value", g(), s)), n;
          })(), (() => {
            var n = l("text");
            return e(n, "fontSize", 13), e(n, "color", "#FF1C1C1E"), U((s) => e(n, "label", `slider: ${Math.round(g())}`, s)), n;
          })(), (() => {
            var n = l("textInput");
            return e(n, "placeholder", "Type your name\u2026"), e(n, "onChange", (s) => P(s)), e(n, "onSubmit", (s) => Pn(`Submitted: ${s}`)), U((s) => e(n, "value", R(), s)), n;
          })(), (() => {
            var n = l("text");
            return e(n, "fontSize", 13), e(n, "color", "#FF8E8E93"), U((s) => e(n, "label", R() ? `Hello, ${R()}!` : "\u2014 type above; press Enter to submit \u2014", s)), n;
          })()];
        } }), b), N(q, D(j, { title: "Indicators \u2014 spinner \xB7 progress bar", get children() {
          return [(() => {
            var n = l("row"), s = l("activityIndicator"), c = l("text");
            return _(n, s), _(n, c), e(n, "gap", 12), e(s, "color", "#FF0A84FF"), e(c, "label", "CircularProgressIndicator"), e(c, "fontSize", 13), e(c, "color", "#FF1C1C1E"), n;
          })(), (() => {
            var n = l("text");
            return e(n, "label", "determinate \u2014 tracks the slider above:"), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = l("progressBar");
            return e(n, "color", "#FF0A84FF"), U((s) => e(n, "progress", g() / 100, s)), n;
          })(), (() => {
            var n = l("text");
            return e(n, "label", "indeterminate:"), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = l("progressBar");
            return e(n, "color", "#FF34C759"), n;
          })()];
        } }), b), N(q, D(j, { title: "Animation", get children() {
          return [(() => {
            var n = l("text");
            return e(n, "label", "Implicit tweens, looping, list enter/exit, Hero \u2014 all host-side, zero per-frame bridge traffic. Opens a dedicated page."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = l("button");
            return e(n, "label", "Open Animations \u2192"), e(n, "onClick", () => ge.navigate("animations")), n;
          })()];
        } }), b), N(q, D(j, { title: "ListTile \u2014 structured rows", get children() {
          return [(() => {
            var n = l("box"), s = l("column"), c = l("listTile"), u = l("listTile"), v = l("listTile");
            return _(n, s), e(n, "background", "#FFFFFFFF"), e(n, "cornerRadius", 12), e(n, "borderWidth", 1), e(n, "borderColor", "#FFE5E5EA"), _(s, c), _(s, u), _(s, v), e(s, "padding", 0), e(s, "gap", 0), e(c, "leadingIcon", "person"), e(c, "title", "Profile"), e(c, "subtitle", "Name, photo, bio"), e(c, "trailingIcon", "explore"), e(c, "onClick", () => w("tapped Profile")), e(u, "leadingIcon", "bell"), e(u, "title", "Notifications"), e(u, "subtitle", "Sounds, badges, alerts"), e(u, "trailingIcon", "explore"), e(u, "onClick", () => w("tapped Notifications")), e(v, "leadingIcon", "settings"), e(v, "title", "Settings"), e(v, "trailingIcon", "explore"), e(v, "onClick", () => w("tapped Settings")), n;
          })(), (() => {
            var n = l("text");
            return e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), U((s) => e(n, "label", `last row: ${O()}`, s)), n;
          })()];
        } }), b), N(q, D(j, { title: "PageView \u2014 swipe between pages", get children() {
          return [(() => {
            var n = l("box"), s = l("pageView"), c = l("box"), u = l("text"), v = l("box"), $ = l("text"), z = l("box"), B = l("text");
            return _(n, s), e(n, "height", 140), _(s, c), _(s, v), _(s, z), e(s, "onChange", (H) => E(H)), _(c, u), e(c, "width", "fill"), e(c, "height", 140), e(c, "background", "#FF0A84FF"), e(c, "cornerRadius", 12), e(c, "padding", 20), e(u, "label", "Page 1 \u2014 swipe \u2192"), e(u, "fontSize", 16), e(u, "fontWeight", 800), e(u, "color", "#FFFFFFFF"), _(v, $), e(v, "width", "fill"), e(v, "height", 140), e(v, "background", "#FF34C759"), e(v, "cornerRadius", 12), e(v, "padding", 20), e($, "label", "Page 2"), e($, "fontSize", 16), e($, "fontWeight", 800), e($, "color", "#FFFFFFFF"), _(z, B), e(z, "width", "fill"), e(z, "height", 140), e(z, "background", "#FFFF9F0A"), e(z, "cornerRadius", 12), e(z, "padding", 20), e(B, "label", "Page 3"), e(B, "fontSize", 16), e(B, "fontWeight", 800), e(B, "color", "#FFFFFFFF"), U((H) => e(s, "activeTab", x(), H)), n;
          })(), (() => {
            var n = l("row"), s = l("button"), c = l("button");
            return _(n, s), _(n, c), e(n, "gap", 8), e(s, "label", "\u25C0 Prev"), e(s, "onClick", () => E(Math.max(0, x() - 1))), e(c, "label", "Next \u25B6"), e(c, "onClick", () => E(Math.min(2, x() + 1))), n;
          })(), (() => {
            var n = l("text");
            return e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), U((s) => e(n, "label", `page ${x() + 1} of 3 \u2014 swipe or use the buttons`, s)), n;
          })()];
        } }), b), N(q, D(j, { title: "Pull-to-refresh + swipe-to-dismiss", get children() {
          return [(() => {
            var n = l("box"), s = l("listView");
            return _(n, s), e(n, "height", 210), e(n, "borderWidth", 1), e(n, "borderColor", "#FFE5E5EA"), e(n, "cornerRadius", 8), e(s, "onRefresh", async () => {
              await new Promise((c) => setTimeout(c, 900)), V([`Fresh item ${++T}`, ...k()]);
            }), N(s, D(le, { get each() {
              return k();
            }, children: (c) => (() => {
              var u = l("dismissible"), v = l("box"), $ = l("text");
              return _(u, v), e(u, "onDismiss", () => V(k().filter((z) => z !== c))), _(v, $), e(v, "width", "fill"), e(v, "background", "#FFEFEFF4"), e(v, "cornerRadius", 8), e(v, "padding", 14), e($, "label", c), e($, "fontSize", 13), e($, "color", "#FF1C1C1E"), u;
            })() })), n;
          })(), (() => {
            var n = l("text");
            return e(n, "label", "Pull the list down to refresh (a 900ms async task \u2014 the spinner waits for it); swipe any row sideways to dismiss it."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })()];
        } }), b), N(q, D(j, { title: "Slivers \u2014 collapsing header (CustomScrollView)", get children() {
          return [(() => {
            var n = l("box"), s = l("customScrollView"), c = l("sliverAppBar"), u = l("box"), v = l("text"), $ = l("sliverList"), z = l("sliverGrid");
            return _(n, s), e(n, "height", 340), e(n, "borderWidth", 1), e(n, "borderColor", "#FFE5E5EA"), e(n, "cornerRadius", 8), _(s, c), _(s, $), _(s, z), _(c, u), e(c, "title", "Collapsing header"), e(c, "height", 170), e(c, "sliverMode", "pinned"), e(c, "background", "#FF0A84FF"), _(u, v), e(u, "width", "fill"), e(u, "height", 170), e(u, "background", "#FF5E5CE6"), e(u, "padding", 20), e(v, "label", "Parallax background"), e(v, "fontSize", 18), e(v, "fontWeight", 800), e(v, "color", "#FFFFFFFF"), N($, D(le, { each: ["One", "Two", "Three", "Four", "Five"], children: (B) => (() => {
              var H = l("box"), Y = l("text");
              return _(H, Y), e(H, "width", "fill"), e(H, "background", "#FFFFFFFF"), e(H, "padding", 16), e(H, "borderWidth", 1), e(H, "borderColor", "#FFE5E5EA"), e(Y, "label", `Row ${B}`), e(Y, "fontSize", 14), e(Y, "color", "#FF1C1C1E"), H;
            })() })), e(z, "crossAxisCount", 3), e(z, "aspectRatio", 1), e(z, "gap", 8), N(z, D(le, { each: [ke, Me, Ze, vt, It, ke, Me, Ze, vt], children: (B) => (() => {
              var H = l("box");
              return e(H, "background", B), e(H, "cornerRadius", 10), H;
            })() })), n;
          })(), (() => {
            var n = l("text");
            return e(n, "label", "Scroll the panel up \u2014 the purple header collapses into a pinned blue bar. The SliverList builds rows lazily; non-sliver children would auto-wrap in a SliverToBoxAdapter."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })()];
        } }), b), N(q, D(j, { title: "Canvas \u2014 CustomPaint 2-D drawing", get children() {
          return [(() => {
            var n = l("box"), s = l("canvas");
            return _(n, s), e(n, "background", "#FFFFFFFF"), e(n, "cornerRadius", 12), e(n, "borderWidth", 1), e(n, "borderColor", "#FFE5E5EA"), e(n, "padding", 10), e(s, "width", 300), e(s, "height", 170), e(s, "draw", (c) => {
              c.strokeStyle(sl).lineWidth(2).beginPath().moveTo(16, 150).lineTo(284, 150).stroke(), [50, 95, 70, g() + 10, 80].forEach((u, v) => {
                c.fillStyle(v === 3 ? ke : vt).fillRect(28 + v * 52, 150 - u, 34, u);
              }), c.fillStyle(Me).beginPath().circle(252, 44, 22).fill(), c.fillStyle(qn).fontSize(12).fillText("bars \xB7 circle \xB7 path \xB7 text", 18, 22), A().forEach((u) => {
                c.fillStyle(u.color).beginPath().circle(u.x, u.y, u.r).fill();
              });
            }), n;
          })(), (() => {
            var n = l("row"), s = l("button"), c = l("button");
            return _(n, s), _(n, c), e(n, "gap", 8), e(s, "label", "Draw a shape"), e(s, "onClick", () => d([...A(), { x: 24 + Math.random() * 252, y: 16 + Math.random() * 120, r: 8 + Math.random() * 20, color: [ke, Me, Ze, It, vt][Math.floor(Math.random() * 5)] }])), e(c, "label", "Clear"), e(c, "onClick", () => d([])), n;
          })(), (() => {
            var n = l("text");
            return e(n, "label", "Bars, a circle, a stroked path, text. The 4th bar tracks the Controls slider; the buttons append/clear circles \u2014 each click flips the canvasShapes signal, so the draw callback re-records and the host repaints. Static drawings cross the bridge exactly once."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })()];
        } }), b), N(q, D(j, { title: "Drag-and-drop \u2014 DragItem onto DropZone", get children() {
          return [(() => {
            var n = l("row");
            return e(n, "gap", 8), N(n, D(le, { each: ["Apple", "Banana", "Cherry"], children: (s) => (() => {
              var c = l("dragItem"), u = l("box"), v = l("text");
              return _(c, u), e(c, "dragData", s), _(u, v), e(u, "background", "#FF5E5CE6"), e(u, "cornerRadius", 20), e(u, "padding", 12), e(v, "label", s), e(v, "fontSize", 13), e(v, "color", "#FFFFFFFF"), c;
            })() })), n;
          })(), (() => {
            var n = l("dropZone"), s = l("box"), c = l("text");
            return _(n, s), e(n, "onDrop", (u) => y([...S(), u])), _(s, c), e(s, "width", "fill"), e(s, "height", 90), e(s, "background", "#FFEFEFF4"), e(s, "cornerRadius", 12), e(s, "padding", 16), e(c, "fontSize", 13), e(c, "color", "#FF1C1C1E"), U((u) => e(c, "label", S().length ? `Basket: ${S().join(", ")}` : "Drag a chip into this zone", u)), n;
          })(), (() => {
            var n = l("row"), s = l("button");
            return _(n, s), e(n, "gap", 8), e(s, "label", "Clear basket"), e(s, "onClick", () => y([])), n;
          })(), (() => {
            var n = l("text");
            return e(n, "label", "Drag a fruit chip onto the zone \u2014 it highlights host-side while you hover; on release onDrop fires with the chip's dragData string. The whole drag is host-side; only the drop crosses the bridge."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })()];
        } }), b), N(q, D(j, { title: "More controls \u2014 radio \xB7 chip \xB7 segmented \xB7 accordion", get children() {
          return [(() => {
            var n = l("row");
            return e(n, "gap", 16), N(n, D(le, { each: ["S", "M", "L"], children: (s) => (() => {
              var c = l("row"), u = l("radio"), v = l("text");
              return _(c, u), _(c, v), e(c, "gap", 2), e(u, "onChange", () => I(s)), e(v, "label", s), e(v, "fontSize", 13), e(v, "color", "#FF1C1C1E"), U(($) => e(u, "checked", C() === s, $)), c;
            })() })), n;
          })(), (() => {
            var n = l("row");
            return e(n, "gap", 8), N(n, D(le, { each: ["Red", "Green", "Blue"], children: (s) => (() => {
              var c = l("chip");
              return e(c, "label", s), e(c, "onChange", (u) => ae(u ? [...W(), s] : W().filter((v) => v !== s))), U((u) => e(c, "checked", W().includes(s), u)), c;
            })() })), n;
          })(), (() => {
            var n = l("segmentedButton"), s = l("text"), c = l("text"), u = l("text");
            return _(n, s), _(n, c), _(n, u), e(n, "onChange", (v) => be(v)), e(s, "label", "Day"), e(s, "fontSize", 13), e(c, "label", "Week"), e(c, "fontSize", 13), e(u, "label", "Month"), e(u, "fontSize", 13), U((v) => e(n, "activeTab", re(), v)), n;
          })(), (() => {
            var n = l("row"), s = l("text"), c = l("dropdown"), u = l("text"), v = l("text"), $ = l("text");
            return _(n, s), _(n, c), e(n, "gap", 8), e(s, "label", "Priority"), e(s, "fontSize", 13), e(s, "color", "#FF1C1C1E"), _(c, u), _(c, v), _(c, $), e(c, "onChange", (z) => Et(z)), e(u, "label", "Low"), e(u, "fontSize", 13), e(v, "label", "Medium"), e(v, "fontSize", 13), e($, "label", "High"), e($, "fontSize", 13), U((z) => e(c, "activeTab", Qe(), z)), n;
          })(), (() => {
            var n = l("box"), s = l("expansionTile"), c = l("box"), u = l("text");
            return _(n, s), e(n, "background", "#FFFFFFFF"), e(n, "cornerRadius", 8), e(n, "borderWidth", 1), e(n, "borderColor", "#FFE5E5EA"), _(s, c), e(s, "title", "Details"), e(s, "onChange", (v) => pe(v)), _(c, u), e(c, "padding", 14), e(c, "background", "#FFEFEFF4"), e(u, "label", "Body content revealed by the accordion \u2014 host-owned open state, host-side expand animation."), e(u, "fontSize", 12), e(u, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = l("text");
            return e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), U((s) => e(n, "label", `size ${C()} \xB7 chips ${W().join("/") || "\u2014"} \xB7 segment ${["Day", "Week", "Month"][re()]} \xB7 priority ${["Low", "Medium", "High"][Qe()]} \xB7 details ${ie() ? "open" : "closed"}`, s)), n;
          })()];
        } }), b), N(q, D(j, { title: "Stepper \u2014 multi-step flow", get children() {
          return [(() => {
            var n = l("stepper"), s = l("step"), c = l("text"), u = l("step"), v = l("text"), $ = l("step"), z = l("text");
            return _(n, s), _(n, u), _(n, $), e(n, "onChange", (B) => et(B)), _(s, c), e(s, "title", "Account"), e(c, "label", "Create your account \u2014 name, email, password."), e(c, "fontSize", 12), e(c, "color", "#FF8E8E93"), _(u, v), e(u, "title", "Profile"), e(v, "label", "Add a photo and a short bio."), e(v, "fontSize", 12), e(v, "color", "#FF8E8E93"), _($, z), e($, "title", "Done"), e(z, "label", "All set \u2014 review and finish."), e(z, "fontSize", 12), e(z, "color", "#FF8E8E93"), U((B) => e(n, "activeTab", ar(), B)), n;
          })(), (() => {
            var n = l("text");
            return e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), U((s) => e(n, "label", `current step: ${ar() + 1} of 3`, s)), n;
          })()];
        } }), b), N(q, D(j, { title: "BottomSheet \u2014 draggable / expandable", get children() {
          var n = l("box"), s = l("stack"), c = l("box"), u = l("text"), v = l("bottomSheet"), $ = l("box"), z = l("text");
          return _(n, s), e(n, "height", 300), e(n, "cornerRadius", 12), e(n, "background", "#FFEFEFF4"), _(s, c), _(s, v), _(c, u), e(c, "width", "fill"), e(c, "height", "fill"), e(c, "padding", 16), e(u, "label", "A DraggableScrollableSheet \u2014 drag the sheet up, or scroll its list past the edge to expand it."), e(u, "fontSize", 12), e(u, "color", "#FF8E8E93"), _(v, $), e(v, "initialSize", 0.4), e(v, "minSize", 0.18), e(v, "maxSize", 0.95), e(v, "background", "#FFFFFFFF"), _($, z), e($, "padding", 16), e(z, "label", "Sheet content \u2014 drag or scroll"), e(z, "fontSize", 15), e(z, "fontWeight", 700), e(z, "color", "#FF1C1C1E"), N(v, D(le, { each: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta"], children: (B) => (() => {
            var H = l("box"), Y = l("text");
            return _(H, Y), e(H, "padding", 14), e(Y, "label", B), e(Y, "fontSize", 14), e(Y, "color", "#FF1C1C1E"), H;
          })() }), null), n;
        } }), b), N(q, D(j, { title: "Effects \u2014 BackdropFilter \xB7 InteractiveViewer", get children() {
          return [(() => {
            var n = l("stack"), s = l("image"), c = l("box"), u = l("backdropFilter"), v = l("box");
            return _(n, s), _(n, c), e(s, "src", "https://picsum.photos/seed/skalblur/300/160"), e(s, "width", 300), e(s, "height", 160), e(s, "contentScale", 1), e(s, "cornerRadius", 10), _(c, u), e(c, "top", 0), e(c, "left", 150), e(c, "width", 150), e(c, "height", 160), _(u, v), e(u, "blurRadius", 12), e(v, "width", 150), e(v, "height", 160), e(v, "background", "#33FFFFFF"), n;
          })(), (() => {
            var n = l("text");
            return e(n, "label", "The right half is frosted by a BackdropFilter."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = l("box"), s = l("interactiveViewer"), c = l("image");
            return _(n, s), e(n, "height", 200), e(n, "cornerRadius", 12), e(n, "background", "#FFEFEFF4"), _(s, c), e(s, "minScale", 1), e(s, "maxScale", 4), e(c, "src", "https://picsum.photos/seed/skalzoom/320/200"), e(c, "width", 320), e(c, "height", 200), e(c, "contentScale", 1), n;
          })(), (() => {
            var n = l("text");
            return e(n, "label", "Pinch / scroll-wheel to zoom the image, drag to pan."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })()];
        } }), b), N(q, D(j, { title: "Hover \u2014 onHover \xB7 semanticLabel", get children() {
          return [(() => {
            var n = l("box"), s = l("text");
            return _(n, s), e(n, "padding", 16), e(n, "cornerRadius", 10), e(n, "borderWidth", 1), e(n, "borderColor", "#FFE5E5EA"), e(n, "onHover", (c) => qr(c)), e(n, "semanticLabel", "A hoverable demo card"), e(s, "fontSize", 14), U((c) => {
              var u = Dt() ? ke : ll, v = Dt() ? "Hovering \u2014 pointer is over the card" : "Move the pointer over this card", $ = Dt() ? "#FFFFFF" : qn;
              return u !== c.e && (c.e = e(n, "background", u, c.e)), v !== c.t && (c.t = e(s, "label", v, c.t)), $ !== c.a && (c.a = e(s, "color", $, c.a)), c;
            }, { e: undefined, t: undefined, a: undefined }), n;
          })(), (() => {
            var n = l("text");
            return e(n, "label", "onHover fires on pointer enter/exit (desktop/web). semanticLabel wraps the card in a Semantics node for screen readers."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })()];
        } }), b), N(q, D(j, { title: "Keyboard \u2014 onKey", get children() {
          return [(() => {
            var n = l("box"), s = l("text");
            return _(n, s), e(n, "padding", 16), e(n, "cornerRadius", 10), e(n, "background", "#FFFFFFFF"), e(n, "borderWidth", 1), e(n, "borderColor", "#FFE5E5EA"), e(n, "onKey", (c) => xe(c)), e(s, "fontSize", 14), e(s, "color", "#FF1C1C1E"), U((c) => e(s, "label", `last key: ${$e()}`, c)), n;
          })(), (() => {
            var n = l("text");
            return e(n, "label", "Click the card to focus it, then press keys (\u2318S, Escape, arrows). onKey reports a normalized combo string; build any shortcut layer on it."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })()];
        } }), b), N(q, D(j, { title: "Gestures \u2014 onTap \xB7 onLongPress \xB7 onDoubleTap", get children() {
          return [(() => {
            var n = l("box"), s = l("text");
            return _(n, s), e(n, "background", "#FFEFEFF4"), e(n, "cornerRadius", 12), e(n, "padding", 22), e(n, "onTap", () => w("onTap")), e(n, "onLongPress", () => w("onLongPress")), e(n, "onDoubleTap", () => w("onDoubleTap")), e(s, "label", "Tap / long-press / double-tap this box"), e(s, "fontSize", 13), e(s, "color", "#FF1C1C1E"), n;
          })(), (() => {
            var n = l("text");
            return e(n, "fontSize", 12), e(n, "color", "#FF8E8E93"), U((s) => e(n, "label", `last gesture: ${O()}`, s)), n;
          })()];
        } }), b), N(q, D(j, { title: "Drag \u2014 draggable (zero per-frame bridge traffic)", get children() {
          return [(() => {
            var n = l("box"), s = l("box"), c = l("text");
            return _(n, s), e(n, "height", 150), e(n, "background", "#FFEFEFF4"), e(n, "cornerRadius", 12), _(s, c), e(s, "draggable", true), e(s, "width", 64), e(s, "height", 64), e(s, "background", "#FF0A84FF"), e(s, "cornerRadius", 14), e(s, "onPanEnd", (u, v) => Nt(`${u.toFixed(0)}, ${v.toFixed(0)}`)), e(c, "label", "drag"), e(c, "fontSize", 12), e(c, "color", "#FFFFFFFF"), n;
          })(), (() => {
            var n = l("text");
            return e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), U((s) => e(n, "label", `Drag the blue box \u2014 the host moves it itself, no event per frame. Resting offset: ${zt()}`, s)), n;
          })()];
        } }), b), N(q, D(j, { title: "Pan \u2014 onPanUpdate delta stream", get children() {
          return [(() => {
            var n = l("box"), s = l("text");
            return _(n, s), e(n, "height", 70), e(n, "background", "#FFEFEFF4"), e(n, "cornerRadius", 12), e(n, "padding", 16), e(n, "onPanStart", () => Lt("drag started")), e(n, "onPanUpdate", (c, u) => Lt(`dx ${c.toFixed(1)}  dy ${u.toFixed(1)}`)), e(n, "onPanEnd", (c, u) => Lt(`fling v ${c.toFixed(0)}, ${u.toFixed(0)} dp/s`)), e(s, "label", "Drag anywhere on this strip"), e(s, "fontSize", 13), e(s, "color", "#FF1C1C1E"), n;
          })(), (() => {
            var n = l("text");
            return e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), U((s) => e(n, "label", `onPanUpdate: ${Kr()}`, s)), n;
          })()];
        } }), b), N(q, D(j, { title: "Scale \u2014 onScaleUpdate (pinch / rotate)", get children() {
          return [(() => {
            var n = l("box"), s = l("box"), c = l("text");
            return _(n, s), e(n, "height", 170), e(n, "background", "#FFEFEFF4"), e(n, "cornerRadius", 12), _(s, c), e(s, "width", 96), e(s, "height", 96), e(s, "background", "#FF5E5CE6"), e(s, "cornerRadius", 16), e(s, "onScaleStart", () => {
              ur = tt();
            }), e(s, "onScaleUpdate", (u) => cr(Math.max(0.3, ur * u))), e(c, "label", "pinch"), e(c, "fontSize", 13), e(c, "color", "#FFFFFFFF"), U((u) => {
              var v = tt(), $ = tt();
              return v !== u.e && (u.e = e(s, "scaleX", v, u.e)), $ !== u.t && (u.t = e(s, "scaleY", $, u.t)), u;
            }, { e: undefined, t: undefined }), n;
          })(), (() => {
            var n = l("text");
            return e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), U((s) => e(n, "label", `Pinch the purple box (two pointers / trackpad). Scale \xD7${tt().toFixed(2)}`, s)), n;
          })()];
        } }), b), N(q, D(j, { title: "Dialogs \u2014 imperative JS API", get children() {
          return [(() => {
            var n = l("row"), s = l("button"), c = l("button");
            return _(n, s), _(n, c), e(n, "gap", 8), e(s, "label", "Alert"), e(s, "onClick", async () => {
              await xn({ title: "Heads up", message: "A plain alert dialog.", actions: [{ label: "OK", value: "ok" }] }), rt("alert: dismissed");
            }), e(c, "label", "Confirm"), e(c, "onClick", async () => {
              rt(`confirm \u2192 ${await xn({ title: "Delete file?", message: "This cannot be undone.", actions: [{ label: "Cancel", value: "cancel" }, { label: "Delete", value: "delete", style: "destructive" }] }) ?? "dismissed"}`);
            }), n;
          })(), (() => {
            var n = l("row"), s = l("button"), c = l("button");
            return _(n, s), _(n, c), e(n, "gap", 8), e(s, "label", "Action sheet"), e(s, "onClick", async () => {
              rt(`sheet \u2192 ${await lo({ title: "Choose an action", actions: [{ label: "Copy", value: "copy" }, { label: "Share", value: "share" }, { label: "Delete", value: "delete", style: "destructive" }] }) ?? "cancelled"}`);
            }), e(c, "label", "Snackbar"), e(c, "onClick", () => {
              Pn("Hello from a snackbar \uD83D\uDC4B"), rt("snackbar: shown");
            }), n;
          })(), (() => {
            var n = l("text");
            return e(n, "fontSize", 12), e(n, "color", "#FF8E8E93"), U((s) => e(n, "label", Xr(), s)), n;
          })()];
        } }), b), N(q, D(j, { title: "Pickers \u2014 date \xB7 time", get children() {
          return [(() => {
            var n = l("row"), s = l("button"), c = l("button");
            return _(n, s), _(n, c), e(n, "gap", 8), e(s, "label", "Pick a date"), e(s, "onClick", async () => {
              fr(`date \u2192 ${await so({ initialDate: "2026-05-17" }) ?? "dismissed"}`);
            }), e(c, "label", "Pick a time"), e(c, "onClick", async () => {
              fr(`time \u2192 ${await ao({ initialHour: 9, initialMinute: 30 }) ?? "dismissed"}`);
            }), n;
          })(), (() => {
            var n = l("text");
            return e(n, "fontSize", 12), e(n, "color", "#FF8E8E93"), U((s) => e(n, "label", Ce(), s)), n;
          })()];
        } }), b), N(q, D(j, { title: "Navigation \u2014 push / pop with keep-alive", get children() {
          return [(() => {
            var n = l("text");
            return e(n, "label", "Tap a mailbox to push a screen; the AppBar back button (or system back) pops. Native transition; the screen behind stays mounted."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = l("box");
            return e(n, "height", 320), e(n, "borderWidth", 1), e(n, "borderColor", "#FFE5E5EA"), N(n, D(nt.View, {})), n;
          })()];
        } }), b), N(q, D(j, { title: "Tabs \u2014 bottom bar with keep-alive", get children() {
          return [(() => {
            var n = l("text");
            return e(n, "label", "Every tab subtree is built once and kept alive (IndexedStack) \u2014 switching never re-mounts; scroll & state survive."), e(n, "fontSize", 11), e(n, "color", "#FF8E8E93"), n;
          })(), (() => {
            var n = l("box"), s = l("tabs"), c = l("tab"), u = l("column"), v = l("text"), $ = l("text"), z = l("tab"), B = l("column"), H = l("text"), Y = l("textInput"), te = l("tab"), Z = l("column"), X = l("text"), oe = l("text");
            return _(n, s), e(n, "height", 280), e(n, "borderWidth", 1), e(n, "borderColor", "#FFE5E5EA"), e(n, "cornerRadius", 8), _(s, c), _(s, z), _(s, te), e(s, "onChange", Jr), e(s, "height", "fill"), _(c, u), e(c, "title", "Home"), e(c, "icon", "home"), _(u, v), _(u, $), e(u, "background", "#FFF2F2F7"), e(u, "padding", 16), e(u, "gap", 8), e(u, "height", "fill"), e(v, "label", "Home"), e(v, "fontSize", 20), e(v, "fontWeight", 800), e(v, "color", "#FF1C1C1E"), e($, "label", "Switch tabs and come back \u2014 this tab was never torn down."), e($, "fontSize", 13), e($, "color", "#FF8E8E93"), _(z, B), e(z, "title", "Search"), e(z, "icon", "search"), _(B, H), _(B, Y), e(B, "background", "#FFF2F2F7"), e(B, "padding", 16), e(B, "gap", 8), e(B, "height", "fill"), e(H, "label", "Search"), e(H, "fontSize", 20), e(H, "fontWeight", 800), e(H, "color", "#FF1C1C1E"), e(Y, "placeholder", "Type to search\u2026"), _(te, Z), e(te, "title", "Profile"), e(te, "icon", "person"), _(Z, X), _(Z, oe), e(Z, "background", "#FFF2F2F7"), e(Z, "padding", 16), e(Z, "gap", 8), e(Z, "height", "fill"), e(X, "label", "Profile"), e(X, "fontSize", 20), e(X, "fontWeight", 800), e(X, "color", "#FF1C1C1E"), e(oe, "fontSize", 13), e(oe, "color", "#FF8E8E93"), U((K) => {
              var Ee = Mt(), Ue = `active tab index: ${Mt()}`;
              return Ee !== K.e && (K.e = e(s, "activeTab", Ee, K.e)), Ue !== K.t && (K.t = e(oe, "label", Ue, K.t)), K;
            }, { e: undefined, t: undefined }), n;
          })()];
        } }), b), N(q, D(j, { title: "SafeArea", get children() {
          var n = l("safeArea"), s = l("box"), c = l("text");
          return _(n, s), _(s, c), e(s, "background", "#FFEFEFF4"), e(s, "cornerRadius", 8), e(s, "padding", 14), e(c, "label", "Insets past notches & system bars. (No visible effect here \u2014 the app root already applies one.)"), e(c, "fontSize", 12), e(c, "color", "#FF1C1C1E"), n;
        } }), b), e(b, "label", "\u2014 end of UI demo \u2014"), e(b, "fontSize", 12), e(b, "color", "#FF8E8E93"), q;
      })();
    }
    return D(dr.View, {});
  }
  var Xn = ["Just shipped a new feature, feeling great about how it turned out \uD83D\uDE80", "Hot take: the best APIs are the ones you don't have to read docs for", "Spent the morning refactoring legacy code \u2014 so much cleaner now", "There's no such thing as 'just a small change' in production code", "If your tests are slow, that's a smell. Fast tests = good tests", "Bun's startup time keeps surprising me, even after a year", "Why is naming things still the hardest part of programming?", "Found a 10\xD7 speedup in a critical path today. Profilers, not guesses", "Reading 'The Art of Unix Programming' for the third time", "Premature abstraction is somehow worse than premature optimization", "Latency is a feature, throughput is an artifact of how you measure", "Half of debugging is admitting your assumption was wrong", "You don't ship the codebase you have. You ship the codebase you understand", "Cache invalidation, naming things, off-by-one. The classics", "Every config file format eventually grows a turing-complete templating layer"], hl = Array.from({ length: 15000 }, (t, r) => ({ author: `@user${r * 2654435761 >>> 17}`, body: Xn[r % Xn.length], num: r + 1 })), gl = [50, 200, 500, 1000, 2000, 5000, 1e4], Jn = "#FFF1F5F9", Yn = "#FF475569", _l = "#FF22C55E", bl = "#FFEF4444", Zn = "#FFFFFFFF";
  function pl(t) {
    const [r, i] = G(0), [o, a] = G(false), [f, h] = G(0), [p, g] = G(false);
    return (() => {
      var F = l("column"), R = l("text"), P = l("text"), O = l("row"), w = l("button"), x = l("button");
      return _(F, R), _(F, P), _(F, O), e(F, "background", "#FFFFFFFF"), e(F, "padding", 12), e(F, "cornerRadius", 10), e(F, "borderWidth", 1), e(F, "borderColor", "#FFE5E5EA"), e(F, "gap", 6), e(R, "fontWeight", 700), e(R, "fontSize", 14), e(R, "color", "#FF1DA1F2"), e(P, "fontSize", 14), e(P, "color", "#FF1F2937"), e(P, "maxLines", 3), e(P, "textOverflow", 1), _(O, w), _(O, x), e(O, "gap", 10), e(w, "fontSize", 12), e(w, "padding", 6), e(w, "cornerRadius", 16), e(w, "onClick", () => {
        const E = !o();
        a(E), i(r() + (E ? 1 : -1));
      }), e(x, "fontSize", 12), e(x, "padding", 6), e(x, "cornerRadius", 16), e(x, "onClick", () => {
        const E = !p();
        g(E), h(f() + (E ? 1 : -1));
      }), U((E) => {
        var k = `#${t.num} \xB7 ${t.author}`, V = t.body, T = `\u2665 ${r()}`, A = o() ? _l : Jn, d = o() ? Zn : Yn, S = `\u21A9 ${f()}`, y = p() ? bl : Jn, C = p() ? Zn : Yn;
        return k !== E.e && (E.e = e(R, "label", k, E.e)), V !== E.t && (E.t = e(P, "label", V, E.t)), T !== E.a && (E.a = e(w, "label", T, E.a)), A !== E.o && (E.o = e(w, "background", A, E.o)), d !== E.i && (E.i = e(w, "color", d, E.i)), S !== E.n && (E.n = e(x, "label", S, E.n)), y !== E.s && (E.s = e(x, "background", y, E.s)), C !== E.h && (E.h = e(x, "color", C, E.h)), E;
      }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined, n: undefined, s: undefined, h: undefined }), F;
    })();
  }
  function Fl() {
    const [t, r] = G(50), [i, o] = G(""), a = Gt(() => hl.slice(0, t()));
    return (() => {
      var f = l("listView"), h = l("text"), p = l("text"), g = l("wrap"), F = l("text");
      return _(f, h), _(f, p), _(f, g), _(f, F), e(f, "background", "#FFF2F2F7"), e(f, "padding", 16), e(f, "gap", 12), e(h, "label", "Tweet feed \u2014 virtualized"), e(h, "fontSize", 24), e(h, "fontWeight", 800), e(h, "color", "#FF1C1C1E"), e(p, "label", "ListView.builder materializes only the visible window; the source pool is 15 000 items. Tap a count to mount N."), e(p, "fontSize", 13), e(p, "color", "#FF8E8E93"), e(g, "gap", 6), N(g, D(le, { each: gl, children: (R) => (() => {
        var P = l("button");
        return e(P, "label", `${R}`), e(P, "onClick", () => {
          const O = performance.now();
          try {
            r(R), o(`mounted ${R} in ${(performance.now() - O).toFixed(2)} ms`);
          } catch (w) {
            o(`ERROR @ ${R}: ${w && (w.message || String(w)) || "unknown"}`);
          }
        }), P;
      })() })), e(F, "fontSize", 12), e(F, "color", "#FF8E8E93"), N(f, D(le, { get each() {
        return a();
      }, children: (R) => D(pl, { get author() {
        return R.author;
      }, get body() {
        return R.body;
      }, get num() {
        return R.num;
      } }) }), null), U((R) => e(F, "label", i() || `showing ${t()} tweets`, R)), f;
    })();
  }
  function vl() {
    const [t, r] = G("\u2014 waiting for counter events \u2014"), i = zo(), [o, a] = G("\u2014 tap a button to RPC the Ticker \u2014"), [f, h] = G(null), [p, g] = G(false);
    return (() => {
      var F = l("scrollView"), R = l("text"), P = l("text"), O = l("text");
      return _(F, R), _(F, P), _(F, O), e(F, "background", "#FFF2F2F7"), e(F, "padding", 16), e(F, "gap", 14), e(R, "label", "Libraries \u2014 codegen-wrapped widgets"), e(R, "fontSize", 24), e(R, "fontWeight", 800), e(R, "color", "#FF1C1C1E"), e(P, "label", "Custom adapters + real pub.dev packages, brought into JSX by skal_codegen. Imported from 'skal-flutter'."), e(P, "fontSize", 13), e(P, "color", "#FF8E8E93"), N(F, D(j, { title: "Greeting \u2014 hand-written adapter", get children() {
        var w = l("greeting");
        return e(w, "name", "Skal"), e(w, "color", "#FF1DA1F2"), e(w, "fontSize", 20), w;
      } }), O), N(F, D(j, { title: "Shimmer \u2014 pub.dev, named-ctor wrap", get children() {
        return [(() => {
          var w = l("text");
          return e(w, "label", "ShimmerFromColors \u2014 codegen-synthesized from the Shimmer.fromColors named constructor."), e(w, "fontSize", 11), e(w, "color", "#FF8E8E93"), w;
        })(), (() => {
          var w = l("shimmerFromColors"), x = l("greeting");
          return _(w, x), e(w, "baseColor", 4290624957), e(w, "highlightColor", 4292927712), e(w, "period", 1500), e(x, "name", "loading\u2026"), e(x, "color", "#FF333333"), e(x, "fontSize", 28), w;
        })()];
      } }), O), N(F, D(j, { title: "QR code \u2014 qr_flutter, pub.dev wrap", get children() {
        return [(() => {
          var w = l("qrImageView");
          return e(w, "data", "https://skal.dev"), e(w, "size", 200), w;
        })(), (() => {
          var w = l("text");
          return e(w, "label", "QrImageView, generated against qr_flutter's class."), e(w, "fontSize", 11), e(w, "color", "#FF8E8E93"), w;
        })()];
      } }), O), N(F, D(j, { title: "Camera \u2014 host-pattern wrap (controller lifecycle)", get children() {
        return [(() => {
          var w = l("text");
          return e(w, "label", "A synthesized _CameraHost owns the CameraController (init in initState, dispose on unmount). The controller initializes only once Start mounts <Camera> \u2014 no camera / permission \u2192 an inline error banner."), e(w, "fontSize", 11), e(w, "color", "#FF8E8E93"), w;
        })(), (() => {
          var w = l("button");
          return e(w, "onClick", () => g(!p())), U((x) => e(w, "label", p() ? "Stop camera" : "Start camera", x)), w;
        })(), Lr(() => Lr(() => !!p())() && (() => {
          var w = l("box"), x = l("camera");
          return _(w, x), e(w, "background", "#FF000000"), e(w, "padding", 4), e(w, "cornerRadius", 8), e(x, "resolutionIndex", 1), w;
        })())];
      } }), O), N(F, D(j, { title: "Counter \u2014 typed callbacks back to JSX", get children() {
        return [(() => {
          var w = l("counter");
          return e(w, "initial", 0), e(w, "onChanged", (x) => r(`onChanged(${x})`)), e(w, "onReset", () => r("onReset()")), w;
        })(), (() => {
          var w = l("text");
          return e(w, "fontSize", 13), e(w, "color", "#FF1C1C1E"), U((x) => e(w, "label", t(), x)), w;
        })()];
      } }), O), N(F, D(j, { title: "Ticker \u2014 JS \u2192 Dart imperative RPC", get children() {
        return [(() => {
          var w = l("ticker");
          return Io(i, w), e(w, "intervalMs", 500), w;
        })(), (() => {
          var w = l("wrap"), x = l("button"), E = l("button"), k = l("button"), V = l("button"), T = l("button"), A = l("button"), d = l("button"), S = l("button");
          return _(w, x), _(w, E), _(w, k), _(w, V), _(w, T), _(w, A), _(w, d), _(w, S), e(w, "gap", 6), e(x, "label", "pause"), e(x, "onClick", async () => {
            await i.pause(), a("pause() \u2713");
          }), e(E, "label", "resume"), e(E, "onClick", async () => {
            await i.resume(), a("resume() \u2713");
          }), e(k, "label", "reset"), e(k, "onClick", async () => {
            await i.reset(), a("reset() \u2713");
          }), e(V, "label", "+10"), e(V, "onClick", async () => {
            await i.bump(10), a(`bump(10), now getValue() \u2192 ${await i.getValue()}`);
          }), e(T, "label", "read"), e(T, "onClick", async () => {
            a(`getValue() \u2192 ${await i.getValue()}, isPaused() \u2192 ${await i.isPaused()}`);
          }), e(A, "label", "describe"), e(A, "onClick", async () => {
            a(`describe() \u2192 ${await i.describe("hello from JSX")}`);
          }), e(d, "label", "snapshot"), e(d, "onClick", async () => {
            const y = await i.snapshot();
            a(`snapshot() \u2192 value=${y.value} paused=${y.paused} ts=${y.timestamp}`);
          }), e(S, "label", "sub/unsub"), e(S, "onClick", () => {
            if (f())
              f()(), h(() => null), a("unsubscribed from ticks$");
            else {
              const y = i.ticks$((C) => {
                a(`stream tick: ${C}`);
              });
              h(() => y), a("subscribed to ticks$ \u2014 wait for emissions\u2026");
            }
          }), w;
        })(), (() => {
          var w = l("text");
          return e(w, "fontSize", 13), e(w, "color", "#FF1C1C1E"), U((x) => e(w, "label", o(), x)), w;
        })()];
      } }), O), N(F, D(j, { title: "Stickers \u2014 List<Widget> children + gradient prop", get children() {
        var w = l("stickers"), x = l("greeting"), E = l("greeting"), k = l("greeting");
        return _(w, x), _(w, E), _(w, k), e(w, "gap", 6), e(w, "padding", 10), e(w, "gradient", { type: "linear", colors: ["#FFFFE082", "#FFB0F0D0", "#FFB0E0FF"], stops: [0, 0.5, 1], begin: "topLeft", end: "bottomRight" }), e(x, "name", "multi-child A"), e(x, "color", "#FF6B4F00"), e(x, "fontSize", 14), e(E, "name", "multi-child B"), e(E, "color", "#FF6B4F00"), e(E, "fontSize", 14), e(k, "name", "multi-child C"), e(k, "color", "#FF6B4F00"), e(k, "fontSize", 14), w;
      } }), O), e(O, "label", "\u2014 end of Libs demo \u2014"), e(O, "fontSize", 12), e(O, "color", "#FF8E8E93"), F;
    })();
  }
  var Qn = (t) => Array.from(t, (r) => r.toString(16).padStart(2, "0")).join(""), El = new Function("m", "return import(m);"), We = (t) => El(t), me = (t, r) => t && t[r] || t && t.default && t.default[r] || undefined, ei = [{ title: "Web Crypto \u2014 crypto.subtle (global, native)", probes: [{ label: "crypto.randomUUID()", run: () => crypto.randomUUID() }, { label: "crypto.getRandomValues \u2014 16 bytes", run: () => {
    const t = new Uint8Array(16);
    return crypto.getRandomValues(t), Qn(t);
  } }, { label: "crypto.subtle.digest \u2014 SHA-256 of 64 KB", run: async () => {
    const t = new Uint8Array(65536);
    crypto.getRandomValues(t);
    const r = await crypto.subtle.digest("SHA-256", t);
    return Qn(new Uint8Array(r)).slice(0, 32) + "\u2026";
  } }, { label: "crypto.subtle \u2014 AES-GCM encrypt + decrypt", run: async () => {
    const t = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]), r = crypto.getRandomValues(new Uint8Array(12)), i = new TextEncoder().encode("hello from skal"), o = await crypto.subtle.encrypt({ name: "AES-GCM", iv: r }, t, i), a = await crypto.subtle.decrypt({ name: "AES-GCM", iv: r }, t, o);
    return `${o.byteLength}-byte ct \u2192 "${new TextDecoder().decode(a)}"`;
  } }] }, { title: "Bun runtime \u2014 degrades gracefully if absent", probes: [{ label: "Bun.version", run: () => {
    if (typeof Bun > "u")
      throw new Error("Bun global not present");
    return `Bun ${Bun.version}` + (Bun.revision ? ` (${Bun.revision.slice(0, 7)})` : "");
  } }, { label: "Bun.nanoseconds()", run: () => {
    if (typeof Bun > "u")
      throw new Error("Bun global not present");
    return `${Bun.nanoseconds()} ns since process start`;
  } }, { label: "Bun.hash('the quick brown fox')", run: () => {
    if (typeof Bun > "u")
      throw new Error("Bun global not present");
    return String(Bun.hash("the quick brown fox"));
  } }, { label: "new Bun.CryptoHasher('sha256')", run: () => {
    if (typeof Bun > "u" || !Bun.CryptoHasher)
      throw new Error("Bun.CryptoHasher not present");
    const t = new Bun.CryptoHasher("sha256");
    return t.update("hello from skal"), t.digest("hex").slice(0, 32) + "\u2026";
  } }, { label: "bun:sqlite \u2014 in-memory query", run: async () => {
    const t = await We("bun:sqlite"), r = me(t, "Database") || t.default;
    if (typeof r != "function")
      throw new Error("bun:sqlite imported, but no Database constructor");
    const i = new r(":memory:");
    i.run("CREATE TABLE t (id INTEGER, name TEXT)"), i.run("INSERT INTO t VALUES (1, 'skal')");
    const o = i.query("SELECT name FROM t WHERE id = ?").get(1);
    return i.close(), `select \u2192 ${JSON.stringify(o)}`;
  } }] }, { title: "Node compatibility \u2014 node: builtins", probes: [{ label: "process \u2014 platform / arch / version", run: () => {
    if (typeof process > "u")
      throw new Error("process global not present");
    return `${process.platform} ${process.arch} \xB7 ${process.version || "(no version)"}`;
  } }, { label: "node:crypto \u2014 createHash('sha256')", run: async () => {
    const t = me(await We("node:crypto"), "createHash");
    if (!t)
      throw new Error("node:crypto has no createHash");
    return t("sha256").update("hello from skal").digest("hex").slice(0, 32) + "\u2026";
  } }, { label: "node:crypto \u2014 randomBytes(16)", run: async () => {
    const t = me(await We("node:crypto"), "randomBytes");
    if (!t)
      throw new Error("node:crypto has no randomBytes");
    return t(16).toString("hex");
  } }, { label: "node:os \u2014 platform / arch / cpus", run: async () => {
    const t = await We("node:os"), r = me(t, "platform"), i = me(t, "arch"), o = me(t, "cpus");
    if (!r)
      throw new Error("node:os has no platform()");
    return `${r()} ${i()} \xB7 ${o().length} cpus`;
  } }, { label: "node:path \u2014 join + normalize", run: async () => {
    const t = me(await We("node:path"), "join");
    if (!t)
      throw new Error("node:path has no join");
    return t("/a/b", "..", "c", "./d.txt");
  } }, { label: "Buffer \u2014 from / toString", run: () => {
    if (typeof Buffer > "u")
      throw new Error("Buffer global not present");
    return `hex = ${Buffer.from("skal", "utf8").toString("hex")}`;
  } }, { label: "node:fs \u2014 temp write + read", run: async () => {
    const t = await We("node:fs"), r = await We("node:os"), i = await We("node:path"), o = me(t, "writeFileSync"), a = me(t, "readFileSync"), f = me(t, "unlinkSync"), h = me(r, "tmpdir"), p = me(i, "join");
    if (!o || !a || !h || !p)
      throw new Error("node:fs / os / path missing an expected member");
    const g = p(h(), `skal-probe-${Date.now()}.txt`);
    o(g, "skal fs probe");
    const F = a(g, "utf8");
    try {
      f && f(g);
    } catch {}
    return `wrote + read back "${F}"`;
  } }] }, { title: "Standard JS & Web APIs", probes: [{ label: "JSON stringify + parse \u2014 1000-object array", run: () => {
    const t = Array.from({ length: 1000 }, (o, a) => ({ id: a, name: "item" + a, ok: a % 2 === 0 })), r = JSON.stringify(t), i = JSON.parse(r);
    return `${r.length} bytes \xB7 ${i.length} items round-tripped`;
  } }, { label: "TextEncoder / TextDecoder round-trip", run: () => {
    const t = new TextEncoder().encode("skal \uD83D\uDE80 unicode \u2713");
    return `${t.length} bytes \u2192 "${new TextDecoder().decode(t)}"`;
  } }, { label: "structuredClone \u2014 nested object", run: () => {
    if (typeof structuredClone > "u")
      throw new Error("structuredClone not present");
    const t = structuredClone({ a: 1, nested: { b: [1, 2, 3] } });
    return `cloned \u2192 nested.b = ${JSON.stringify(t.nested.b)}`;
  } }, { label: "setTimeout \u2014 20 ms timer (see duration)", run: async () => {
    if (typeof setTimeout > "u")
      throw new Error("setTimeout not present");
    return await new Promise((t) => setTimeout(t, 20)), "timer fired \u2014 measured duration \u2248 requested 20 ms";
  } }, { label: "tight compute loop \u2014 5,000,000 iterations", run: () => {
    let t = 0;
    for (let r = 0;r < 5000000; r++)
      t += r % 7;
    return `sum = ${t}`;
  } }] }], ti = 3000;
  function Sl(t) {
    let r;
    const i = new Promise((o, a) => {
      r = setTimeout(() => a(new Error(`timed out after ${ti} ms`)), ti);
    });
    return Promise.race([Promise.resolve().then(() => t.run()), i]).finally(() => clearTimeout(r));
  }
  function ml() {
    const [t, r] = G({}), [i, o] = G(false), a = () => typeof performance < "u" && performance.now ? performance.now() : Date.now();
    async function f() {
      if (!i()) {
        o(true), r({});
        for (const h of ei)
          for (const p of h.probes) {
            const g = a();
            let F, R = true;
            try {
              F = String(await Sl(p));
            } catch (O) {
              F = O && O.message ? O.message : String(O), R = false;
            }
            const P = a() - g;
            r((O) => ({ ...O, [p.label]: { ms: P, response: F, ok: R } }));
          }
        o(false);
      }
    }
    return oi(() => {
      f();
    }), (() => {
      var h = l("scrollView"), p = l("text"), g = l("text"), F = l("button");
      return _(h, p), _(h, g), _(h, F), e(h, "background", "#FFF2F2F7"), e(h, "padding", 16), e(h, "gap", 14), e(h, "scrollbar", true), e(p, "label", "JS runtime \u2014 probes & timings"), e(p, "fontSize", 24), e(p, "fontWeight", 800), e(p, "color", "#FF1C1C1E"), e(g, "label", "Each function runs in the embedded bun + JSC runtime; its duration and response are logged. Bun / bun:sqlite probes report an error (not a crash) if the runtime doesn't expose them."), e(g, "fontSize", 13), e(g, "color", "#FF8E8E93"), e(F, "onClick", f), N(h, D(le, { each: ei, children: (R) => D(j, { get title() {
        return R.title;
      }, get children() {
        return D(le, { get each() {
          return R.probes;
        }, children: (P) => {
          const O = () => t()[P.label], w = () => {
            const x = O();
            return x ? x.response.length > 110 ? x.response.slice(0, 110) + "\u2026" : x.response : "not run yet";
          };
          return (() => {
            var x = l("column"), E = l("text"), k = l("text"), V = l("text");
            return _(x, E), _(x, k), _(x, V), e(x, "gap", 2), e(E, "fontSize", 13), e(E, "fontWeight", 700), e(E, "color", "#FF1C1C1E"), e(k, "fontSize", 11), e(k, "fontWeight", 700), e(k, "color", "#FF0A84FF"), e(V, "fontSize", 12), e(V, "maxLines", 3), U((T) => {
              var A = P.label, d = O() ? `${O().ms.toFixed(3)} ms` : "\u2014", S = w(), y = O() ? O().ok ? Kn : It : Kn;
              return A !== T.e && (T.e = e(E, "label", A, T.e)), d !== T.t && (T.t = e(k, "label", d, T.t)), S !== T.a && (T.a = e(V, "label", S, T.a)), y !== T.o && (T.o = e(V, "color", y, T.o)), T;
            }, { e: undefined, t: undefined, a: undefined, o: undefined }), x;
          })();
        } });
      } }) }), null), U((R) => e(F, "label", i() ? "Running\u2026" : "Re-run all probes", R)), h;
    })();
  }
  var se = ol({ counter: 0, note: "", scratch: "", settings: { theme: "dark" }, todos: [], archive: [] }, { version: 1, paths: { scratch: { persist: false }, archive: { lazy: true } } });
  function wl() {
    const t = se[Gr], r = () => t.backendKind() === "native" || t.backendKind() === "mmap" || t.backendKind() === "fs", i = () => {
      const a = t.engineStats();
      return `${a ? `${a.records} records \xB7 ${a.segments} segments` : "engine: \u2026"} \xB7 ${t.pending()} pending \xB7 ${t.flushes()} flushes`;
    }, o = () => {
      const a = t.initTiming();
      return a ? `init total ${a.total}ms \u2014 dir-RPC ${a.dir} \xB7 open ${a.open} \xB7 migrate ${a.migrate} \xB7 hydrate ${a.hydrate} (${a.records} records)` : "init: running\u2026";
    };
    return (() => {
      var a = l("scrollView"), f = l("text"), h = l("text"), p = l("text");
      return _(a, f), _(a, h), _(a, p), e(a, "background", "#FFF2F2F7"), e(a, "padding", 16), e(a, "gap", 14), e(a, "scrollbar", true), e(f, "label", "createSkalStore \u2014 reactive \xB7 persistent \xB7 deep-object"), e(f, "fontSize", 23), e(f, "fontWeight", 800), e(f, "color", "#FF1C1C1E"), e(h, "fontSize", 14), e(h, "fontWeight", 800), e(p, "fontSize", 12), e(p, "color", "#FF8E8E93"), N(a, D(j, { title: "Values \u2014 mutate the object directly", get children() {
        return [(() => {
          var g = l("row"), F = l("button"), R = l("text");
          return _(g, F), _(g, R), e(g, "gap", 10), e(F, "label", "counter + 1"), e(F, "onClick", () => {
            se.counter = se.counter + 1;
          }), e(R, "fontSize", 16), e(R, "fontWeight", 800), e(R, "color", "#FF0A84FF"), U((P) => e(R, "label", `db.counter = ${se.counter}`, P)), g;
        })(), (() => {
          var g = l("row"), F = l("button"), R = l("text");
          return _(g, F), _(g, R), e(g, "gap", 10), e(F, "label", "toggle theme"), e(F, "onClick", () => {
            se.settings.theme = se.settings.theme === "dark" ? "light" : "dark";
          }), e(R, "fontSize", 14), e(R, "fontWeight", 700), e(R, "color", "#FF1C1C1E"), U((P) => e(R, "label", `db.settings.theme = ${se.settings.theme}`, P)), g;
        })(), (() => {
          var g = l("text");
          return e(g, "label", "note \u2014 persisted; each change writes one tiny per-leaf frame"), e(g, "fontSize", 11), e(g, "color", "#FF8E8E93"), g;
        })(), (() => {
          var g = l("textInput");
          return e(g, "placeholder", "persisted text\u2026"), e(g, "onChange", (F) => {
            se.note = F;
          }), U((F) => e(g, "value", se.note, F)), g;
        })(), (() => {
          var g = l("text");
          return e(g, "label", "scratch \u2014 config persist:false, so memory only (gone on restart)"), e(g, "fontSize", 11), e(g, "color", "#FF8E8E93"), g;
        })(), (() => {
          var g = l("textInput");
          return e(g, "placeholder", "memory-only text\u2026"), e(g, "onChange", (F) => {
            se.scratch = F;
          }), U((F) => e(g, "value", se.scratch, F)), g;
        })()];
      } }), null), N(a, D(j, { title: "Collection \u2014 todos (array of objects)", get children() {
        return [(() => {
          var g = l("row"), F = l("button"), R = l("button"), P = l("button"), O = l("button");
          return _(g, F), _(g, R), _(g, P), _(g, O), e(g, "gap", 8), e(F, "label", "Add"), e(F, "onClick", () => se.todos.push({ text: "todo " + Date.now() })), e(R, "label", "Add 100"), e(R, "onClick", () => tn(() => {
            for (let w = 0;w < 100; w++)
              se.todos.push({ text: "bulk " + Date.now() + " #" + w });
          })), e(P, "label", "Remove first"), e(P, "onClick", () => {
            se.todos.length && se.todos.shift();
          }), e(O, "label", "Clear"), e(O, "onClick", () => {
            se.todos.splice(0, se.todos.length);
          }), g;
        })(), (() => {
          var g = l("text");
          return e(g, "fontSize", 12), e(g, "fontWeight", 700), e(g, "color", "#FF0A84FF"), U((F) => e(g, "label", `${se.todos.length} todos \u2014 add/remove writes one element frame + the index, never the whole list`, F)), g;
        })(), (() => {
          var g = l("box"), F = l("listView");
          return _(g, F), e(g, "height", 220), e(g, "cornerRadius", 10), e(g, "background", "#FFEFEFF4"), e(F, "scrollbar", true), N(F, D(le, { get each() {
            return se.todos;
          }, children: (R) => (() => {
            var P = l("box"), O = l("text");
            return _(P, O), e(P, "padding", 8), e(P, "background", "#FFFFFFFF"), e(P, "cornerRadius", 6), e(P, "borderWidth", 1), e(P, "borderColor", "#FFE5E5EA"), e(O, "fontSize", 12), e(O, "color", "#FF1C1C1E"), U((w) => e(O, "label", R.text, w)), P;
          })() })), g;
        })()];
      } }), null), N(a, D(j, { title: "Lazy \u2014 archive (config lazy:true)", get children() {
        return [(() => {
          var g = l("row"), F = l("button");
          return _(g, F), e(g, "gap", 8), e(F, "label", "Add to archive"), e(F, "onClick", () => se.archive.push({ text: "archived " + Date.now() })), g;
        })(), (() => {
          var g = l("text");
          return e(g, "fontSize", 12), e(g, "color", "#FF8E8E93"), U((F) => e(g, "label", `${se.archive.length} records \u2014 not loaded at open; faults in from disk on first access`, F)), g;
        })()];
      } }), null), N(a, D(j, { title: "Engine", get children() {
        return [(() => {
          var g = l("text");
          return e(g, "fontSize", 11), e(g, "color", "#FF8E8E93"), e(g, "maxLines", 2), U((F) => e(g, "label", i(), F)), g;
        })(), (() => {
          var g = l("text");
          return e(g, "fontSize", 11), e(g, "color", "#FF8E8E93"), e(g, "maxLines", 2), U((F) => e(g, "label", o(), F)), g;
        })(), (() => {
          var g = l("button");
          return e(g, "label", "Flush now"), e(g, "onClick", () => t.flushNow()), g;
        })(), (() => {
          var g = l("text");
          return e(g, "label", "Writes are debounced + batched into one engine flush; reads are pure in-memory."), e(g, "fontSize", 11), e(g, "color", "#FF8E8E93"), g;
        })()];
      } }), null), U((g) => {
        var F = `Backend: ${t.backendKind()} \xB7 schema v${t.version()}`, R = r() ? Me : Ze, P = r() ? "Persisted \u2014 change values, quit, and re-run to verify they survive a restart." : "In-memory fallback \u2014 no writable backend, so data resets on restart.";
        return F !== g.e && (g.e = e(h, "label", F, g.e)), R !== g.t && (g.t = e(h, "color", R, g.t)), P !== g.a && (g.a = e(p, "label", P, g.a)), g;
      }, { e: undefined, t: undefined, a: undefined }), a;
    })();
  }
  function yl() {
    const [t, r] = G(0);
    return (() => {
      var i = l("tabs"), o = l("tab"), a = l("tab"), f = l("tab"), h = l("tab"), p = l("tab");
      return _(i, o), _(i, a), _(i, f), _(i, h), _(i, p), e(i, "onChange", r), e(i, "height", "fill"), e(o, "title", "UI"), e(o, "icon", "grid"), N(o, D(dl, {})), e(a, "title", "List"), e(a, "icon", "list"), N(a, D(Fl, {})), e(f, "title", "Libs"), e(f, "icon", "explore"), N(f, D(vl, {})), e(h, "title", "JS"), e(h, "icon", "code"), N(h, D(ml, {})), e(p, "title", "Store"), e(p, "icon", "storage"), N(p, D(wl, {})), U((g) => e(i, "activeTab", t(), g)), i;
    })();
  }
  ko(() => D(yl, {}), Do);
})();
})
