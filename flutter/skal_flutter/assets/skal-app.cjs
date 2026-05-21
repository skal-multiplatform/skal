// @bun @bytecode @bun-cjs
(function(exports, require, module, __filename, __dirname) {// ../flutter/skal_flutter/assets/skal-app.js
(function() {
  var ue = { context: undefined, registry: undefined, effects: undefined, done: false, getContextId() {
    return Xr(this.context.count);
  }, getNextContextId() {
    return Xr(this.context.count++);
  } };
  function Xr(t) {
    const r = String(t), n = r.length - 1;
    return ue.context.id + (n ? String.fromCharCode(96 + n) : "") + r;
  }
  function fr(t) {
    ue.context = t;
  }
  function ri() {
    return { ...ue.context, id: ue.getNextContextId(), count: 0 };
  }
  var ni = (t, r) => t === r, Pe = Symbol("solid-proxy"), ii = typeof Proxy == "function", dr = Symbol("solid-track"), Mt = { equals: ni }, Jr = null, Yr = ln, Se = 1, St = 2, Zr = { owned: null, cleanups: null, context: null, owner: null }, ee = null, M = null, mt = null, rt = null, ne = null, se = null, de = null, Wt = 0;
  function Ut(t, r) {
    const n = ne, o = ee, a = t.length === 0, u = r === undefined ? o : r, d = a ? Zr : { owned: null, cleanups: null, context: u ? u.context : null, owner: u }, b = a ? t : () => t(() => De(() => ze(d)));
    ee = d, ne = null;
    try {
      return Te(b, true);
    } finally {
      ne = n, ee = o;
    }
  }
  function X(t, r) {
    r = r ? Object.assign({}, Mt, r) : Mt;
    const n = { value: t, observers: null, observerSlots: null, comparator: r.equals || undefined }, o = (a) => (typeof a == "function" && (M && M.running && M.sources.has(n) ? a = a(n.tValue) : a = a(n.value)), nn(n, a));
    return [rn.bind(n), o];
  }
  function Ie(t, r, n) {
    const o = br(t, r, false, Se);
    mt && M && M.running ? se.push(o) : wt(o);
  }
  function hr(t, r, n) {
    Yr = ui;
    const o = br(t, r, false, Se), a = _r && ai(_r);
    a && (o.suspense = a), (!n || !n.render) && (o.user = true), de ? de.push(o) : wt(o);
  }
  function Vt(t, r, n) {
    n = n ? Object.assign({}, Mt, n) : Mt;
    const o = br(t, r, true, 0);
    return o.observers = null, o.observerSlots = null, o.comparator = n.equals || undefined, mt && M && M.running ? (o.tState = Se, se.push(o)) : wt(o), rn.bind(o);
  }
  function Qr(t) {
    return Te(t, false);
  }
  function De(t) {
    if (!rt && ne === null)
      return t();
    const r = ne;
    ne = null;
    try {
      return rt ? rt.untrack(t) : t();
    } finally {
      ne = r;
    }
  }
  function oi(t) {
    hr(() => De(t));
  }
  function en(t) {
    return ee === null || (ee.cleanups === null ? ee.cleanups = [t] : ee.cleanups.push(t)), t;
  }
  function gr() {
    return ne;
  }
  function li(t) {
    if (M && M.running)
      return t(), M.done;
    const r = ne, n = ee;
    return Promise.resolve().then(() => {
      ne = r, ee = n;
      let o;
      return (mt || _r) && (o = M || (M = { sources: new Set, effects: [], promises: new Set, disposed: new Set, queue: new Set, running: true }), o.done || (o.done = new Promise((a) => o.resolve = a)), o.running = true), Te(t, false), ne = ee = null, o ? o.done : undefined;
    });
  }
  var [xl, tn] = X(false);
  function ai(t) {
    let r;
    return ee && ee.context && (r = ee.context[t.id]) !== undefined ? r : t.defaultValue;
  }
  var _r;
  function rn() {
    const t = M && M.running;
    if (this.sources && (t ? this.tState : this.state))
      if ((t ? this.tState : this.state) === Se)
        wt(this);
      else {
        const r = se;
        se = null, Te(() => Ht(this), false), se = r;
      }
    if (ne) {
      const r = this.observers ? this.observers.length : 0;
      ne.sources ? (ne.sources.push(this), ne.sourceSlots.push(r)) : (ne.sources = [this], ne.sourceSlots = [r]), this.observers ? (this.observers.push(ne), this.observerSlots.push(ne.sources.length - 1)) : (this.observers = [ne], this.observerSlots = [ne.sources.length - 1]);
    }
    return t && M.sources.has(this) ? this.tValue : this.value;
  }
  function nn(t, r, n) {
    let o = M && M.running && M.sources.has(t) ? t.tValue : t.value;
    if (!t.comparator || !t.comparator(o, r)) {
      if (M) {
        const a = M.running;
        (a || !n && M.sources.has(t)) && (M.sources.add(t), t.tValue = r), a || (t.value = r);
      } else
        t.value = r;
      t.observers && t.observers.length && Te(() => {
        for (let a = 0;a < t.observers.length; a += 1) {
          const u = t.observers[a], d = M && M.running;
          d && M.disposed.has(u) || ((d ? !u.tState : !u.state) && (u.pure ? se.push(u) : de.push(u), u.observers && an(u)), d ? u.tState = Se : u.state = Se);
        }
        if (se.length > 1e6)
          throw se = [], new Error;
      }, false);
    }
    return r;
  }
  function wt(t) {
    if (!t.fn)
      return;
    ze(t);
    const r = Wt;
    on(t, M && M.running && M.sources.has(t) ? t.tValue : t.value, r), M && !M.running && M.sources.has(t) && queueMicrotask(() => {
      Te(() => {
        M && (M.running = true), ne = ee = t, on(t, t.tValue, r), ne = ee = null;
      }, false);
    });
  }
  function on(t, r, n) {
    let o;
    const a = ee, u = ne;
    ne = ee = t;
    try {
      o = t.fn(r);
    } catch (d) {
      return t.pure && (M && M.running ? (t.tState = Se, t.tOwned && t.tOwned.forEach(ze), t.tOwned = undefined) : (t.state = Se, t.owned && t.owned.forEach(ze), t.owned = null)), t.updatedAt = n + 1, pr(d);
    } finally {
      ne = u, ee = a;
    }
    (!t.updatedAt || t.updatedAt <= n) && (t.updatedAt != null && ("observers" in t) ? nn(t, o, true) : M && M.running && t.pure ? (M.sources.has(t) || (t.value = o), M.sources.add(t), t.tValue = o) : t.value = o, t.updatedAt = n);
  }
  function br(t, r, n, o = Se, a) {
    const u = { fn: t, state: o, updatedAt: null, owned: null, sources: null, sourceSlots: null, cleanups: null, value: r, owner: ee, context: ee ? ee.context : null, pure: n };
    if (M && M.running && (u.state = 0, u.tState = o), ee === null || ee !== Zr && (M && M.running && ee.pure ? ee.tOwned ? ee.tOwned.push(u) : ee.tOwned = [u] : ee.owned ? ee.owned.push(u) : ee.owned = [u]), rt && u.fn) {
      const d = u.fn, [b, h] = X(undefined, { equals: false }), F = rt.factory(d, h);
      en(() => F.dispose());
      let A;
      const T = () => li(h).then(() => {
        A && (A.dispose(), A = undefined);
      });
      u.fn = (D) => (b(), M && M.running ? (A || (A = rt.factory(d, T)), A.track(D)) : F.track(D));
    }
    return u;
  }
  function yt(t) {
    const r = M && M.running;
    if ((r ? t.tState : t.state) === 0)
      return;
    if ((r ? t.tState : t.state) === St)
      return Ht(t);
    if (t.suspense && De(t.suspense.inFallback))
      return t.suspense.effects.push(t);
    const n = [t];
    for (;(t = t.owner) && (!t.updatedAt || t.updatedAt < Wt); ) {
      if (r && M.disposed.has(t))
        return;
      (r ? t.tState : t.state) && n.push(t);
    }
    for (let o = n.length - 1;o >= 0; o--) {
      if (t = n[o], r) {
        let a = t, u = n[o + 1];
        for (;(a = a.owner) && a !== u; )
          if (M.disposed.has(a))
            return;
      }
      if ((r ? t.tState : t.state) === Se)
        wt(t);
      else if ((r ? t.tState : t.state) === St) {
        const a = se;
        se = null, Te(() => Ht(t, n[0]), false), se = a;
      }
    }
  }
  function Te(t, r) {
    if (se)
      return t();
    let n = false;
    r || (se = []), de ? n = true : de = [], Wt++;
    try {
      const o = t();
      return si(n), o;
    } catch (o) {
      n || (de = null), se = null, pr(o);
    }
  }
  function si(t) {
    if (se && (mt && M && M.running ? ci(se) : ln(se), se = null), t)
      return;
    let r;
    if (M) {
      if (!M.promises.size && !M.queue.size) {
        const { sources: o, disposed: a } = M;
        de.push.apply(de, M.effects), r = M.resolve;
        for (const u of de)
          "tState" in u && (u.state = u.tState), delete u.tState;
        M = null, Te(() => {
          for (const u of a)
            ze(u);
          for (const u of o) {
            if (u.value = u.tValue, u.owned)
              for (let d = 0, b = u.owned.length;d < b; d++)
                ze(u.owned[d]);
            u.tOwned && (u.owned = u.tOwned), delete u.tValue, delete u.tOwned, u.tState = 0;
          }
          tn(false);
        }, false);
      } else if (M.running) {
        M.running = false, M.effects.push.apply(M.effects, de), de = null, tn(true);
        return;
      }
    }
    const n = de;
    de = null, n.length && Te(() => Yr(n), false), r && r();
  }
  function ln(t) {
    for (let r = 0;r < t.length; r++)
      yt(t[r]);
  }
  function ci(t) {
    for (let r = 0;r < t.length; r++) {
      const n = t[r], o = M.queue;
      o.has(n) || (o.add(n), mt(() => {
        o.delete(n), Te(() => {
          M.running = true, yt(n);
        }, false), M && (M.running = false);
      }));
    }
  }
  function ui(t) {
    let r, n = 0;
    for (r = 0;r < t.length; r++) {
      const o = t[r];
      o.user ? t[n++] = o : yt(o);
    }
    if (ue.context) {
      if (ue.count) {
        ue.effects || (ue.effects = []), ue.effects.push(...t.slice(0, n));
        return;
      }
      fr();
    }
    for (ue.effects && (ue.done || !ue.count) && (t = [...ue.effects, ...t], n += ue.effects.length, delete ue.effects), r = 0;r < n; r++)
      yt(t[r]);
  }
  function Ht(t, r) {
    const n = M && M.running;
    n ? t.tState = 0 : t.state = 0;
    for (let o = 0;o < t.sources.length; o += 1) {
      const a = t.sources[o];
      if (a.sources) {
        const u = n ? a.tState : a.state;
        u === Se ? a !== r && (!a.updatedAt || a.updatedAt < Wt) && yt(a) : u === St && Ht(a, r);
      }
    }
  }
  function an(t) {
    const r = M && M.running;
    for (let n = 0;n < t.observers.length; n += 1) {
      const o = t.observers[n];
      (r ? !o.tState : !o.state) && (r ? o.tState = St : o.state = St, o.pure ? se.push(o) : de.push(o), o.observers && an(o));
    }
  }
  function ze(t) {
    let r;
    if (t.sources)
      for (;t.sources.length; ) {
        const n = t.sources.pop(), o = t.sourceSlots.pop(), a = n.observers;
        if (a && a.length) {
          const u = a.pop(), d = n.observerSlots.pop();
          o < a.length && (u.sourceSlots[d] = o, a[o] = u, n.observerSlots[o] = d);
        }
      }
    if (t.tOwned) {
      for (r = t.tOwned.length - 1;r >= 0; r--)
        ze(t.tOwned[r]);
      delete t.tOwned;
    }
    if (M && M.running && t.pure)
      sn(t, true);
    else if (t.owned) {
      for (r = t.owned.length - 1;r >= 0; r--)
        ze(t.owned[r]);
      t.owned = null;
    }
    if (t.cleanups) {
      for (r = t.cleanups.length - 1;r >= 0; r--)
        t.cleanups[r]();
      t.cleanups = null;
    }
    M && M.running ? t.tState = 0 : t.state = 0;
  }
  function sn(t, r) {
    if (r || (t.tState = 0, M.disposed.add(t)), t.owned)
      for (let n = 0;n < t.owned.length; n++)
        sn(t.owned[n]);
  }
  function fi(t) {
    return t instanceof Error ? t : new Error(typeof t == "string" ? t : "Unknown error", { cause: t });
  }
  function cn(t, r, n) {
    try {
      for (const o of r)
        o(t);
    } catch (o) {
      pr(o, n && n.owner || null);
    }
  }
  function pr(t, r = ee) {
    const n = Jr && r && r.context && r.context[Jr], o = fi(t);
    if (!n)
      throw o;
    de ? de.push({ fn() {
      cn(o, n, r);
    }, state: Se }) : cn(o, n, r);
  }
  var di = Symbol("fallback");
  function un(t) {
    for (let r = 0;r < t.length; r++)
      t[r]();
  }
  function hi(t, r, n = {}) {
    let o = [], a = [], u = [], d = 0, b = r.length > 1 ? [] : null;
    return en(() => un(u)), () => {
      let h = t() || [], F = h.length, A, T;
      return h[dr], De(() => {
        let m, x, E, z, j, P, $, f, S;
        if (F === 0)
          d !== 0 && (un(u), u = [], o = [], a = [], d = 0, b && (b = [])), n.fallback && (o = [di], a[0] = Ut((w) => (u[0] = w, n.fallback())), d = 1);
        else if (d === 0) {
          for (a = new Array(F), T = 0;T < F; T++)
            o[T] = h[T], a[T] = Ut(D);
          d = F;
        } else {
          for (E = new Array(F), z = new Array(F), b && (j = new Array(F)), P = 0, $ = Math.min(d, F);P < $ && o[P] === h[P]; P++)
            ;
          for ($ = d - 1, f = F - 1;$ >= P && f >= P && o[$] === h[f]; $--, f--)
            E[f] = a[$], z[f] = u[$], b && (j[f] = b[$]);
          for (m = new Map, x = new Array(f + 1), T = f;T >= P; T--)
            S = h[T], A = m.get(S), x[T] = A === undefined ? -1 : A, m.set(S, T);
          for (A = P;A <= $; A++)
            S = o[A], T = m.get(S), T !== undefined && T !== -1 ? (E[T] = a[A], z[T] = u[A], b && (j[T] = b[A]), T = x[T], m.set(S, T)) : u[A]();
          for (T = P;T < F; T++)
            T in E ? (a[T] = E[T], u[T] = z[T], b && (b[T] = j[T], b[T](T))) : a[T] = Ut(D);
          a = a.slice(0, d = F), o = h.slice(0);
        }
        return a;
      });
      function D(m) {
        if (u[T] = m, b) {
          const [x, E] = X(T);
          return b[T] = E, r(h[T], x);
        }
        return r(h[T]);
      }
    };
  }
  var gi = false;
  function _i(t, r) {
    if (gi && ue.context) {
      const n = ue.context;
      fr(ri());
      const o = De(() => t(r || {}));
      return fr(n), o;
    }
    return De(() => t(r || {}));
  }
  function Gt() {
    return true;
  }
  var bi = { get(t, r, n) {
    return r === Pe ? n : t.get(r);
  }, has(t, r) {
    return r === Pe ? true : t.has(r);
  }, set: Gt, deleteProperty: Gt, getOwnPropertyDescriptor(t, r) {
    return { configurable: true, enumerable: true, get() {
      return t.get(r);
    }, set: Gt, deleteProperty: Gt };
  }, ownKeys(t) {
    return t.keys();
  } };
  function Fr(t) {
    return (t = typeof t == "function" ? t() : t) ? t : {};
  }
  function pi() {
    for (let t = 0, r = this.length;t < r; ++t) {
      const n = this[t]();
      if (n !== undefined)
        return n;
    }
  }
  function fn(...t) {
    let r = false;
    for (let d = 0;d < t.length; d++) {
      const b = t[d];
      r = r || !!b && Pe in b, t[d] = typeof b == "function" ? (r = true, Vt(b)) : b;
    }
    if (ii && r)
      return new Proxy({ get(d) {
        for (let b = t.length - 1;b >= 0; b--) {
          const h = Fr(t[b])[d];
          if (h !== undefined)
            return h;
        }
      }, has(d) {
        for (let b = t.length - 1;b >= 0; b--)
          if (d in Fr(t[b]))
            return true;
        return false;
      }, keys() {
        const d = [];
        for (let b = 0;b < t.length; b++)
          d.push(...Object.keys(Fr(t[b])));
        return [...new Set(d)];
      } }, bi);
    const n = {}, o = Object.create(null);
    for (let d = t.length - 1;d >= 0; d--) {
      const b = t[d];
      if (!b)
        continue;
      const h = Object.getOwnPropertyNames(b);
      for (let F = h.length - 1;F >= 0; F--) {
        const A = h[F];
        if (A === "__proto__" || A === "constructor")
          continue;
        const T = Object.getOwnPropertyDescriptor(b, A);
        if (!o[A])
          o[A] = T.get ? { enumerable: true, configurable: true, get: pi.bind(n[A] = [T.get.bind(b)]) } : T.value !== undefined ? T : undefined;
        else {
          const D = n[A];
          D && (T.get ? D.push(T.get.bind(b)) : T.value !== undefined && D.push(() => T.value));
        }
      }
    }
    const a = {}, u = Object.keys(o);
    for (let d = u.length - 1;d >= 0; d--) {
      const b = u[d], h = o[b];
      h && h.get ? Object.defineProperty(a, b, h) : a[b] = h ? h.value : undefined;
    }
    return a;
  }
  function oe(t) {
    const r = "fallback" in t && { fallback: () => t.fallback };
    return Vt(hi(() => t.each, t.children, r || undefined));
  }
  var Fi = (t) => Vt(() => t());
  function vi({ createElement: t, createTextNode: r, isTextNode: n, replaceText: o, insertNode: a, removeNode: u, setProperty: d, getParentNode: b, getFirstChild: h, getNextSibling: F }) {
    function A(P, $, f, S) {
      if (f !== undefined && !S && (S = []), typeof $ != "function")
        return T(P, $, S, f);
      Ie((w) => T(P, $(), w, f), S);
    }
    function T(P, $, f, S, w) {
      for (;typeof f == "function"; )
        f = f();
      if ($ === f)
        return f;
      const I = typeof $, N = S !== undefined;
      if (I === "string" || I === "number")
        if (I === "number" && ($ = $.toString()), N) {
          let H = f[0];
          H && n(H) ? o(H, $) : H = r($), f = x(P, f, S, H);
        } else
          f !== "" && typeof f == "string" ? o(h(P), f = $) : (x(P, f, S, r($)), f = $);
      else if ($ == null || I === "boolean")
        f = x(P, f, S);
      else {
        if (I === "function")
          return Ie(() => {
            let H = $();
            for (;typeof H == "function"; )
              H = H();
            f = T(P, H, f, S);
          }), () => f;
        if (Array.isArray($)) {
          const H = [];
          if (D(H, $, w))
            return Ie(() => f = T(P, H, f, S, true)), () => f;
          if (H.length === 0) {
            const ae = x(P, f, S);
            if (N)
              return f = ae;
          } else
            Array.isArray(f) ? f.length === 0 ? E(P, H, S) : m(P, f, H) : f == null || f === "" ? E(P, H) : m(P, N && f || [h(P)], H);
          f = H;
        } else {
          if (Array.isArray(f)) {
            if (N)
              return f = x(P, f, S, $);
            x(P, f, null, $);
          } else
            f == null || f === "" || !h(P) ? a(P, $) : z(P, $, h(P));
          f = $;
        }
      }
      return f;
    }
    function D(P, $, f) {
      let S = false;
      for (let w = 0, I = $.length;w < I; w++) {
        let N = $[w], H;
        if (!(N == null || N === true || N === false))
          if (Array.isArray(N))
            S = D(P, N) || S;
          else if ((H = typeof N) == "string" || H === "number")
            P.push(r(N));
          else if (H === "function")
            if (f) {
              for (;typeof N == "function"; )
                N = N();
              S = D(P, Array.isArray(N) ? N : [N]) || S;
            } else
              P.push(N), S = true;
          else
            P.push(N);
      }
      return S;
    }
    function m(P, $, f) {
      let S = f.length, w = $.length, I = S, N = 0, H = 0, ae = F($[w - 1]), re = null;
      for (;N < w || H < I; ) {
        if ($[N] === f[H]) {
          N++, H++;
          continue;
        }
        for (;$[w - 1] === f[I - 1]; )
          w--, I--;
        if (w === N) {
          const be = I < S ? H ? F(f[H - 1]) : f[I - H] : ae;
          for (;H < I; )
            a(P, f[H++], be);
        } else if (I === H)
          for (;N < w; )
            (!re || !re.has($[N])) && u(P, $[N]), N++;
        else if ($[N] === f[I - 1] && f[H] === $[w - 1]) {
          const be = F($[--w]);
          a(P, f[H++], F($[N++])), a(P, f[--I], be), $[w] = f[I];
        } else {
          if (!re) {
            re = new Map;
            let ie = H;
            for (;ie < I; )
              re.set(f[ie], ie++);
          }
          const be = re.get($[N]);
          if (be != null)
            if (H < be && be < I) {
              let ie = N, pe = 1, Ye;
              for (;++ie < w && ie < I && !((Ye = re.get($[ie])) == null || Ye !== be + pe); )
                pe++;
              if (pe > be - H) {
                const pt = $[N];
                for (;H < be; )
                  a(P, f[H++], pt);
              } else
                z(P, f[H++], $[N++]);
            } else
              N++;
          else
            u(P, $[N++]);
        }
      }
    }
    function x(P, $, f, S) {
      if (f === undefined) {
        let I;
        for (;I = h(P); )
          u(P, I);
        return S && a(P, S), "";
      }
      const w = S || r("");
      if ($.length) {
        let I = false;
        for (let N = $.length - 1;N >= 0; N--) {
          const H = $[N];
          if (w !== H) {
            const ae = b(H) === P;
            !I && !N ? ae ? z(P, w, H) : a(P, w, f) : ae && u(P, H);
          } else
            I = true;
        }
      } else
        a(P, w, f);
      return [w];
    }
    function E(P, $, f) {
      for (let S = 0, w = $.length;S < w; S++)
        a(P, $[S], f);
    }
    function z(P, $, f) {
      a(P, $, f), u(P, f);
    }
    function j(P, $, f = {}, S) {
      return $ || ($ = {}), S || Ie(() => f.children = T(P, $.children, f.children)), Ie(() => $.ref && $.ref(P)), Ie(() => {
        for (const w in $) {
          if (w === "children" || w === "ref")
            continue;
          const I = $[w];
          I !== f[w] && (d(P, w, I, f[w]), f[w] = I);
        }
      }), f;
    }
    return { render(P, $) {
      let f;
      return Ut((S) => {
        f = S, A($, P());
      }), f;
    }, insert: A, spread(P, $, f) {
      typeof $ == "function" ? Ie((S) => j(P, $(), S, f)) : j(P, $, undefined, f);
    }, createElement: t, createTextNode: r, insertNode: a, setProp(P, $, f, S) {
      return d(P, $, f, S), f;
    }, mergeProps: fn, effect: Ie, memo: Fi, createComponent: _i, use(P, $, f) {
      return De(() => P($, f));
    } };
  }
  function Ei(t) {
    const r = vi(t);
    return r.mergeProps = fn, r;
  }
  var dn = 6 * 1024 * 1024, Si = 64, Pl = Si, hn = 4 * 1024 * 1024, nt = 64 + hn, vr = 768 * 1024, Er = nt + vr, mi = 256 * 1024, Sr = Er + mi, gn = nt + vr, wi = 0, yi = 8, xi = 12, Pi = 16, Ti = 24, Ri = 28, Ai = 32, $i = 40, Ci = 44, Oi = yi >> 2, ki = xi >> 2, Ii = Ti >> 2, _n = Ri >> 2, Di = $i >> 2;
  Ci >> 2;
  var zi = wi >> 3, Ni = Pi >> 3, Li = Ai >> 3, Tl = 1, Rl = 2, Al = 3, $l = 4, Cl = 16, Ol = 17, kl = 20, Il = 21, Dl = 22, zl = 23, Nl = 24, Ll = 25, Bl = 26, Ml = 27, Wl = 28, Ul = 29, Vl = 30, Hl = 31, Gl = 32, jl = 33, ql = 34, Kl = 35, Xl = 36, Jl = 37, Yl = 38, Zl = 39, Ql = 0, ea = 1, ta = 2, ra = 3, na = 4, ia = 5, oa = 6, la = 7, aa = 9, sa = 10, ca = 11, ua = 12, fa = 13, da = 14, ha = 15, ga = 16, _a = 17, ba = 18, pa = 19, Fa = 20, va = 21, Ea = 22, Sa = 23, ma = 24, wa = 25, ya = 26, xa = 27, Pa = 28, Ta = 29, Ra = 30, Aa = 31, $a = 32, Ca = 33, Oa = 34, ka = 35, Ia = 36, Da = 37, za = 38, Na = 39, La = 40, Ba = 41, Ma = 42, Wa = 43, Ua = 44, Va = 45, Ha = 46, Ga = 47, ja = 48, qa = 1, Ka = 2, Xa = 3, Ja = 4, Ya = 5, Za = 6, Qa = 7, es = 8, ts = 9, rs = 10, ns = 11, is = 12, os = 13, ls = 14, as = 15, ss = 16, cs = 17, us = 18, fs = 19, ds = 20, hs = 21, gs = 22, _s = 23, bs = 0, ps = 1, Fs = 2, vs = 3, Es = 4, Ss = 5, ms = 6, ws = 7, ys = 0, xs = 1, Ps = 2, Ts = 3, Rs = 4, As = 5, $s = 6, Cs = 7, Os = 8, ks = 9, Is = 10, Ds = 11, zs = 12, Ns = 13, Ls = 14, Bs = 15, Ms = 16, Ws = 32, Us = 33, Vs = 34, Hs = 35, Gs = 36, js = 37, qs = 64, Ks = 65, Xs = 66, Js = 67, Ys = 68, Zs = 69, Qs = 70, ec = 71, tc = 72, rc = 73, nc = 74, ic = 75, oc = 96, lc = 97, ac = 98, sc = 99, cc = 128, uc = 129, fc = 130, dc = 131, hc = 132, gc = 133, _c = 134, bc = 135, pc = 136, Fc = 137, vc = 160, Ec = 161, Sc = 162, mc = 163, wc = 164, yc = 165, xc = 166, Pc = 167, Tc = 168, Rc = 169, Ac = 170, $c = 171, Cc = 172, Oc = 173, kc = 174, Ic = 175, Dc = 176, zc = 177, Nc = 178, Lc = 179, Bc = 180, Mc = 181, Wc = 182, Uc = -1, Bi = 2147483646, Mi = 2147483645, Ue = globalThis.__skal_acquireBridge();
  if (!Ue || Ue.byteLength !== dn)
    throw new Error(`Skal: bridge buffer not available (got ${Ue && Ue.byteLength})`);
  var bn = new Uint8Array(Ue), _e = new Uint32Array(Ue), mr = new BigInt64Array(Ue), Wi = new TextEncoder, xt = 16, Ui = 64 + hn >> 2, Vi = 16384, Hi = Ui - 4, jt = 0n, Ne = xt, it = nt, qt = xt;
  function wr() {
    _e[Oi] = Ne - xt << 2, _e[ki] = it - nt, jt += 1n, Atomics.store(mr, zi, jt), qt = Ne;
  }
  function pn() {
    wr();
    const t = jt, r = performance.now() + 5000;
    for (;!(Atomics.load(mr, Li) >= t); )
      if (performance.now() > r) {
        console.warn("Skal: drain spin timeout \u2014 UI thread slow; ring will overwrite");
        break;
      }
    Ne = xt, it = nt, qt = xt;
  }
  function te(t, r, n, o) {
    let a = Ne;
    a >= Hi && (pn(), a = Ne), _e[a] = t >>> 0, _e[a + 1] = r >>> 0, _e[a + 2] = n >>> 0, _e[a + 3] = o >>> 0, Ne = a + 4, Ne - qt >= Vi && wr();
  }
  var Ve = 0, He = 0;
  function ot(t) {
    it + t.length * 3 > gn && pn();
    const r = it - nt, n = bn.subarray(it, gn), { read: o, written: a } = Wi.encodeInto(t, n);
    if (o !== t.length)
      throw new Error(`Skal: string too large for heap (${t.length} code units > ${vr} bytes)`);
    it += a, Ve = r, He = a;
  }
  function Kt(t, r) {
    ot(r), te(20, t, Ve, He);
  }
  var yr = false;
  function Gi() {
    yr = false, Ne !== qt && wr();
  }
  function Y() {
    yr || (yr = true, queueMicrotask(Gi));
  }
  var Re = 1024, U = new Int8Array(256);
  U.fill(-1), U[0] = 0, U[1] = 1, U[2] = 2, U[3] = 3, U[4] = 4, U[5] = 5, U[6] = 6, U[7] = 7, U[8] = 8, U[9] = 9, U[32] = 10, U[33] = 11, U[34] = 12, U[35] = 13, U[36] = 14, U[37] = 15, U[64] = 16, U[65] = 17, U[66] = 18, U[67] = 19, U[68] = 20, U[69] = 21, U[70] = 22, U[96] = 23, U[97] = 24, U[128] = 25, U[129] = 26, U[130] = 27, U[131] = 28, U[160] = 29, U[161] = 30, U[162] = 31, U[10] = 32, U[11] = 33, U[12] = 34, U[13] = 35, U[14] = 36, U[15] = 37, U[16] = 38, U[132] = 39, U[133] = 40, U[134] = 41, U[135] = 42, U[136] = 43, U[163] = 44, U[164] = 45, U[165] = 46, U[166] = 47, U[71] = 48, U[98] = 49, U[137] = 50, U[72] = 51, U[167] = 52, U[168] = 53, U[169] = 54, U[170] = 55, U[171] = 56, U[172] = 57, U[173] = 58, U[174] = 59, U[73] = 60, U[99] = 61, U[175] = 62, U[74] = 63;
  var ve = 64, Xt = new Int32Array(Re * ve), Pt = new Float32Array(Re * ve), Jt = new Array(Re * ve), Tt = new Uint8Array(Re * ve), lt = 6, at = new Float32Array(Re * lt);
  at.fill(NaN);
  var Yt = new Map, Fn = [], ji = 0;
  function qi() {
    const t = Re * 2, r = Re * ve, n = t * ve, o = Re * lt, a = t * lt, u = new Int32Array(n);
    u.set(Xt), Xt = u;
    const d = new Uint8Array(n);
    d.set(Tt), Tt = d;
    const b = new Float32Array(n);
    b.set(Pt), b.fill(NaN, r), Pt = b;
    const h = new Float32Array(a);
    h.set(at), h.fill(NaN, o), at = h, Jt.length = n, Re = t;
  }
  function Zt(t) {
    let r = Yt.get(t);
    if (r === undefined) {
      r = Fn.pop(), r === undefined && (r = ji++), r >= Re && qi(), Yt.set(t, r);
      const n = r * ve;
      Tt.fill(0, n, n + ve), Pt.fill(NaN, n, n + ve);
      for (let o = n;o < n + ve; o++)
        Jt[o] = undefined;
    }
    return r;
  }
  var vn = new Map, En = new Map, Sn = new Map, st = new Map;
  function Ki(t) {
    const r = Yt.get(t);
    if (r !== undefined) {
      Yt.delete(t), Fn.push(r);
      const n = r * lt;
      at.fill(NaN, n, n + lt);
    }
    vn.delete(t), En.delete(t), Sn.delete(t), _o(t);
  }
  var ye = 0, Le = 0, ct = new Float32Array(1), Rt = new Uint32Array(ct.buffer);
  function he(t, r, n) {
    const o = n | 0, a = U[r];
    if (a < 0) {
      te(16, t, r, o), ye++;
      return;
    }
    const u = Zt(t) * ve + a;
    if (Tt[u] !== 0 && Xt[u] === o) {
      Le++;
      return;
    }
    Xt[u] = o, Tt[u] = 1, te(16, t, r, o), ye++;
  }
  function mn(t, r, n) {
    const o = U[r];
    if (o < 0) {
      ct[0] = n, te(17, t, r, Rt[0]), ye++;
      return;
    }
    const a = Zt(t) * ve + o;
    if (Pt[a] === n) {
      Le++;
      return;
    }
    Pt[a] = n, ct[0] = n, te(17, t, r, Rt[0]), ye++;
  }
  function Xi(t, r, n) {
    const o = U[r];
    if (o < 0) {
      ot(n == null ? "" : String(n)), te(22, t, (r & 255) << 24 | Ve & 16777215, He), ye++;
      return;
    }
    const a = Zt(t) * ve + o;
    if (Jt[a] === n) {
      Le++;
      return;
    }
    Jt[a] = n, ot(n == null ? "" : String(n)), te(22, t, (r & 255) << 24 | Ve & 16777215, He), ye++;
  }
  function ut(t, r, n, o) {
    const a = Zt(t) * lt + n;
    if (at[a] === o) {
      Le++;
      return;
    }
    at[a] = o, ct[0] = o, te(r, t, 0, Rt[0]), ye++;
  }
  function Ji(t, r) {
    ut(t, 32, 0, r);
  }
  function Yi(t, r) {
    ut(t, 33, 1, r);
  }
  function Zi(t, r) {
    ut(t, 34, 2, r);
  }
  function Qi(t, r) {
    ut(t, 35, 3, r);
  }
  function eo(t, r) {
    ut(t, 36, 4, r);
  }
  function to(t, r) {
    ut(t, 37, 5, r);
  }
  var ro = { material: 0, cupertino: 1, adaptive: 2 }, no = { light: 0, dark: 1 };
  function io(t, r) {
    te(38, typeof t == "string" ? ro[t] ?? 0 : t | 0, typeof r == "string" ? no[r] ?? 0 : r | 0, 0), Y();
  }
  function oo(t) {
    te(39, t, 0, 0), Y();
  }
  function wn(t) {
    return je(1, "showDialog", [JSON.stringify(t || {})]);
  }
  function lo(t) {
    return je(1, "showActionSheet", [JSON.stringify(t || {})]);
  }
  function yn(t) {
    return je(1, "showSnackbar", [JSON.stringify(typeof t == "string" ? { message: t } : t || {})]);
  }
  function ao(t) {
    return je(1, "showDatePicker", [JSON.stringify(t || {})]);
  }
  function so(t) {
    return je(1, "showTimePicker", [JSON.stringify(t || {})]);
  }
  function co() {
    return je(1, "getDataDir", []);
  }
  var xn = new Map;
  function uo(t) {
    let r = 2166136261;
    for (let n = 0;n < t.length; n++)
      r ^= t.charCodeAt(n), r = Math.imul(r, 16777619) >>> 0;
    return r;
  }
  function Ge(t) {
    let r = xn.get(t);
    return r !== undefined || (r = uo(t), ot(t), te(23, r, Ve, He), xn.set(t, r)), r;
  }
  function fo(t, r) {
    te(4, t, Ge(r), 0);
  }
  function xr(t, r) {
    let n = t.get(r);
    return n === undefined && (n = new Map, t.set(r, n)), n;
  }
  function Pn(t, r, n) {
    const o = Ge(r), a = n >>> 0, u = xr(vn, t);
    if (u.get(o) === a) {
      Le++;
      return;
    }
    u.set(o, a), te(24, t, o, a), ye++;
  }
  function Tn(t, r, n) {
    const o = Ge(r), a = xr(En, t);
    if (a.get(o) === n) {
      Le++;
      return;
    }
    a.set(o, n), ct[0] = n, te(25, t, o, Rt[0]), ye++;
  }
  function Rn(t, r, n) {
    const o = Ge(r), a = n == null ? "" : String(n), u = xr(Sn, t);
    if (u.get(o) === a) {
      Le++;
      return;
    }
    u.set(o, a), ot(a);
    const d = Ve & 16777215, b = He & 255;
    te(26, t, o, d << 8 | b), ye++;
  }
  function ho(t, r, n) {
    te(27, t, Ge(r), n);
  }
  var At = new Map, Ae = new Map, An = 1;
  function $n(t, r) {
    for (let n = 0;n < r.length; n++) {
      const o = r[n];
      if (typeof o == "number")
        Number.isInteger(o) ? te(29, t, 1, o | 0) : (ct[0] = o, te(29, t, 2, Rt[0]));
      else if (typeof o == "boolean")
        te(29, t, 3, o ? 1 : 0);
      else if (typeof o == "string") {
        ot(o);
        const a = Ve >>> 0;
        te(29, t, 4 | (He & 16777215) << 8, a);
      } else
        te(29, t, 0, 0);
    }
  }
  function je(t, r, n) {
    const o = Ge(r), a = An++;
    return $n(a, n), te(28, t, o, a), Y(), new Promise((u, d) => {
      At.set(a, { resolve: u, reject: d });
    });
  }
  function go(t, r, n, o, a) {
    const u = Ge(r), d = An++;
    $n(d, n), te(30, t, u, d), Y(), Ae.set(d, { nodeId: t, onValue: o, onError: a && a.onError, onDone: a && a.onDone });
    let b = st.get(t);
    return b === undefined && (b = new Set, st.set(t, b)), b.add(d), function() {
      if (!Ae.has(d))
        return;
      Ae.delete(d);
      const F = st.get(t);
      F && (F.delete(d), F.size === 0 && st.delete(t)), te(31, d, 0, 0), Y();
    };
  }
  function _o(t) {
    const r = st.get(t);
    if (r !== undefined) {
      for (const n of r)
        Ae.has(n) && (Ae.delete(n), te(31, n, 0, 0));
      st.delete(t), Y();
    }
  }
  var Pr = new Map, bo = 1;
  function Tr(t) {
    const r = bo++;
    return Pr.set(r, t), r;
  }
  function Cn(t, r, n) {
    te(21, t, r, n);
  }
  var Rr = 0n, qe = null, On = dn - Sr, Ar = Sr >> 2, po = Sr + On >> 2, Fo = On / 16 | 0, kn = new ArrayBuffer(4), $r = new Float32Array(kn), Cr = new Uint32Array(kn), vo = new TextDecoder("utf-8");
  function Or(t, r) {
    return r === 0 ? "" : vo.decode(bn.subarray(Er + t, Er + t + r));
  }
  function kr(t, r) {
    _e[Di] = t + r;
  }
  globalThis.__skal_drainEvents = function() {
    const t = Atomics.load(mr, Ni);
    if (t === Rr)
      return;
    const r = Ar + (_e[Ii] >> 2);
    let n = Ar + (_e[_n] >> 2);
    const o = po, a = Ar;
    let u = Fo;
    for (;n !== r && u-- > 0; ) {
      const d = _e[n + 0], b = d & 255, h = d >>> 8 & 255, F = _e[n + 1], A = _e[n + 2], T = _e[n + 3];
      let D, m = false;
      if (h === 1)
        D = A | 0, m = true;
      else if (h === 2)
        Cr[0] = A, D = $r[0], m = true;
      else if (h === 3)
        D = A !== 0, m = true;
      else if (h === 4)
        D = Or(T, A), m = true, kr(T, A);
      else if (h === 5) {
        const x = Or(T, A);
        try {
          D = JSON.parse(x);
        } catch {
          D = x;
        }
        m = true, kr(T, A);
      } else if (h === 6) {
        const x = Or(T, A);
        try {
          D = JSON.parse(x);
        } catch {
          D = [];
        }
        m = true, kr(T, A);
      } else if (h === 7) {
        Cr[0] = A;
        const x = $r[0];
        Cr[0] = T, D = [x, $r[0]], m = true;
      }
      if (b === 3) {
        const x = At.get(F);
        if (x) {
          At.delete(F);
          try {
            x.resolve(m ? D : undefined);
          } catch (E) {
            qe = E && (E.stack || E.message || String(E)) || "unknown";
          }
        }
      } else if (b === 4) {
        const x = At.get(F);
        if (x) {
          At.delete(F);
          try {
            const E = typeof D == "string" ? D : `skal RPC error (status ${D})`;
            x.reject(new Error(E));
          } catch (E) {
            qe = E && (E.stack || E.message || String(E)) || "unknown";
          }
        }
      } else if (b === 5) {
        const x = Ae.get(F);
        if (x)
          try {
            x.onValue(m ? D : undefined);
          } catch (E) {
            qe = E && (E.stack || E.message || String(E)) || "unknown";
          }
      } else if (b === 6) {
        const x = Ae.get(F);
        if (x) {
          Ae.delete(F);
          try {
            x.onDone && x.onDone();
          } catch (E) {
            qe = E && (E.stack || E.message || String(E)) || "unknown";
          }
        }
      } else if (b === 7) {
        const x = Ae.get(F);
        if (x) {
          Ae.delete(F);
          try {
            x.onError && x.onError(new Error(typeof D == "string" ? D : "skal stream error"));
          } catch (E) {
            qe = E && (E.stack || E.message || String(E)) || "unknown";
          }
        }
      } else {
        const x = Pr.get(F);
        if (x)
          try {
            m ? (h === 6 || h === 7) && Array.isArray(D) ? x(...D) : x(D) : x();
          } catch (E) {
            qe = E && (E.stack || E.message || String(E)) || "unknown";
          }
      }
      n += 4, n >= o && (n = a);
    }
    _e[_n] = n - a << 2, Rr = t;
  }, globalThis.skalStatus = () => JSON.stringify({ handlerCount: Pr.size, opSeq: Number(jt), lastEventSeq: Number(Rr), lastHandlerError: qe, propWrites: ye, propSkips: Le });
  var Vc = 1, Eo = 2;
  function In() {
    return Eo++;
  }
  var So = { box: 0, column: 1, scrollView: 5, listView: 6, reorderableListView: 7, row: 2, text: 3, button: 4, image: 9, stack: 10, switch: 11, slider: 12, checkbox: 13, activityIndicator: 14, progressBar: 15, lazyGrid: 16, wrap: 17, safeArea: 18, richText: 19, textInput: 20, navigator: 21, screen: 22, tabs: 23, tab: 24, animatedList: 25, crossFade: 26, hero: 27, listTile: 28, pageView: 29, dismissible: 30, customScrollView: 31, sliverAppBar: 32, sliverList: 33, sliverGrid: 34, canvas: 35, dragItem: 36, dropZone: 37, radio: 38, chip: 39, segmentedButton: 40, expansionTile: 41, dropdown: 42, stepper: 43, step: 44, drawer: 45, bottomSheet: 46, backdropFilter: 47, interactiveViewer: 48 };
  function mo() {
    const t = [], r = { _cmds: t, fillStyle(n) {
      return t.push(["fillStyle", Ir(n)]), r;
    }, strokeStyle(n) {
      return t.push(["strokeStyle", Ir(n)]), r;
    }, lineWidth(n) {
      return t.push(["lineWidth", +n || 0]), r;
    }, fillRect(n, o, a, u) {
      return t.push(["fillRect", +n, +o, +a, +u]), r;
    }, strokeRect(n, o, a, u) {
      return t.push(["strokeRect", +n, +o, +a, +u]), r;
    }, circle(n, o, a) {
      return t.push(["circle", +n, +o, +a]), r;
    }, line(n, o, a, u) {
      return t.push(["line", +n, +o, +a, +u]), r;
    }, beginPath() {
      return t.push(["beginPath"]), r;
    }, moveTo(n, o) {
      return t.push(["moveTo", +n, +o]), r;
    }, lineTo(n, o) {
      return t.push(["lineTo", +n, +o]), r;
    }, closePath() {
      return t.push(["closePath"]), r;
    }, fill() {
      return t.push(["fill"]), r;
    }, stroke() {
      return t.push(["stroke"]), r;
    }, fontSize(n) {
      return t.push(["fontSize", +n || 14]), r;
    }, fillText(n, o, a) {
      return t.push(["fillText", String(n), +o, +a]), r;
    } };
    return r;
  }
  var wo = { padding: [0, "u32"], paddingTop: [1, "u32"], paddingRight: [2, "u32"], paddingBottom: [3, "u32"], paddingLeft: [4, "u32"], width: [5, "dim"], height: [6, "dim"], weight: [7, "f32"], alignment: [8, "u32"], gap: [9, "u32"], axis: [10, "u32"], top: [11, "u32"], right: [12, "u32"], bottom: [13, "u32"], left: [14, "u32"], crossAxisCount: [15, "u32"], aspectRatio: [16, "f32"], background: [32, "color"], color: [33, "color"], cornerRadius: [34, "u32"], borderWidth: [35, "u32"], borderColor: [36, "color"], shadow: [37, "u32"], fontSize: [64, "u32"], fontWeight: [65, "u32"], fontFamily: [66, "u32"], textAlign: [67, "u32"], lineHeight: [68, "u32"], maxLines: [69, "u32"], textOverflow: [70, "u32"], src: [96, "str"], contentScale: [97, "u32"], placeholder: [128, "str"], value: [129, "str"], keyboardType: [130, "u32"], secureEntry: [131, "u32"], checked: [132, "u32"], min: [134, "f32"], max: [135, "f32"], progress: [136, "f32"], initialSize: [176, "f32"], minSize: [177, "f32"], maxSize: [178, "f32"], presentation: [166, "u32"], title: [71, "str"], icon: [98, "str"], leadingIcon: [98, "str"], subtitle: [73, "str"], trailingIcon: [99, "str"], activeTab: [137, "u32"], tag: [72, "str"], transition: [171, "u32"], enabled: [160, "u32"], focusable: [161, "u32"], visible: [162, "u32"], draggable: [172, "u32"], spring: [173, "u32"], release: [174, "u32"], sliverMode: [175, "u32"], dragData: [74, "str"], scrollbar: [179, "u32"], blurRadius: [180, "u32"], minScale: [181, "f32"], maxScale: [182, "f32"], semanticLabel: [75, "str"] }, yo = { opacity: Ji, translationX: Yi, translationY: Zi, scaleX: Qi, scaleY: eo, rotation: to }, xo = { onClick: 1, onclick: 1, onTap: 1, onLongPress: 8, onDoubleTap: 9, onChange: 2, onSubmit: 10, onReorder: 11, onPop: 12, onDismiss: 20, onPanStart: 13, onPanUpdate: 14, onPanEnd: 15, onScaleStart: 16, onScaleUpdate: 17, onScaleEnd: 18, onDrop: 21, onHover: 22, onKey: 23 }, Po = { linear: 0, easeIn: 1, easeOut: 2, easeInOut: 3, bounce: 4, elastic: 5, fastOutSlowIn: 6 }, To = { gentle: 1, bouncy: 2, stiff: 3 };
  function Ir(t) {
    if (typeof t == "number")
      return t | 0;
    if (typeof t != "string")
      return 0;
    let r = t.trim();
    r.startsWith("#") && (r = r.slice(1));
    let n = 0, o = 0, a = 0, u = 255;
    return r.length === 3 ? (n = parseInt(r[0] + r[0], 16), o = parseInt(r[1] + r[1], 16), a = parseInt(r[2] + r[2], 16)) : r.length === 4 ? (n = parseInt(r[0] + r[0], 16), o = parseInt(r[1] + r[1], 16), a = parseInt(r[2] + r[2], 16), u = parseInt(r[3] + r[3], 16)) : r.length === 6 ? (n = parseInt(r.slice(0, 2), 16), o = parseInt(r.slice(2, 4), 16), a = parseInt(r.slice(4, 6), 16)) : r.length === 8 && (u = parseInt(r.slice(0, 2), 16), n = parseInt(r.slice(2, 4), 16), o = parseInt(r.slice(4, 6), 16), a = parseInt(r.slice(6, 8), 16)), (u & 255) << 24 | (n & 255) << 16 | (o & 255) << 8 | a & 255 | 0;
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
  function $o(t, r, n) {
    if (n == null)
      return;
    if (r === "ref" && n && typeof n.__skalBind == "function") {
      n.__skalBind(t.id);
      return;
    }
    const o = typeof n;
    if (o === "object" && Ao(n)) {
      Rn(t.id, r, JSON.stringify(n)), Y();
      return;
    }
    if (o === "function") {
      const a = Tr(n);
      ho(t.id, r, a), Y();
      return;
    }
    if (o === "number") {
      Number.isInteger(n) && n >= 0 && n <= 4294967295 && Pn(t.id, r, n | 0), Tn(t.id, r, n), Y();
      return;
    }
    if (o === "string") {
      Rn(t.id, r, n), Y();
      return;
    }
    if (o === "boolean") {
      Pn(t.id, r, n ? 1 : 0), Y();
      return;
    }
  }
  function Co(t) {
    const r = [t];
    for (;r.length > 0; ) {
      const n = r.pop();
      Ki(n.id);
      let o = n.firstChild;
      for (;o; )
        r.push(o), o = o.nextSibling;
    }
  }
  var Qt = class {
    constructor(t, r, n = false, o = false) {
      this.tag = t, this.id = r, this.isText = n, this.isCustom = o, this.parent = null, this.firstChild = null, this.lastChild = null, this.nextSibling = null, this.prevSibling = null, this.text = "";
    }
  }, Oo = Ei({ createElement(t) {
    const r = In(), n = So[t];
    return n !== undefined ? (te(1, r, n, 0), Y(), new Qt(t, r, false, false)) : (fo(r, t), Y(), new Qt(t, r, false, true));
  }, createTextNode(t) {
    const r = In();
    te(1, r, 3, 0);
    const n = t == null ? "" : String(t);
    n.length > 0 && Kt(r, n), Y();
    const o = new Qt("#text", r, true);
    return o.text = n, o;
  }, replaceText(t, r) {
    const n = r == null ? "" : String(r);
    t.text !== n && (t.text = n, Kt(t.id, n), Y());
  }, setProperty(t, r, n, o) {
    if (t.isCustom) {
      $o(t, r, n);
      return;
    }
    if (r === "onRefresh") {
      if (typeof n == "function") {
        const b = t.id, h = n, A = Tr(async () => {
          try {
            await h();
          } finally {
            oo(b);
          }
        });
        Cn(t.id, 19, A), Y();
      }
      return;
    }
    if (r === "draw" && typeof n == "function") {
      const b = n, h = t;
      hr(() => {
        const F = mo();
        try {
          b(F);
        } catch {}
        const A = JSON.stringify(F._cmds);
        A !== h._skalCanvasProgram && (h._skalCanvasProgram = A, Kt(h.id, A), Y());
      });
      return;
    }
    const a = xo[r];
    if (a !== undefined) {
      if (typeof n == "function") {
        const b = Tr(n);
        Cn(t.id, a, b), Y();
      }
      return;
    }
    if (r === "value" && t.tag === "slider") {
      mn(t.id, 133, Number(n) || 0), Y();
      return;
    }
    if (r === "draggable" && typeof n == "string") {
      he(t.id, 172, { free: 1, both: 1, horizontal: 2, x: 2, vertical: 3, y: 3 }[n] ?? 0), Y();
      return;
    }
    if (r === "spring" && typeof n == "string") {
      he(t.id, 173, { gentle: 1, bouncy: 2, stiff: 3, wobbly: 2 }[n] ?? 0), Y();
      return;
    }
    if (r === "release" && typeof n == "string") {
      he(t.id, 174, { none: 0, glide: 1, friction: 1, springback: 2, spring: 2 }[n.toLowerCase()] ?? 0), Y();
      return;
    }
    if (r === "sliverMode" && typeof n == "string") {
      he(t.id, 175, { normal: 0, pinned: 1, floating: 2, both: 3 }[n.toLowerCase()] ?? 0), Y();
      return;
    }
    if (r === "animate" && n && typeof n == "object") {
      if (he(t.id, 163, n.duration | 0), n.curve != null) {
        const b = typeof n.curve == "string" ? Po[n.curve] ?? 0 : n.curve | 0;
        he(t.id, 164, b);
      }
      if (n.delay != null && he(t.id, 165, n.delay | 0), n.repeat != null && he(t.id, 167, n.repeat ? 1 : 0), n.reverse != null && he(t.id, 168, n.reverse ? 1 : 0), n.loop != null && he(t.id, 169, n.loop | 0), n.spring != null) {
        const b = typeof n.spring == "string" ? To[n.spring] ?? 0 : n.spring ? 2 : 0;
        he(t.id, 170, b);
      }
      Y();
      return;
    }
    if (r === "label" && (t.tag === "button" || t.tag === "text" || t.tag === "chip")) {
      const b = n == null ? "" : String(n);
      Kt(t.id, b), Y();
      return;
    }
    const u = yo[r];
    if (u !== undefined) {
      typeof n == "number" && (u(t.id, n), Y());
      return;
    }
    const d = wo[r];
    if (d !== undefined) {
      const [b, h] = d;
      if (n == null)
        return;
      switch (h) {
        case "u32":
          typeof n == "number" ? (he(t.id, b, n | 0), Y()) : typeof n == "boolean" && (he(t.id, b, n ? 1 : 0), Y());
          return;
        case "f32":
          typeof n == "number" && (mn(t.id, b, n), Y());
          return;
        case "str":
          Xi(t.id, b, String(n)), Y();
          return;
        case "color":
          he(t.id, b, Ir(n)), Y();
          return;
        case "dim":
          he(t.id, b, Ro(n)), Y();
          return;
      }
      return;
    }
    if (r === "style" && n && typeof n == "object") {
      for (const b in n)
        this.setProperty(t, b, n[b]);
      return;
    }
  }, insertNode(t, r, n) {
    if (r === n)
      return;
    if (r.parent) {
      const a = r.parent;
      r.prevSibling ? r.prevSibling.nextSibling = r.nextSibling : a.firstChild === r && (a.firstChild = r.nextSibling), r.nextSibling ? r.nextSibling.prevSibling = r.prevSibling : a.lastChild === r && (a.lastChild = r.prevSibling), r.prevSibling = null, r.nextSibling = null;
    }
    const o = n ? n.id : 0;
    te(3, t.id, r.id, o), Y(), r.parent = t, n ? (r.nextSibling = n, r.prevSibling = n.prevSibling, n.prevSibling ? n.prevSibling.nextSibling = r : t.firstChild = r, n.prevSibling = r) : (r.prevSibling = t.lastChild, r.nextSibling = null, t.lastChild ? t.lastChild.nextSibling = r : t.firstChild = r, t.lastChild = r);
  }, removeNode(t, r) {
    te(2, r.id, 0, 0), Co(r), Y(), r.prevSibling ? r.prevSibling.nextSibling = r.nextSibling : t.firstChild = r.nextSibling, r.nextSibling ? r.nextSibling.prevSibling = r.prevSibling : t.lastChild = r.prevSibling, r.parent = null, r.prevSibling = null, r.nextSibling = null;
  }, isTextNode(t) {
    return t.isText;
  }, getParentNode(t) {
    return t.parent;
  }, getFirstChild(t) {
    return t.firstChild;
  }, getNextSibling(t) {
    return t.nextSibling;
  } }), { render: ko, effect: G, memo: Dr, createComponent: L, createElement: l, createTextNode: Hc, insertNode: _, insert: B, spread: Gc, setProp: e, mergeProps: jc, use: Io } = Oo;
  te(1, 1, 0, 0), Y();
  var Do = new Qt("box", 1, false);
  function zo() {
    let t = 0;
    const r = function() {};
    return r.__skalBind = (n) => {
      t = n;
    }, new Proxy(r, { apply(n, o, a) {
      const u = a[0];
      u && typeof u.id == "number" && (t = u.id);
    }, get(n, o) {
      if (o === "__skalBind" || typeof o == "symbol")
        return r[o];
      if (typeof o == "string" && o.endsWith("$") && o.length > 1) {
        const a = o.slice(0, -1);
        return (...u) => {
          if (t === 0)
            throw new Error(`skal ref: cannot call .${String(o)}() before the host mounts. Move the call into a JSX event handler.`);
          const d = u[u.length - 1];
          if (typeof d != "function")
            throw new TypeError(`skal ref: .${String(o)}() requires a callback as its last argument (got ${typeof d})`);
          const b = u.slice(0, -1);
          return go(t, a, b, d);
        };
      }
      return (...a) => t === 0 ? Promise.reject(new Error(`skal ref: cannot call .${String(o)}() before the host mounts. Move the call into a JSX event handler.`)) : je(t, o, a);
    } });
  }
  function zr(t, r, n) {
    const o = (x) => {
      const E = t[x];
      return typeof E == "function" ? E : E && E.component || null;
    }, a = (x) => {
      const E = t[x];
      return E && typeof E == "object" ? E.title : undefined;
    }, u = (x) => {
      const E = t[x];
      return E && typeof E == "object" ? E.transition : undefined;
    }, d = (x) => x === "fade" ? 1 : x === "none" ? 2 : typeof x == "number" ? x : 0, b = !!(n && n.linking), h = typeof window < "u", F = () => {
      if (!h)
        return null;
      const x = (window.location.hash || "").replace(/^#\/?/, "").split("?")[0];
      return x && t[x] ? x : null;
    };
    let A = typeof r == "string" ? r : r && r.name || Object.keys(t)[0];
    if (b) {
      const x = F();
      x && (A = x);
    }
    const [T, D] = X([{ name: A, params: {}, title: a(A), transition: u(A) }]), m = { stack: T, navigate(x, E, z) {
      D([...T(), { name: x, params: E || {}, presentation: z && z.presentation, title: (z && z.title) !== undefined ? z.title : a(x), transition: (z && z.transition) !== undefined ? z.transition : u(x) }]);
    }, back() {
      const x = T();
      x.length > 1 && D(x.slice(0, -1));
    }, replace(x, E, z) {
      D([...T().slice(0, -1), { name: x, params: E || {}, title: (z && z.title) !== undefined ? z.title : a(x), transition: (z && z.transition) !== undefined ? z.transition : u(x) }]);
    }, reset(x, E) {
      D([{ name: x, params: E || {}, title: a(x), transition: u(x) }]);
    }, canGoBack() {
      return T().length > 1;
    } };
    return b && h && hr(() => {
      const x = T(), E = "#/" + x[x.length - 1].name;
      window.location.hash !== E && window.history.replaceState({}, "", E);
    }), m.View = () => (() => {
      var x = l("navigator");
      return e(x, "onPop", () => m.back()), B(x, L(oe, { get each() {
        return T();
      }, children: (E) => {
        const z = o(E.name);
        return (() => {
          var j = l("screen");
          return B(j, z ? L(z, { get params() {
            return E.params || {};
          }, router: m }) : null), G((P) => {
            var $ = E.presentation === "modal" ? 1 : 0, f = E.title || "", S = d(E.transition);
            return $ !== P.e && (P.e = e(j, "presentation", $, P.e)), f !== P.t && (P.t = e(j, "title", f, P.t)), S !== P.a && (P.a = e(j, "transition", S, P.a)), P;
          }, { e: undefined, t: undefined, a: undefined }), j;
        })();
      } })), x;
    })(), m;
  }
  var er = Symbol("store-raw"), ft = Symbol("store-node"), Ce = Symbol("store-has"), Dn = Symbol("store-self");
  function zn(t) {
    let r = t[Pe];
    if (!r && (Object.defineProperty(t, Pe, { value: r = new Proxy(t, Bo) }), !Array.isArray(t))) {
      const n = Object.keys(t), o = Object.getOwnPropertyDescriptors(t);
      for (let a = 0, u = n.length;a < u; a++) {
        const d = n[a];
        o[d].get && Object.defineProperty(t, d, { enumerable: o[d].enumerable, get: o[d].get.bind(r) });
      }
    }
    return r;
  }
  function dt(t) {
    let r;
    return t != null && typeof t == "object" && (t[Pe] || !(r = Object.getPrototypeOf(t)) || r === Object.prototype || Array.isArray(t));
  }
  function ht(t, r = new Set) {
    let n, o, a, u;
    if (n = t != null && t[er])
      return n;
    if (!dt(t) || r.has(t))
      return t;
    if (Array.isArray(t)) {
      Object.isFrozen(t) ? t = t.slice(0) : r.add(t);
      for (let d = 0, b = t.length;d < b; d++)
        a = t[d], (o = ht(a, r)) !== a && (t[d] = o);
    } else {
      Object.isFrozen(t) ? t = Object.assign({}, t) : r.add(t);
      const d = Object.keys(t), b = Object.getOwnPropertyDescriptors(t);
      for (let h = 0, F = d.length;h < F; h++)
        u = d[h], !b[u].get && (a = t[u], (o = ht(a, r)) !== a && (t[u] = o));
    }
    return t;
  }
  function tr(t, r) {
    let n = t[r];
    return n || Object.defineProperty(t, r, { value: n = Object.create(null) }), n;
  }
  function $t(t, r, n) {
    if (t[r])
      return t[r];
    const [o, a] = X(n, { equals: false, internal: true });
    return o.$ = a, t[r] = o;
  }
  function No(t, r) {
    const n = Reflect.getOwnPropertyDescriptor(t, r);
    return !n || n.get || !n.configurable || r === Pe || r === ft || (delete n.value, delete n.writable, n.get = () => t[Pe][r]), n;
  }
  function Nn(t) {
    gr() && $t(tr(t, ft), Dn)();
  }
  function Lo(t) {
    return Nn(t), Reflect.ownKeys(t);
  }
  var Bo = { get(t, r, n) {
    if (r === er)
      return t;
    if (r === Pe)
      return n;
    if (r === dr)
      return Nn(t), n;
    const o = tr(t, ft), a = o[r];
    let u = a ? a() : t[r];
    if (r === ft || r === Ce || r === "__proto__")
      return u;
    if (!a) {
      const d = Object.getOwnPropertyDescriptor(t, r);
      gr() && (typeof u != "function" || t.hasOwnProperty(r)) && !(d && d.get) && (u = $t(o, r, u)());
    }
    return dt(u) ? zn(u) : u;
  }, has(t, r) {
    return r === er || r === Pe || r === dr || r === ft || r === Ce || r === "__proto__" ? true : (gr() && $t(tr(t, Ce), r)(), (r in t));
  }, set() {
    return true;
  }, deleteProperty() {
    return true;
  }, ownKeys: Lo, getOwnPropertyDescriptor: No };
  function gt(t, r, n, o = false) {
    if (!o && t[r] === n)
      return;
    const a = t[r], u = t.length;
    n === undefined ? (delete t[r], t[Ce] && t[Ce][r] && a !== undefined && t[Ce][r].$()) : (t[r] = n, t[Ce] && t[Ce][r] && a === undefined && t[Ce][r].$());
    let d = tr(t, ft), b;
    if ((b = $t(d, r, a)) && b.$(() => n), Array.isArray(t) && t.length !== u) {
      for (let h = t.length;h < u; h++)
        (b = d[h]) && b.$();
      (b = $t(d, "length", u)) && b.$(t.length);
    }
    (b = d[Dn]) && b.$();
  }
  function Ln(t, r) {
    const n = Object.keys(r);
    for (let o = 0;o < n.length; o += 1) {
      const a = n[o];
      gt(t, a, r[a]);
    }
  }
  function Mo(t, r) {
    if (typeof r == "function" && (r = r(t)), r = ht(r), Array.isArray(r)) {
      if (t === r)
        return;
      let n = 0, o = r.length;
      for (;n < o; n++) {
        const a = r[n];
        t[n] !== a && gt(t, n, a);
      }
      gt(t, "length", o);
    } else
      Ln(t, r);
  }
  function Ct(t, r, n = []) {
    let o, a = t;
    if (r.length > 1) {
      o = r.shift();
      const d = typeof o, b = Array.isArray(t);
      if (Array.isArray(o)) {
        for (let h = 0;h < o.length; h++)
          Ct(t, [o[h]].concat(r), n);
        return;
      } else if (b && d === "function") {
        for (let h = 0;h < t.length; h++)
          o(t[h], h) && Ct(t, [h].concat(r), n);
        return;
      } else if (b && d === "object") {
        const { from: h = 0, to: F = t.length - 1, by: A = 1 } = o;
        for (let T = h;T <= F; T += A)
          Ct(t, [T].concat(r), n);
        return;
      } else if (r.length > 1) {
        Ct(t[o], r, [o].concat(n));
        return;
      }
      a = t[o], n = [o].concat(n);
    }
    let u = r[0];
    typeof u == "function" && (u = u(a, n), u === a) || o === undefined && u == null || (u = ht(u), o === undefined || dt(a) && dt(u) && !Array.isArray(u) ? Ln(a, u) : gt(t, o, u));
  }
  function Wo(...[t, r]) {
    const n = ht(t || {}), o = Array.isArray(n), a = zn(n);
    function u(...d) {
      Qr(() => {
        o && d.length === 1 ? Mo(n, d[0]) : Ct(n, d);
      });
    }
    return [a, u];
  }
  var rr = new WeakMap, Bn = { get(t, r) {
    if (r === er)
      return t;
    const n = t[r];
    let o;
    return dt(n) ? rr.get(n) || (rr.set(n, o = new Proxy(n, Bn)), o) : n;
  }, set(t, r, n) {
    return gt(t, r, ht(n)), true;
  }, deleteProperty(t, r) {
    return gt(t, r, undefined, true), true;
  } };
  function nr(t) {
    return (r) => {
      if (dt(r)) {
        let n;
        (n = rr.get(r)) || rr.set(r, n = new Proxy(r, Bn)), t(n);
      }
      return r;
    };
  }
  var qc = 15, Uo = (() => {
    const t = new Uint32Array(256);
    for (let r = 0;r < 256; r++) {
      let n = r;
      for (let o = 0;o < 8; o++)
        n = n & 1 ? 3988292384 ^ n >>> 1 : n >>> 1;
      t[r] = n >>> 0;
    }
    return t;
  })();
  function Mn(t, r = 0, n = t.length) {
    let o = 4294967295;
    for (let a = r;a < n; a++)
      o = Uo[(o ^ t[a]) & 255] ^ o >>> 8;
    return (o ^ 4294967295) >>> 0;
  }
  function Wn(t, r, n, o, a, u) {
    const d = 15 + a.length + u.length, b = new DataView(t.buffer, t.byteOffset + r, d);
    return b.setUint32(4, n >>> 0, true), t[r + 8] = o & 255, b.setUint16(9, a.length, true), b.setUint32(11, u.length, true), t.set(a, r + 15), t.set(u, r + 15 + a.length), b.setUint32(0, Mn(t, r + 4, r + d), true), d;
  }
  function ir(t, r, n = true) {
    if (r + 15 > t.length)
      return null;
    const o = new DataView(t.buffer, t.byteOffset, t.byteLength), a = o.getUint32(r, true), u = o.getUint32(r + 4, true), d = t[r + 8], b = o.getUint16(r + 9, true), h = o.getUint32(r + 11, true), F = 15 + b + h;
    if (r + F > t.length || n && Mn(t, r + 4, r + F) !== a)
      return null;
    const A = r + 15, T = A + b;
    return { seq: u, flags: d, total: F, key: t.subarray(A, T), value: t.subarray(T, T + h) };
  }
  var Ke = 256 * 1024, Vo = 0.4, Ho = 1000, Go = 8, jo = 16, qo = new TextEncoder, Ko = new TextDecoder, Nr = (t) => qo.encode(t), Lr = (t) => Ko.decode(t), Un = () => Date.now(), Vn = new Uint8Array(0), Hn = 1397442609, Br = new Function("m", "return import(m);"), Mr = (t, r) => t && t[r] ? t : t && t.default || t, Wr = class {
    constructor() {
      this.kind = "memory", this._segs = new Map, this._meta = new Map;
    }
    listSegments() {
      return [...this._segs.keys()].sort((t, r) => t - r);
    }
    appendSegment(t, r) {
      const n = this._segs.get(t);
      if (!n) {
        this._segs.set(t, r.slice());
        return;
      }
      const o = new Uint8Array(n.length + r.length);
      o.set(n), o.set(r, n.length), this._segs.set(t, o);
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
    constructor(t, r, n) {
      this.kind = "fs", this._fs = t, this._p = r, this.root = n;
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
      return t.filter((r) => /^seg-\d+\.log$/.test(r)).map((r) => parseInt(r.slice(4), 10)).sort((r, n) => r - n);
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
    constructor(t, r, n, o) {
      this.kind = "mmap", this.directActive = true, this._mmap = t, this._fs = r, this._p = n, this.root = o, this._open = new Map;
      try {
        for (const a of r.readdirSync(o))
          if (a.endsWith(".dead"))
            try {
              r.unlinkSync(n.join(o, a));
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
      const n = this._mmap(this._segPath(t), { shared: true });
      let o = 0;
      for (;o < n.length; ) {
        const a = ir(n, o);
        if (!a)
          break;
        o += a.total;
      }
      return r = { mapped: n, cursor: o }, this._open.set(t, r), this._evictOpen(t), r;
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
      const n = this._segPath(t);
      this._fs.writeFileSync(n, new Uint8Array(r));
      const o = { mapped: this._mmap(n, { shared: true }), cursor: 0 };
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
      return t.filter((r) => /^seg-\d+\.log$/.test(r)).map((r) => parseInt(r.slice(4), 10)).sort((r, n) => r - n);
    }
    segmentLen(t) {
      try {
        return this._handle(t).cursor;
      } catch {
        return 0;
      }
    }
    reserve(t, r) {
      const n = this._handle(t), o = n.cursor;
      return n.cursor += r, { mapped: n.mapped, offset: o };
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
    let r, n, o;
    try {
      const d = Promise.all([Br("node:fs"), Br("node:os"), Br("node:path")]), b = new Promise((T, D) => setTimeout(() => D(new Error("module import timed out")), 2000)), [h, F, A] = await Promise.race([d, b]);
      if (r = Mr(h, "readFileSync"), n = Mr(F, "tmpdir"), o = Mr(A, "join"), typeof r.readFileSync != "function" || typeof r.writeFileSync != "function" || typeof n.tmpdir != "function" || typeof o.join != "function")
        return Ot(new Wr, "node:fs/os/path resolved but missing methods");
    } catch (d) {
      return Ot(new Wr, "node: import failed \u2014 " + (d && d.message || d));
    }
    const a = t && t.length ? t : o.join(n.tmpdir(), "skal-store");
    let u = "";
    try {
      if (typeof Bun < "u" && typeof Bun.mmap == "function") {
        const d = o.join(a, "mmap");
        r.mkdirSync(d, { recursive: true });
        const b = o.join(d, ".mmap-probe");
        r.writeFileSync(b, new Uint8Array(64));
        const h = Bun.mmap(b, { shared: true });
        if (h && h.length >= 64)
          return Ot(new Jo((F, A) => Bun.mmap(F, A), r, o, d), "mmap @ " + d);
        u += "Bun.mmap probe unusable; ";
      } else
        u += "Bun.mmap absent; ";
    } catch (d) {
      u += "mmap \u2014 " + (d && d.message || d) + "; ";
    }
    try {
      if (typeof r.appendFileSync == "function") {
        const d = o.join(a, "fs");
        return r.mkdirSync(d, { recursive: true }), r.writeFileSync(o.join(d, ".fs-probe"), new Uint8Array(1)), Ot(new Xo(r, o, d), u + "fs @ " + d);
      }
      u += "fs.appendFileSync absent; ";
    } catch (d) {
      u += "fs \u2014 " + (d && d.message || d) + "; ";
    }
    return Ot(new Wr, u + "memory fallback");
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
        const d = r ? r.tail.id : 0;
        this._active = this._b.directActive ? { id: d, direct: true } : { id: d, buf: new Uint8Array(Ke), len: 0, persisted: 0 };
        return;
      }
      const n = t[t.length - 1], o = r ? r.tail.id : n, a = r ? r.tail.id : t[0];
      let u = null;
      for (const d of t) {
        if (d < a)
          continue;
        const b = this._b.getSegment(d) || new Uint8Array(0);
        let h = r && d === r.tail.id ? r.tail.len : 0;
        for (;h < b.length; ) {
          const F = ir(b, h);
          if (!F)
            break;
          const A = Lr(F.key), T = this._keydir.get(A);
          T && this._addDead(T.seg, T.len), F.flags & 1 ? (this._keydir.delete(A), this._addDead(d, F.total)) : this._keydir.set(A, { seg: d, off: h, len: F.total, seq: F.seq }), F.seq > this._seq && (this._seq = F.seq), h += F.total;
        }
        d === o ? u = b : this._cacheSet(d, b);
      }
      if (this._cache.delete(o), this._b.directActive)
        this._b.getSegment(o), this._active = { id: o, direct: true };
      else {
        u == null && (u = this._b.getSegment(o) || new Uint8Array(0));
        const d = new Uint8Array(Math.max(Ke, u.length));
        d.set(u), this._active = { id: o, buf: d, len: u.length, persisted: u.length };
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
      const n = new DataView(r.buffer, r.byteOffset, r.byteLength);
      if (n.getUint32(0, true) !== Hn)
        return null;
      const o = n.getUint32(4, true), a = n.getUint32(8, true), u = n.getUint32(12, true), d = n.getUint32(16, true), b = new Set(t), h = new Map;
      let F = 20;
      try {
        for (let D = 0;D < d; D++) {
          const m = n.getUint16(F, true);
          if (F += 2, F + m + 16 > r.length)
            return null;
          const x = Lr(r.subarray(F, F + m));
          F += m;
          const E = n.getUint32(F, true);
          F += 4;
          const z = n.getUint32(F, true);
          F += 4;
          const j = n.getUint32(F, true);
          F += 4;
          const P = n.getUint32(F, true);
          if (F += 4, !b.has(E))
            return null;
          h.set(x, { seg: E, off: z, len: j, seq: P });
        }
        const A = n.getUint32(F, true);
        F += 4;
        const T = new Map;
        for (let D = 0;D < A; D++) {
          const m = n.getUint32(F, true);
          F += 4, T.set(m, n.getUint32(F, true)), F += 4;
        }
        return !b.has(a) && u !== 0 ? null : { seq: o, tail: { id: a, len: u }, keydir: h, dead: T };
      } catch {
        return null;
      }
    }
    _tailLen() {
      const t = this._active;
      return t ? t.direct ? this._b.segmentLen(t.id) : t.persisted : 0;
    }
    _writeHint() {
      this._lastHintMs = Un();
      const t = this._active, r = [];
      let n = 20;
      for (const [d, b] of this._keydir) {
        const h = Nr(d);
        r.push([h, b]), n += 2 + h.length + 16;
      }
      n += 4 + this._dead.size * 8;
      const o = new Uint8Array(n), a = new DataView(o.buffer);
      a.setUint32(0, Hn, true), a.setUint32(4, this._seq >>> 0, true), a.setUint32(8, t ? t.id : 0, true), a.setUint32(12, this._tailLen(), true), a.setUint32(16, r.length, true);
      let u = 20;
      for (const [d, b] of r)
        a.setUint16(u, d.length, true), u += 2, o.set(d, u), u += d.length, a.setUint32(u, b.seg, true), u += 4, a.setUint32(u, b.off, true), u += 4, a.setUint32(u, b.len, true), u += 4, a.setUint32(u, b.seq >>> 0, true), u += 4;
      a.setUint32(u, this._dead.size, true), u += 4;
      for (const [d, b] of this._dead)
        a.setUint32(u, d, true), u += 4, a.setUint32(u, b, true), u += 4;
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
      t.len > t.persisted && this._b.appendSegment(t.id, t.buf.subarray(t.persisted, t.len)), this._cacheSet(t.id, t.buf.slice(0, t.len)), this._active = { id: t.id + 1, buf: new Uint8Array(Ke), len: 0, persisted: 0 };
    }
    _writeFrame(t, r, n, o) {
      const a = 15 + n.length + o.length, u = this._active;
      if (u.direct) {
        const h = this._b.segmentCapacity(u.id);
        h === 0 ? this._b.createSegment(u.id, Math.max(Ke, a)) : this._b.segmentLen(u.id) + a > h && (this._seal(), this._b.createSegment(this._active.id, Math.max(Ke, a)));
        const F = this._b.reserve(this._active.id, a);
        return Wn(F.mapped, F.offset, t, r, n, o), F.offset;
      }
      u.len > 0 && u.len + a > Ke && this._seal();
      const d = this._active;
      if (d.len + a > d.buf.length) {
        const h = new Uint8Array(Math.max(d.buf.length * 2, d.len + a));
        h.set(d.buf.subarray(0, d.len)), d.buf = h;
      }
      const b = d.len;
      return Wn(d.buf, b, t, r, n, o), d.len += a, b;
    }
    put(t, r) {
      const n = ++this._seq, o = Nr(t), a = this._writeFrame(n, 0, o, r), u = this._keydir.get(t);
      u && this._addDead(u.seg, u.len), this._keydir.set(t, { seg: this._active.id, off: a, len: 15 + o.length + r.length, seq: n });
    }
    del(t) {
      const r = this._keydir.get(t);
      r && (this._writeFrame(++this._seq, 1, Nr(t), Vn), this._addDead(r.seg, r.len), this._keydir.delete(t));
    }
    delPrefix(t) {
      if (!t)
        return;
      const r = t + ".", n = t + "#", o = [];
      for (const a of this._keydir.keys())
        (a.startsWith(r) || a.startsWith(n)) && o.push(a);
      for (const a of o)
        this.del(a);
    }
    get(t) {
      const r = this._keydir.get(t);
      if (!r)
        return null;
      const n = this._segBytes(r.seg);
      if (!n)
        return null;
      const o = ir(n, r.off, false);
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
      t && !t.direct && t.len > t.persisted && (this._b.appendSegment(t.id, t.buf.subarray(t.persisted, t.len)), t.persisted = t.len), this._b.flush(), Un() - this._lastHintMs >= Ho && this._writeHint();
    }
    compact() {
      let t = -1, r = 0;
      for (const [d, b] of this._dead)
        this._active && d === this._active.id || b > r && (r = b, t = d);
      if (t < 0 || r < Ke * Vo)
        return false;
      const n = this._segBytes(t);
      if (!n)
        return false;
      const o = this._b.listSegments(), a = o.length > 0 && t === o[0];
      let u = 0;
      for (;u < n.length; ) {
        const d = ir(n, u);
        if (!d)
          break;
        const b = Lr(d.key);
        if (d.flags & 1)
          !a && !this._keydir.has(b) && (this._writeFrame(++this._seq, 1, d.key, Vn), this._addDead(this._active.id, 15 + d.key.length));
        else {
          const h = this._keydir.get(b);
          h && h.seg === t && h.off === u && this.put(b, d.value.slice());
        }
        u += d.total;
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
  }, el = 60, tl = 8192, or = Symbol("skal.indexDirty"), rl = new TextEncoder, nl = new TextDecoder;
  function Xe(t) {
    return rl.encode(JSON.stringify(t));
  }
  function xe(t) {
    return JSON.parse(nl.decode(t));
  }
  var Ur = Symbol.for("skal.store"), Ee = (t) => t !== null && typeof t == "object" && !Array.isArray(t), Oe = (t) => Array.isArray(t) && t.every(Ee), Vr = (t) => typeof t == "string" && /^(0|[1-9]\d*)$/.test(t), fe = (t, r) => t ? t + "." + r : r, kt = () => typeof performance < "u" && performance.now ? performance.now() : Date.now();
  function _t(t) {
    if (Array.isArray(t))
      return t.map(_t);
    if (Ee(t)) {
      const r = {};
      for (const n of Object.keys(t))
        r[n] = _t(t[n]);
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
        const n = await Promise.race([co(), new Promise((o, a) => setTimeout(() => a(new Error("getDataDir timeout")), 800))]);
        if (typeof n == "string" && n.length)
          return n;
      } catch {}
      await new Promise((n) => setTimeout(n, 150));
    }
    return "";
  }
  function ol(t, r = {}) {
    const n = { name: r.name || "store", paths: r.paths || null, residentMax: r.residentMax || 1e4, version: r.version || 0, migrate: r.migrate || null };
    let o = false, a = false;
    if (n.paths)
      for (const R in n.paths) {
        const p = n.paths[R];
        p && p.lazy === true && (o = true), p && p.persist === false && (a = true);
      }
    const u = new Map;
    function d(R) {
      const p = u.get(R);
      if (p)
        return p;
      let v = true, O = false;
      if (n.paths) {
        const C = [];
        for (const i in n.paths)
          (i === R || R.startsWith(i + ".")) && C.push(i);
        C.sort((i, s) => i.length - s.length);
        for (const i of C) {
          const s = n.paths[i];
          s.persist !== undefined && (v = s.persist), s.lazy !== undefined && (O = s.lazy);
        }
      }
      const k = { persist: v, lazy: O };
      return u.set(R, k), k;
    }
    const [b, h] = Wo(_t(t)), [F, A] = X(false), [T, D] = X("\u2026"), [m, x] = X(null);
    let E = null;
    const z = new Map, j = new Map, P = new Map, $ = new Set;
    let f = null, S = 0;
    function w(R) {
      const p = j.get(R) || 1;
      return j.set(R, p + 1), String(p);
    }
    function I() {
      f == null && (f = setTimeout(() => {
        f = null, N();
      }, el));
    }
    function N() {
      if (!(!E || z.size === 0 && $.size === 0)) {
        if ($.size > 0) {
          if (E.delPrefix)
            for (const R of $)
              E.delPrefix(R);
          $.clear();
        }
        for (const [R, p] of z)
          if (p === null)
            E.del(R);
          else if (p === or) {
            const v = R.slice(2, -2), O = re(v === "" ? [] : v.split("."));
            Array.isArray(O) && E.put(R, Xe({ ids: O.map((k) => k && k._id), nextId: j.get(v) || O.length + 1 }));
          } else
            E.put(R, p);
        z.clear(), E.flush(), S++;
      }
    }
    function H() {
      f != null && (clearTimeout(f), f = null), N();
    }
    function ae(R) {
      const p = [];
      let v = b;
      for (const O of R)
        if (O !== null && typeof O == "object") {
          let k = -1;
          if (Array.isArray(v)) {
            const C = O.hint;
            C >= 0 && C < v.length && v[C] && v[C]._id === O.__id ? k = C : (k = v.findIndex((i) => i && i._id === O.__id), O.hint = k);
          }
          p.push(k), v = k < 0 ? undefined : v[k];
        } else
          p.push(O), v = v?.[O];
      return { path: p, value: v };
    }
    function re(R) {
      let p = b;
      for (let v = 0;v < R.length; v++) {
        const O = R[v];
        if (O !== null && typeof O == "object") {
          let k = -1;
          if (Array.isArray(p)) {
            const C = O.hint;
            C >= 0 && C < p.length && p[C] && p[C]._id === O.__id ? k = C : (k = p.findIndex((i) => i && i._id === O.__id), O.hint = k);
          }
          p = k < 0 ? undefined : p[k];
        } else
          p = p?.[O];
        if (p == null)
          return;
      }
      return p;
    }
    function be(R, p) {
      let v = b;
      for (let O = 0;O < R.length; O++) {
        const k = R[O];
        if (k !== null && typeof k == "object") {
          let C = -1;
          if (Array.isArray(v)) {
            const i = k.hint;
            i >= 0 && i < v.length && v[i] && v[i]._id === k.__id ? C = i : (C = v.findIndex((s) => s && s._id === k.__id), k.hint = C);
          }
          v = C < 0 ? undefined : v[C];
        } else
          v = v?.[k];
        if (v == null)
          return;
      }
      return v[p];
    }
    function ie(R, ...p) {
      for (let v = 0;v < R.length; v++) {
        const O = R[v];
        if (O !== null && typeof O == "object") {
          const k = ae(R);
          if (k.path.indexOf(-1) >= 0)
            return;
          h(...k.path, ...p);
          return;
        }
      }
      h(...R, ...p);
    }
    const pe = new Map;
    function Ye(R) {
      let p = t;
      for (const v of R.split(".")) {
        if (p == null)
          return;
        p = p[v];
      }
      return _t(p);
    }
    function pt(R) {
      for (pe.delete(R), pe.set(R, true);pe.size > n.residentMax; ) {
        const p = pe.keys().next().value;
        if (p === R)
          break;
        pe.delete(p), ie(p.split("."), Ye(p));
      }
    }
    function lr(R, p) {
      if (!(!E || pe.has(p))) {
        if (Array.isArray(re(R)))
          Et(R, p);
        else {
          const v = E.get("k:" + p);
          v != null && ie(R, xe(v));
        }
        pt(p);
      }
    }
    function Ze(R, p, v, O) {
      if (v) {
        z.set("k:" + v.storeKey, Xe(re(v.solidPath)));
        return;
      }
      if (Oe(O)) {
        for (const k of O)
          z.set("k:" + fe(p, k._id), Xe(k));
        z.set("k:" + p + "#x", or);
        return;
      }
      if (p === "" && Ee(O)) {
        for (const k of Object.keys(O)) {
          const C = fe(p, k);
          d(C).persist && Ze([...R, k], C, null, O[k]);
        }
        return;
      }
      z.set("k:" + p, Xe(O));
    }
    function Dt(R, p) {
      if (Oe(p)) {
        for (const v of p)
          v && v._id != null && z.set("k:" + fe(R, v._id), null);
        z.set("k:" + R + "#x", null);
        return;
      }
      z.set("k:" + R, null), R && p !== null && typeof p == "object" && $.add(R);
    }
    function Hr(R, p, v, O) {
      let k = O;
      !v && Oe(O) && (k = O.map((s) => s._id != null ? s : { ...s, _id: w(p) }));
      let C = false;
      for (let s = 0;s < R.length; s++) {
        const c = R[s];
        if (c !== null && typeof c == "object") {
          C = true;
          break;
        }
      }
      if (C) {
        const s = ae(R);
        if (s.path.indexOf(-1) >= 0)
          return;
        h(...s.path, k);
      } else
        h(...R, k);
      Array.isArray(k) && P.delete(p), p && ge.size > 0 && $e(p, k !== null && typeof k == "object");
      let i = true;
      if (o || a) {
        const s = d(p);
        !v && s.lazy && pt(p), i = s.persist;
      }
      i && (!v && p && k !== null && typeof k == "object" && $.add(p), Ze(R, p, v, k), I());
    }
    const ge = new Map;
    let zt = new Set, Nt = false;
    function Gr() {
      Nt || (Nt = true, queueMicrotask(jr));
    }
    function jr() {
      Nt = false;
      const R = zt;
      zt = new Set;
      for (const p of R)
        if (!p._disposed) {
          p._dirty = false;
          try {
            Ft(p);
          } catch (v) {
            console.error("[skal] effect threw:", v);
          }
        }
    }
    function Ft(R) {
      const { _sps: p, _vals: v } = R;
      for (let O = 0;O < p.length; O++)
        v[O] = re(p[O]);
      R._fn(v);
    }
    function We(R) {
      for (const p of R)
        p._dirty || (p._dirty = true, zt.add(p));
    }
    function $e(R, p) {
      const v = ge.get(R);
      if (v && We(v), p)
        if (R === "")
          for (const [, O] of ge)
            O !== v && We(O);
        else {
          const O = R + ".";
          for (const [k, C] of ge)
            k.startsWith(O) && We(C);
        }
      (v || p) && Gr();
    }
    function ar(R, p) {
      const v = new Array(R.length);
      for (let C = 0;C < R.length; C++)
        v[C] = R[C].split(".");
      const O = { _fn: p, _paths: R, _sps: v, _vals: new Array(R.length), _dirty: false, _disposed: false };
      for (let C = 0;C < R.length; C++) {
        const i = R[C];
        let s = ge.get(i);
        s || (s = new Set, ge.set(i, s)), s.add(O);
      }
      const k = () => {
        if (!O._disposed) {
          O._disposed = true;
          for (let C = 0;C < O._paths.length; C++) {
            const i = ge.get(O._paths[C]);
            i && (i.delete(O), i.size === 0 && ge.delete(O._paths[C]));
          }
        }
      };
      try {
        Ft(O);
      } catch (C) {
        throw k(), C;
      }
      return k;
    }
    const sr = { ready: F, backendKind: T, initTiming: m, flushNow: H, version: () => n.version, pending: () => z.size, flushes: () => S, resident: () => pe.size, engineStats: () => E && E.stats ? E.stats() : null, createEffect: ar }, we = new Map;
    function Qe(R, p, v, O) {
      O === undefined && (O = Array.isArray(re(R)));
      const k = we.get(p);
      if (k !== undefined && k.isArray === O)
        return k.node;
      const C = O ? qr(R, p, v) : cr(R, p, v);
      return we.set(p, { node: C, isArray: O }), we.size > tl && we.delete(we.keys().next().value), C;
    }
    function vt(R) {
      if (R.length) {
        for (const p of we.keys())
          for (const v of R)
            if (p === v || p.startsWith(v + ".") || p.startsWith(v + "#")) {
              we.delete(p);
              break;
            }
      }
    }
    function cr(R, p, v) {
      return new Proxy({}, { get(O, k) {
        if (k === Ur)
          return sr;
        if (typeof k == "symbol")
          return;
        if (o && !v) {
          const i = p ? p + "." + k : k;
          !pe.has(i) && d(i).lazy && De(() => lr(R.length === 0 ? [k] : [...R, k], i));
        }
        const C = be(R, k);
        return C !== null && typeof C == "object" ? Qe(R.length === 0 ? [k] : [...R, k], p ? p + "." + k : k, v, Array.isArray(C)) : C;
      }, set(O, k, C) {
        return typeof k == "symbol" ? false : (Hr(R.length === 0 ? [k] : [...R, k], p ? p + "." + k : k, v, C), true);
      }, has(O, k) {
        const C = re(R);
        return C != null && k in C;
      }, ownKeys() {
        const O = re(R);
        return O ? Reflect.ownKeys(O) : [];
      }, getOwnPropertyDescriptor(O, k) {
        const C = re(R);
        if (C != null && k in C)
          return { enumerable: k !== "_id", configurable: true };
      }, deleteProperty(O, k) {
        if (typeof k == "symbol")
          return false;
        const C = p ? p + "." + k : k, i = re(R.length === 0 ? [k] : [...R, k]);
        return ie(R, nr((s) => {
          s != null && delete s[k];
        })), v ? Ze(R, p, v, null) : (!a || d(C).persist) && Dt(C, i), i !== null && typeof i == "object" && (vt([C]), P.delete(C)), C && ge.size > 0 && $e(C, true), I(), true;
      } });
    }
    function qr(R, p, v) {
      const O = () => re(R) || [], k = () => {
        (v || !a || d(p).persist) && Ze(R, p, v, O()), I();
      };
      function C(c, g, ...y) {
        const W = O(), V = W.length;
        c = c < 0 ? Math.max(0, V + c) : Math.min(c, V), g = g === undefined ? V - c : Math.max(0, Math.min(g, V - c));
        const K = W.slice(c, c + g);
        let q = y;
        if (v || (q = y.map((Q) => Ee(Q) && Q._id == null ? { ...Q, _id: w(p) } : Q)), g === 0 && c === V && q.length > 0)
          for (let Q = 0;Q < q.length; Q++)
            ie([...R, V + Q], q[Q]);
        else
          ie(R, nr((Q) => {
            Q.splice(c, g, ...q);
          }));
        if (!v) {
          const Q = [];
          for (const ce of K)
            if (ce && ce._id != null) {
              const Fe = fe(p, ce._id);
              z.set("k:" + Fe, null), Q.push(Fe);
            }
          vt(Q);
        }
        let Z = false;
        if (!v) {
          const Q = P.get(p);
          Z = Q === undefined ? Oe(W) : Q, Z && (Z = q.every(Ee)), P.set(p, Z);
        }
        if (Z) {
          for (const Q of q)
            Q && Q._id != null && z.set("k:" + fe(p, Q._id), Xe(Q));
          z.set("k:" + p + "#x", or), I();
        } else
          k();
        return ge.size > 0 && $e(p, true), K;
      }
      function i(c, g) {
        ie(R, nr(c));
        const y = P.get(p);
        return g && !v && (y === undefined ? Oe(O()) : y) ? (z.set("k:" + p + "#x", or), I()) : k(), ge.size > 0 && $e(p, true), O();
      }
      const s = { splice: C, push: (...c) => (C(O().length, 0, ...c), O().length), unshift: (...c) => (C(0, 0, ...c), O().length), pop: () => C(O().length - 1, 1)[0], shift: () => C(0, 1)[0], sort: (c) => i((g) => {
        g.sort(c);
      }, true), reverse: () => i((c) => {
        c.reverse();
      }, true), fill: (c, g, y) => i((W) => {
        W.fill(c, g, y);
      }, false), copyWithin: (c, g, y) => i((W) => {
        W.copyWithin(c, g, y);
      }, false) };
      return new Proxy([], { get(c, g) {
        if (g === Ur)
          return sr;
        if (g === "length")
          return O().length;
        if (typeof g == "string" && Object.hasOwn(s, g))
          return s[g];
        if (Vr(g)) {
          const V = O(), K = +g, q = V[K];
          if (q !== null && typeof q == "object") {
            let Z = false;
            if (!v) {
              const Fe = P.get(p);
              Fe === undefined ? (Z = Oe(O()), P.set(p, Z)) : Z = Fe;
            }
            if (Z && q._id != null) {
              const Fe = fe(p, q._id), et = [...R, { __id: q._id, hint: K }];
              return Qe(et, Fe, { solidPath: et, storeKey: Fe }, false);
            }
            const Q = fe(p, g), ce = [...R, K];
            return v ? Qe(ce, Q, v, Array.isArray(q)) : Qe(ce, Q, { solidPath: R, storeKey: p }, Array.isArray(q));
          }
          return q;
        }
        const y = O(), W = y[g];
        return typeof W == "function" ? W.bind(y) : W;
      }, set(c, g, y) {
        if (g === "length") {
          const W = +y;
          let V = null;
          if (!v && W < O().length) {
            const K = P.get(p);
            (K === undefined ? Oe(O()) : K) && (V = O().slice(W));
          }
          if (ie(R, nr((K) => {
            K.length = W;
          })), P.delete(p), V) {
            const K = [];
            for (const q of V)
              if (q && q._id != null) {
                const Z = fe(p, q._id);
                z.set("k:" + Z, null), K.push(Z);
              }
            vt(K);
          }
          return k(), ge.size > 0 && $e(p, true), true;
        }
        if (Vr(g)) {
          const W = +g, V = O()[W];
          let K = y;
          !v && Ee(y) && y._id == null && (K = { ...y, _id: V && V._id != null ? V._id : w(p) }), ie(R, W, K);
          let q = false;
          if (!v) {
            const Z = P.get(p);
            q = Z === undefined ? Oe(O()) : Z, q && !Ee(K) && (q = false), P.set(p, q);
          }
          if (q && K && K._id != null ? (z.set("k:" + fe(p, K._id), Xe(K)), I()) : k(), ge.size > 0) {
            const Z = K !== null && typeof K == "object";
            $e(fe(p, g), Z);
            const Q = K && K._id != null ? K._id : null;
            q && Q != null && $e(fe(p, Q), Z);
            const ce = V && V._id != null ? V._id : null;
            ce != null && ce !== Q && $e(fe(p, ce), true);
          }
          return true;
        }
        return false;
      }, has(c, g) {
        return g === "length" || typeof g == "string" && Object.hasOwn(s, g) ? true : (g in O());
      }, ownKeys() {
        return Reflect.ownKeys(O());
      }, getOwnPropertyDescriptor(c, g) {
        const y = O();
        if (g === "length")
          return { value: y.length, writable: true, enumerable: false, configurable: false };
        if (Vr(g) && +g < y.length)
          return { enumerable: true, configurable: true };
      } });
    }
    function ur(R, p, v) {
      if (Array.isArray(R)) {
        const k = E.get("k:" + p + "#x");
        if (k != null) {
          v.push(p + "#x");
          const i = xe(k), s = [];
          for (const c of i.ids || []) {
            const g = fe(p, c);
            v.push(g);
            const y = E.get("k:" + g);
            y != null && s.push(xe(y));
          }
          return s;
        }
        const C = E.get("k:" + p);
        return C != null ? (v.push(p), xe(C)) : _t(R);
      }
      if (Ee(R)) {
        const k = {};
        for (const C of Object.keys(R))
          k[C] = ur(R[C], fe(p, C), v);
        return k;
      }
      const O = E.get("k:" + p);
      return O != null ? (v.push(p), xe(O)) : R;
    }
    function Lt(R, p) {
      if (Oe(R)) {
        let v = 0;
        for (const O of R) {
          const k = O._id == null ? 0 : +O._id;
          k > v && (v = k);
        }
        v + 1 > (j.get(p) || 1) && j.set(p, v + 1);
        for (const O of R)
          O._id == null && (O._id = w(p));
      } else if (Ee(R))
        for (const v of Object.keys(R))
          Lt(R[v], fe(p, v));
    }
    function Bt(R, p, v) {
      for (const O of Object.keys(R)) {
        const k = R[O], C = [...p, O], i = fe(v, O), s = d(i);
        if (Array.isArray(k))
          s.persist && !s.lazy && Et(C, i);
        else if (Ee(k)) {
          let c = true;
          if (s.persist && !s.lazy && !z.has("k:" + i)) {
            const g = E.get("k:" + i);
            if (g != null) {
              const y = xe(g);
              ie(C, y), Ee(y) || (c = false, E.delPrefix && $.add(i));
            }
          }
          c && Bt(k, C, i);
        } else {
          if (!s.persist || s.lazy || z.has("k:" + i))
            continue;
          const c = E.get("k:" + i);
          if (c != null) {
            const g = xe(c);
            ie(C, g), Ee(g) && Bt(g, C, i);
          }
        }
      }
    }
    function Et(R, p) {
      if (!d(p).persist || z.has("k:" + p + "#x") || z.has("k:" + p))
        return;
      P.delete(p);
      const v = E.get("k:" + p + "#x");
      if (v != null) {
        const k = xe(v);
        j.set(p, k.nextId || 1);
        const C = [];
        for (const i of k.ids || []) {
          const s = E.get("k:" + fe(p, i));
          s != null && C.push(xe(s));
        }
        ie(R, C);
        return;
      }
      const O = E.get("k:" + p);
      O != null && ie(R, xe(O));
    }
    async function Kr() {
      const R = kt();
      let p = R, v = R, O = R;
      try {
        const s = await il();
        if (p = kt(), typeof globalThis.__skal_store_open == "function" && s)
          try {
            const V = new Qo(s + "/" + n.name);
            V.open(), E = V, D("native");
          } catch {
            E = null;
          }
        if (!E) {
          const V = await Yo(s), K = new Zo(V);
          K.open(), E = K, D(V.kind);
        }
        v = kt();
        let c = null;
        const g = E.get("k:#meta");
        if (g != null)
          try {
            c = xe(g);
          } catch {
            c = null;
          }
        const y = c ? c.version | 0 : 0;
        let W = false;
        if (c && c.shape && n.migrate && y < n.version) {
          const V = [], K = ur(c.shape, "", V);
          let q = null;
          try {
            q = n.migrate(K, y);
          } catch {
            q = null;
          }
          if (Ee(q)) {
            for (const Z of V)
              z.set("k:" + Z, null);
            Lt(q, ""), P.clear(), ie([], q), Ze([], "", null, q), W = true;
          }
        }
        (!c || y !== n.version) && z.set("k:#meta", Xe({ version: n.version, shape: _t(t) })), O = kt(), W || Bt(t, [], ""), I();
      } catch {}
      const k = kt(), C = E && E.stats ? E.stats() : null, i = (s) => Math.round(s * 10) / 10;
      x({ total: i(k - R), dir: i(p - R), open: i(v - p), migrate: i(O - v), hydrate: i(k - O), records: C ? C.records : 0 }), A(true);
    }
    return Kr(), Qe([], "", null, Array.isArray(t));
  }
  var ll = "#FFFFFFFF", al = "#FFE5E5EA", Gn = "#FF1C1C1E", jn = "#FF8E8E93", ke = "#FF0A84FF", Be = "#FF34C759", Je = "#FFFF9F0A", It = "#FFFF3B30", bt = "#FF5E5CE6";
  function J(t) {
    return (() => {
      var r = l("column"), n = l("text");
      return _(r, n), e(r, "background", "#FFFFFFFF"), e(r, "cornerRadius", 14), e(r, "padding", 16), e(r, "gap", 12), e(r, "borderWidth", 1), e(r, "borderColor", "#FFE5E5EA"), e(n, "fontSize", 15), e(n, "fontWeight", 800), e(n, "color", "#FF1C1C1E"), B(r, () => t.children, null), G((o) => e(n, "label", t.title, o)), r;
    })();
  }
  function sl(t) {
    const r = ["Inbox", "Starred", "Drafts", "Archive"];
    return [(() => {
      var n = l("column");
      return e(n, "background", "#FFF2F2F7"), e(n, "padding", 16), e(n, "gap", 8), e(n, "height", "fill"), B(n, L(oe, { each: r, children: (o) => (() => {
        var a = l("box"), u = l("text");
        return _(a, u), e(a, "background", "#FFFFFFFF"), e(a, "cornerRadius", 8), e(a, "padding", 12), e(a, "onTap", () => t.router.navigate("detail", { name: o }, { title: o })), e(u, "label", `${o}   \u203A`), e(u, "fontSize", 14), e(u, "color", "#FF1C1C1E"), a;
      })() })), n;
    })(), (() => {
      var n = l("drawer"), o = l("box"), a = l("text");
      return _(n, o), e(n, "background", "#FFFFFFFF"), _(o, a), e(o, "padding", 20), e(o, "background", "#FF0A84FF"), e(a, "label", "Mail"), e(a, "fontSize", 20), e(a, "fontWeight", 800), e(a, "color", "#FFFFFF"), B(n, L(oe, { each: r, children: (u) => (() => {
        var d = l("box"), b = l("text");
        return _(d, b), e(d, "padding", 14), e(b, "label", u), e(b, "fontSize", 14), e(b, "color", "#FF1C1C1E"), d;
      })() }), null), n;
    })()];
  }
  function cl(t) {
    return (() => {
      var r = l("column"), n = l("text"), o = l("text");
      return _(r, n), _(r, o), e(r, "background", "#FFF2F2F7"), e(r, "padding", 16), e(r, "gap", 10), e(r, "height", "fill"), e(n, "fontSize", 20), e(n, "fontWeight", 800), e(n, "color", "#FF1C1C1E"), e(o, "label", "The AppBar's \u2039 back button (and the system back / swipe gesture) all pop this route. The list screen behind stayed mounted \u2014 back is instant, no re-render, scroll preserved."), e(o, "fontSize", 13), e(o, "color", "#FF8E8E93"), G((a) => e(n, "label", t.name, a)), r;
    })();
  }
  var ul = [ke, Be, Je, bt];
  function fl() {
    const [t, r] = X(false), [n, o] = X(false), [a, u] = X(false), [d, b] = X(0), [h, F] = X("0, 0"), [A, T] = X(false), [D, m] = X(["Alpha", "Beta", "Gamma"]);
    let x = 3;
    const E = zr({ gallery: (z) => (() => {
      var j = l("column"), P = l("text"), $ = l("row");
      return _(j, P), _(j, $), e(j, "background", "#FFF2F2F7"), e(j, "padding", 16), e(j, "gap", 12), e(j, "height", "fill"), e(P, "label", "Tap a swatch \u2014 it flies to the detail screen."), e(P, "fontSize", 13), e(P, "color", "#FF8E8E93"), e($, "gap", 12), B($, L(oe, { each: ul, children: (f) => (() => {
        var S = l("hero"), w = l("box");
        return _(S, w), e(S, "tag", `hero-${f}`), e(w, "width", 56), e(w, "height", 56), e(w, "background", f), e(w, "cornerRadius", 12), e(w, "onTap", () => z.router.navigate("detail", { color: f })), S;
      })() })), j;
    })(), detail: { component: (z) => (() => {
      var j = l("column"), P = l("hero"), $ = l("box"), f = l("text");
      return _(j, P), _(j, f), e(j, "background", "#FFF2F2F7"), e(j, "padding", 16), e(j, "gap", 12), e(j, "height", "fill"), _(P, $), e($, "width", "fill"), e($, "height", 180), e($, "cornerRadius", 20), e(f, "label", "The swatch flew here from the gallery \u2014 a shared-element transition, GPU-composited host-side."), e(f, "fontSize", 13), e(f, "color", "#FF8E8E93"), G((S) => {
        var w = `hero-${z.params.color}`, I = z.params.color;
        return w !== S.e && (S.e = e(P, "tag", w, S.e)), I !== S.t && (S.t = e($, "background", I, S.t)), S;
      }, { e: undefined, t: undefined }), j;
    })(), title: "Detail", transition: "fade" } }, "gallery");
    return (() => {
      var z = l("scrollView"), j = l("text"), P = l("text"), $ = l("text");
      return _(z, j), _(z, P), _(z, $), e(z, "background", "#FFF2F2F7"), e(z, "padding", 16), e(z, "gap", 14), e(j, "label", "Animations"), e(j, "fontSize", 24), e(j, "fontWeight", 800), e(j, "color", "#FF1C1C1E"), e(P, "label", "Host-side motion \u2014 JS flips one signal, Flutter runs the whole tween. Zero per-frame bridge traffic. See ANIMATION.md for the full plan."), e(P, "fontSize", 13), e(P, "color", "#FF8E8E93"), B(z, L(J, { title: "Implicit hot-prop tween \u2014 the animate prop", get children() {
        return [(() => {
          var f = l("row"), S = l("box");
          return _(f, S), e(f, "gap", 8), e(S, "width", 64), e(S, "height", 64), e(S, "background", "#FF0A84FF"), e(S, "cornerRadius", 14), e(S, "animate", { duration: 450, curve: "easeInOut" }), G((w) => {
            var I = t() ? 0.3 : 1, N = t() ? 1.4 : 1, H = t() ? 1.4 : 1, ae = t() ? 0.5 : 0, re = t() ? 70 : 0;
            return I !== w.e && (w.e = e(S, "opacity", I, w.e)), N !== w.t && (w.t = e(S, "scaleX", N, w.t)), H !== w.a && (w.a = e(S, "scaleY", H, w.a)), ae !== w.o && (w.o = e(S, "rotation", ae, w.o)), re !== w.i && (w.i = e(S, "translationX", re, w.i)), w;
          }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined }), f;
        })(), (() => {
          var f = l("button");
          return e(f, "onClick", () => r(!t())), G((S) => e(f, "label", t() ? "Reset" : "Animate", S)), f;
        })(), (() => {
          var f = l("text");
          return e(f, "label", "opacity + scale + rotation + translation tween together \u2014 JS only flips one signal; the whole tween runs host-side."), e(f, "fontSize", 11), e(f, "color", "#FF8E8E93"), f;
        })()];
      } }), $), B(z, L(J, { title: "Cold-prop tween \u2014 colour \xB7 radius \xB7 padding", get children() {
        return [(() => {
          var f = l("box"), S = l("text");
          return _(f, S), e(f, "animate", { duration: 400, curve: "easeInOut" }), e(f, "width", "fill"), e(S, "label", "AnimatedContainer tweens these host-side"), e(S, "fontSize", 12), e(S, "color", "#FFFFFFFF"), G((w) => {
            var I = n() ? It : ke, N = n() ? 32 : 8, H = n() ? 28 : 12;
            return I !== w.e && (w.e = e(f, "background", I, w.e)), N !== w.t && (w.t = e(f, "cornerRadius", N, w.t)), H !== w.a && (w.a = e(f, "padding", H, w.a)), w;
          }, { e: undefined, t: undefined, a: undefined }), f;
        })(), (() => {
          var f = l("button");
          return e(f, "onClick", () => o(!n())), G((S) => e(f, "label", n() ? "Reset" : "Animate", S)), f;
        })(), (() => {
          var f = l("text");
          return e(f, "label", "background, cornerRadius and padding are cold props \u2014 the host's AnimatedContainer tweens them; JS writes each value once."), e(f, "fontSize", 11), e(f, "color", "#FF8E8E93"), f;
        })()];
      } }), $), B(z, L(J, { title: "Looping \u2014 repeat \xB7 reverse", get children() {
        return [(() => {
          var f = l("row"), S = l("box"), w = l("box"), I = l("box");
          return _(f, S), _(f, w), _(f, I), e(f, "gap", 20), e(S, "width", 44), e(S, "height", 44), e(S, "background", "#FF5E5CE6"), e(S, "cornerRadius", 22), e(S, "animate", { duration: 800, curve: "easeInOut", repeat: true, reverse: true }), e(S, "scaleX", 1.35), e(S, "scaleY", 1.35), e(w, "width", 44), e(w, "height", 44), e(w, "background", "#FF34C759"), e(w, "cornerRadius", 10), e(w, "animate", { duration: 1400, repeat: true }), e(w, "rotation", 6.2832), e(I, "width", 44), e(I, "height", 44), e(I, "background", "#FFFF9F0A"), e(I, "cornerRadius", 22), e(I, "animate", { duration: 900, curve: "easeInOut", repeat: true, reverse: true }), e(I, "opacity", 0.25), f;
        })(), (() => {
          var f = l("text");
          return e(f, "label", "A pulse, a spin and a breathe \u2014 each loops forever host-side; JS set the endpoints once and never touches them again."), e(f, "fontSize", 11), e(f, "color", "#FF8E8E93"), f;
        })()];
      } }), $), B(z, L(J, { title: "Spring physics \u2014 animate.spring", get children() {
        return [(() => {
          var f = l("column"), S = l("box"), w = l("box"), I = l("box");
          return _(f, S), _(f, w), _(f, I), e(f, "gap", 10), e(S, "width", 48), e(S, "height", 48), e(S, "background", "#FF0A84FF"), e(S, "cornerRadius", 10), e(S, "animate", { duration: 700, spring: "gentle" }), e(w, "width", 48), e(w, "height", 48), e(w, "background", "#FF34C759"), e(w, "cornerRadius", 10), e(w, "animate", { duration: 700, spring: "bouncy" }), e(I, "width", 48), e(I, "height", 48), e(I, "background", "#FFFF9F0A"), e(I, "cornerRadius", 10), e(I, "animate", { duration: 700, spring: "stiff" }), G((N) => {
            var H = a() ? 150 : 0, ae = a() ? 150 : 0, re = a() ? 150 : 0;
            return H !== N.e && (N.e = e(S, "translationX", H, N.e)), ae !== N.t && (N.t = e(w, "translationX", ae, N.t)), re !== N.a && (N.a = e(I, "translationX", re, N.a)), N;
          }, { e: undefined, t: undefined, a: undefined }), f;
        })(), (() => {
          var f = l("button");
          return e(f, "onClick", () => u(!a())), G((S) => e(f, "label", a() ? "Back" : "Spring", S)), f;
        })(), (() => {
          var f = l("text");
          return e(f, "label", "gentle \xB7 bouncy \xB7 stiff \u2014 three spring-like curves; bouncy overshoots and wobbles into place."), e(f, "fontSize", 11), e(f, "color", "#FF8E8E93"), f;
        })()];
      } }), $), B(z, L(J, { title: "Physics \u2014 real SpringSimulation (spring)", get children() {
        return [(() => {
          var f = l("column"), S = l("box"), w = l("box"), I = l("box");
          return _(f, S), _(f, w), _(f, I), e(f, "gap", 12), e(S, "width", 52), e(S, "height", 52), e(S, "background", "#FF0A84FF"), e(S, "cornerRadius", 12), e(S, "spring", "gentle"), e(w, "width", 52), e(w, "height", 52), e(w, "background", "#FF34C759"), e(w, "cornerRadius", 12), e(w, "spring", "bouncy"), e(I, "width", 52), e(I, "height", 52), e(I, "background", "#FFFF9F0A"), e(I, "cornerRadius", 12), e(I, "spring", "stiff"), G((N) => {
            var H = d(), ae = d(), re = d();
            return H !== N.e && (N.e = e(S, "translationX", H, N.e)), ae !== N.t && (N.t = e(w, "translationX", ae, N.t)), re !== N.a && (N.a = e(I, "translationX", re, N.a)), N;
          }, { e: undefined, t: undefined, a: undefined }), f;
        })(), (() => {
          var f = l("button");
          return e(f, "onClick", () => b(d() === 0 ? 175 : 0)), G((S) => e(f, "label", d() === 0 ? "Spring" : "Back", S)), f;
        })(), (() => {
          var f = l("text");
          return e(f, "label", "A real SpringSimulation drives these \u2014 not a curve. Tap fast: the box retargets from its CURRENT position and velocity mid-flight, with no dead-stop restart. gentle settles, bouncy overshoots, stiff snaps."), e(f, "fontSize", 11), e(f, "color", "#FF8E8E93"), f;
        })()];
      } }), $), B(z, L(J, { title: "Physics \u2014 release momentum (draggable + release)", get children() {
        return [(() => {
          var f = l("box"), S = l("box"), w = l("text");
          return _(f, S), e(f, "height", 150), e(f, "background", "#FFEFEFF4"), e(f, "cornerRadius", 12), _(S, w), e(S, "draggable", true), e(S, "release", "glide"), e(S, "width", 60), e(S, "height", 60), e(S, "background", "#FF0A84FF"), e(S, "cornerRadius", 14), e(S, "onPanEnd", (I, N) => F(`${I.toFixed(0)}, ${N.toFixed(0)}`)), e(w, "label", "glide"), e(w, "fontSize", 11), e(w, "color", "#FFFFFFFF"), f;
        })(), (() => {
          var f = l("text");
          return e(f, "fontSize", 11), e(f, "color", "#FF8E8E93"), G((S) => e(f, "label", `Throw the blue box \u2014 friction carries it on after you let go and decelerates it to rest. Resting at ${h()}.`, S)), f;
        })(), (() => {
          var f = l("box"), S = l("box"), w = l("text");
          return _(f, S), e(f, "height", 150), e(f, "background", "#FFEFEFF4"), e(f, "cornerRadius", 12), _(S, w), e(S, "draggable", true), e(S, "release", "springBack"), e(S, "width", 60), e(S, "height", 60), e(S, "background", "#FF5E5CE6"), e(S, "cornerRadius", 14), e(w, "label", "spring"), e(w, "fontSize", 11), e(w, "color", "#FFFFFFFF"), f;
        })(), (() => {
          var f = l("text");
          return e(f, "label", "Throw the purple box \u2014 a SpringSimulation springs it home to the origin, seeded with your fling velocity (throw harder \u2192 springs back harder). All host-side: zero per-frame bridge traffic."), e(f, "fontSize", 11), e(f, "color", "#FF8E8E93"), f;
        })()];
      } }), $), B(z, L(J, { title: "Cross-fade \u2014 CrossFade", get children() {
        return [(() => {
          var f = l("box"), S = l("crossFade");
          return _(f, S), e(f, "height", 92), B(S, (() => {
            var w = Dr(() => !!A());
            return () => w() ? (() => {
              var I = l("box"), N = l("text");
              return _(I, N), e(I, "width", "fill"), e(I, "height", 92), e(I, "background", "#FF5E5CE6"), e(I, "cornerRadius", 12), e(I, "padding", 16), e(N, "label", "Panel B"), e(N, "fontSize", 16), e(N, "fontWeight", 800), e(N, "color", "#FFFFFFFF"), I;
            })() : (() => {
              var I = l("box"), N = l("text");
              return _(I, N), e(I, "width", "fill"), e(I, "height", 92), e(I, "background", "#FF0A84FF"), e(I, "cornerRadius", 12), e(I, "padding", 16), e(N, "label", "Panel A"), e(N, "fontSize", 16), e(N, "fontWeight", 800), e(N, "color", "#FFFFFFFF"), I;
            })();
          })()), f;
        })(), (() => {
          var f = l("button");
          return e(f, "label", "Swap panel"), e(f, "onClick", () => T(!A())), f;
        })(), (() => {
          var f = l("text");
          return e(f, "label", "AnimatedSwitcher fades the old child out as the new fades in \u2014 the outgoing element is retained through the fade."), e(f, "fontSize", 11), e(f, "color", "#FF8E8E93"), f;
        })()];
      } }), $), B(z, L(J, { title: "Animated list \u2014 AnimatedList", get children() {
        return [(() => {
          var f = l("animatedList");
          return e(f, "gap", 8), B(f, L(oe, { get each() {
            return D();
          }, children: (S) => (() => {
            var w = l("box"), I = l("text");
            return _(w, I), e(w, "background", "#FFEFEFF4"), e(w, "cornerRadius", 8), e(w, "padding", 12), e(I, "label", S), e(I, "fontSize", 13), e(I, "color", "#FF1C1C1E"), w;
          })() })), f;
        })(), (() => {
          var f = l("row"), S = l("button"), w = l("button");
          return _(f, S), _(f, w), e(f, "gap", 8), e(S, "label", "Add"), e(S, "onClick", () => m([...D(), `Item ${++x}`])), e(w, "label", "Remove"), e(w, "onClick", () => m(D().slice(0, -1))), f;
        })(), (() => {
          var f = l("text");
          return e(f, "label", "Add \u2192 a row fades + expands in; Remove \u2192 it collapses + fades out. Both host-side, via deferred teardown."), e(f, "fontSize", 11), e(f, "color", "#FF8E8E93"), f;
        })()];
      } }), $), B(z, L(J, { title: "Shared element \u2014 Hero", get children() {
        return [(() => {
          var f = l("box");
          return e(f, "height", 300), e(f, "borderWidth", 1), e(f, "borderColor", "#FFE5E5EA"), e(f, "cornerRadius", 8), B(f, L(E.View, {})), f;
        })(), (() => {
          var f = l("text");
          return e(f, "label", "A Hero with a matching tag on each screen flies between them across the navigator push \u2014 the navigator is a real Flutter Navigator."), e(f, "fontSize", 11), e(f, "color", "#FF8E8E93"), f;
        })()];
      } }), $), e($, "label", "\u2014 end of animations \u2014"), e($, "fontSize", 12), e($, "color", "#FF8E8E93"), z;
    })();
  }
  function dl() {
    const [t, r] = X("material"), [n, o] = X(false), [a, u] = X(true), [d, b] = X(false), [h, F] = X(40), [A, T] = X(""), [D, m] = X("none yet"), [x, E] = X(0), [z, j] = X(["Item one", "Item two", "Item three", "Item four"]);
    let P = 0;
    const [$, f] = X([]), [S, w] = X([]), [I, N] = X("M"), [H, ae] = X([]), [re, be] = X(0), [ie, pe] = X(false), [Ye, pt] = X(0), [lr, Ze] = X(0), [Dt, Hr] = X(false), [ge, zt] = X("\u2014"), [Nt, Gr] = X("0, 0"), [jr, Ft] = X("\u2014"), [We, $e] = X(1);
    let ar = 1;
    const [sr, we] = X("\u2014 try a dialog button \u2014"), [Qe, vt] = X("\u2014 no date / time picked \u2014"), [cr, qr] = X(["First item", "Second item", "Third item", "Fourth item"]), ur = zr({ list: { component: (p) => L(sl, { get router() {
      return p.router;
    } }), title: "Mailboxes" }, detail: (p) => L(cl, { get name() {
      return p.params.name;
    }, get router() {
      return p.router;
    } }) }, "list"), [Lt, Bt] = X(0), Et = (p, v) => {
      r(p), o(v), io(p, v ? 1 : 0);
    }, Kr = zr({ home: { component: (p) => R(p.router) }, animations: { component: () => L(fl, {}), title: "Animations" } }, "home");
    function R(p) {
      return (() => {
        var v = l("scrollView"), O = l("text"), k = l("text"), C = l("text");
        return _(v, O), _(v, k), _(v, C), e(v, "background", "#FFF2F2F7"), e(v, "padding", 16), e(v, "gap", 14), e(v, "scrollbar", true), e(O, "label", "Skal \u2014 Component Demo"), e(O, "fontSize", 24), e(O, "fontWeight", 800), e(O, "color", "#FF1C1C1E"), e(k, "label", "Every fast-path widget, plus animation, the design system, and dialogs."), e(k, "fontSize", 13), e(k, "color", "#FF8E8E93"), B(v, L(J, { title: "Design system \u2014 setDesign()", get children() {
          return [(() => {
            var i = l("text");
            return e(i, "fontSize", 13), e(i, "color", "#FF8E8E93"), G((s) => e(i, "label", `active: ${t()} \xB7 ${n() ? "dark" : "light"}`, s)), i;
          })(), (() => {
            var i = l("row"), s = l("button"), c = l("button"), g = l("button");
            return _(i, s), _(i, c), _(i, g), e(i, "gap", 8), e(s, "label", "Material"), e(s, "onClick", () => Et("material", n())), e(c, "label", "Cupertino"), e(c, "onClick", () => Et("cupertino", n())), e(g, "onClick", () => Et(t(), !n())), G((y) => e(g, "label", n() ? "Light mode" : "Dark mode", y)), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "Buttons, switches, sliders, the text field & spinner all swap Material\u2194Cupertino."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })()];
        } }), C), B(v, L(J, { title: "Layout \u2014 box \xB7 row \xB7 wrap", get children() {
          return [(() => {
            var i = l("row"), s = l("box"), c = l("box"), g = l("box");
            return _(i, s), _(i, c), _(i, g), e(i, "gap", 8), e(s, "width", 56), e(s, "height", 56), e(s, "background", "#FF0A84FF"), e(s, "cornerRadius", 10), e(c, "width", 56), e(c, "height", 56), e(c, "background", "#FF34C759"), e(c, "cornerRadius", 10), e(g, "width", 56), e(g, "height", 56), e(g, "background", "#FFFF9F0A"), e(g, "cornerRadius", 10), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "Wrap \u2014 children flow onto new runs:"), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = l("wrap");
            return e(i, "gap", 6), B(i, L(oe, { each: ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa"], children: (s) => (() => {
              var c = l("box"), g = l("text");
              return _(c, g), e(c, "background", "#FFEFEFF4"), e(c, "cornerRadius", 12), e(c, "paddingLeft", 10), e(c, "paddingRight", 10), e(c, "paddingTop", 6), e(c, "paddingBottom", 6), e(g, "label", s), e(g, "fontSize", 12), e(g, "color", "#FF1C1C1E"), c;
            })() })), i;
          })()];
        } }), C), B(v, L(J, { title: "Stack \u2014 overlap + positioned children", get children() {
          var i = l("stack"), s = l("box"), c = l("box"), g = l("text"), y = l("box");
          return _(i, s), _(i, c), _(i, y), e(i, "width", "fill"), e(i, "height", 120), e(s, "width", "fill"), e(s, "height", 120), e(s, "background", "#FF5E5CE6"), e(s, "cornerRadius", 12), _(c, g), e(c, "top", 10), e(c, "left", 10), e(c, "background", "#FFFFFFFF"), e(c, "cornerRadius", 8), e(c, "paddingLeft", 10), e(c, "paddingRight", 10), e(c, "paddingTop", 4), e(c, "paddingBottom", 4), e(g, "label", "top \xB7 left"), e(g, "fontSize", 11), e(g, "color", "#FF1C1C1E"), e(y, "bottom", 10), e(y, "right", 10), e(y, "width", 30), e(y, "height", 30), e(y, "background", "#FFFF3B30"), e(y, "cornerRadius", 15), i;
        } }), C), B(v, L(J, { title: "Text & RichText", get children() {
          return [(() => {
            var i = l("text");
            return e(i, "label", "Styled text \u2014 18sp, weight 700."), e(i, "fontSize", 18), e(i, "fontWeight", 700), e(i, "color", "#FF1C1C1E"), i;
          })(), (() => {
            var i = l("richText"), s = l("text"), c = l("text"), g = l("text"), y = l("text"), W = l("text");
            return _(i, s), _(i, c), _(i, g), _(i, y), _(i, W), e(s, "label", "Rich text "), e(s, "fontSize", 16), e(s, "color", "#FF1C1C1E"), e(c, "label", "mixes "), e(c, "fontSize", 16), e(c, "color", "#FF0A84FF"), e(c, "fontWeight", 800), e(g, "label", "size, "), e(g, "fontSize", 22), e(g, "color", "#FFFF3B30"), e(g, "fontWeight", 700), e(y, "label", "weight "), e(y, "fontSize", 16), e(y, "color", "#FF34C759"), e(y, "fontWeight", 800), e(W, "label", "and colour inline."), e(W, "fontSize", 16), e(W, "color", "#FF1C1C1E"), i;
          })()];
        } }), C), B(v, L(J, { title: "Image \u2014 network \xB7 BoxFit \xB7 rounded", get children() {
          return [(() => {
            var i = l("image");
            return e(i, "src", "https://picsum.photos/seed/skal/640/360"), e(i, "width", "fill"), e(i, "height", 160), e(i, "contentScale", 1), e(i, "cornerRadius", 12), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "contentScale=1 (cover); cornerRadius clips the pixels. Requires network."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })()];
        } }), C), B(v, L(J, { title: "Scrolling \u2014 horizontal list \xB7 lazy grid \xB7 reorderable", get children() {
          return [(() => {
            var i = l("text");
            return e(i, "label", "listView axis=1 (horizontal, virtualized):"), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = l("listView");
            return e(i, "axis", 1), e(i, "height", 66), e(i, "gap", 8), B(i, L(oe, { each: [ke, Be, Je, bt, It, "#FF00C7BE", "#FFAF52DE", "#FFFFD60A"], children: (s) => (() => {
              var c = l("box");
              return e(c, "width", 66), e(c, "height", 50), e(c, "background", s), e(c, "cornerRadius", 10), c;
            })() })), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "lazyGrid \u2014 crossAxisCount=4:"), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = l("lazyGrid");
            return e(i, "crossAxisCount", 4), e(i, "aspectRatio", 1), e(i, "gap", 8), e(i, "height", 150), B(i, L(oe, { get each() {
              return Array.from({ length: 12 }, (s, c) => c);
            }, children: (s) => (() => {
              var c = l("box");
              return e(c, "background", s % 3 === 0 ? ke : s % 3 === 1 ? Be : Je), e(c, "cornerRadius", 8), c;
            })() })), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "reorderableListView \u2014 drag a row to reorder:"), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = l("reorderableListView");
            return e(i, "height", 200), e(i, "gap", 6), e(i, "onReorder", (s, c) => {
              const g = cr().slice(), [y] = g.splice(s, 1);
              g.splice(c, 0, y), qr(g);
            }), B(i, L(oe, { get each() {
              return cr();
            }, children: (s) => (() => {
              var c = l("box"), g = l("text");
              return _(c, g), e(c, "background", "#FFEFEFF4"), e(c, "cornerRadius", 8), e(c, "padding", 12), e(g, "label", s), e(g, "fontSize", 13), e(g, "color", "#FF1C1C1E"), c;
            })() })), i;
          })()];
        } }), C), B(v, L(J, { title: "Controls \u2014 switch \xB7 checkbox \xB7 slider \xB7 text field", get children() {
          return [(() => {
            var i = l("row"), s = l("switch"), c = l("text");
            return _(i, s), _(i, c), e(i, "gap", 12), e(s, "onChange", (g) => u(g)), e(c, "fontSize", 13), e(c, "color", "#FF1C1C1E"), G((g) => {
              var y = a(), W = a() ? "switch: on" : "switch: off";
              return y !== g.e && (g.e = e(s, "checked", y, g.e)), W !== g.t && (g.t = e(c, "label", W, g.t)), g;
            }, { e: undefined, t: undefined }), i;
          })(), (() => {
            var i = l("row"), s = l("checkbox"), c = l("text");
            return _(i, s), _(i, c), e(i, "gap", 12), e(s, "onChange", (g) => b(g)), e(c, "fontSize", 13), e(c, "color", "#FF1C1C1E"), G((g) => {
              var y = d(), W = d() ? "checkbox: checked" : "checkbox: unchecked";
              return y !== g.e && (g.e = e(s, "checked", y, g.e)), W !== g.t && (g.t = e(c, "label", W, g.t)), g;
            }, { e: undefined, t: undefined }), i;
          })(), (() => {
            var i = l("slider");
            return e(i, "min", 0), e(i, "max", 100), e(i, "onChange", (s) => F(s)), G((s) => e(i, "value", h(), s)), i;
          })(), (() => {
            var i = l("text");
            return e(i, "fontSize", 13), e(i, "color", "#FF1C1C1E"), G((s) => e(i, "label", `slider: ${Math.round(h())}`, s)), i;
          })(), (() => {
            var i = l("textInput");
            return e(i, "placeholder", "Type your name\u2026"), e(i, "onChange", (s) => T(s)), e(i, "onSubmit", (s) => yn(`Submitted: ${s}`)), G((s) => e(i, "value", A(), s)), i;
          })(), (() => {
            var i = l("text");
            return e(i, "fontSize", 13), e(i, "color", "#FF8E8E93"), G((s) => e(i, "label", A() ? `Hello, ${A()}!` : "\u2014 type above; press Enter to submit \u2014", s)), i;
          })()];
        } }), C), B(v, L(J, { title: "Indicators \u2014 spinner \xB7 progress bar", get children() {
          return [(() => {
            var i = l("row"), s = l("activityIndicator"), c = l("text");
            return _(i, s), _(i, c), e(i, "gap", 12), e(s, "color", "#FF0A84FF"), e(c, "label", "CircularProgressIndicator"), e(c, "fontSize", 13), e(c, "color", "#FF1C1C1E"), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "determinate \u2014 tracks the slider above:"), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = l("progressBar");
            return e(i, "color", "#FF0A84FF"), G((s) => e(i, "progress", h() / 100, s)), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "indeterminate:"), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = l("progressBar");
            return e(i, "color", "#FF34C759"), i;
          })()];
        } }), C), B(v, L(J, { title: "Animation", get children() {
          return [(() => {
            var i = l("text");
            return e(i, "label", "Implicit tweens, looping, list enter/exit, Hero \u2014 all host-side, zero per-frame bridge traffic. Opens a dedicated page."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = l("button");
            return e(i, "label", "Open Animations \u2192"), e(i, "onClick", () => p.navigate("animations")), i;
          })()];
        } }), C), B(v, L(J, { title: "ListTile \u2014 structured rows", get children() {
          return [(() => {
            var i = l("box"), s = l("column"), c = l("listTile"), g = l("listTile"), y = l("listTile");
            return _(i, s), e(i, "background", "#FFFFFFFF"), e(i, "cornerRadius", 12), e(i, "borderWidth", 1), e(i, "borderColor", "#FFE5E5EA"), _(s, c), _(s, g), _(s, y), e(s, "padding", 0), e(s, "gap", 0), e(c, "leadingIcon", "person"), e(c, "title", "Profile"), e(c, "subtitle", "Name, photo, bio"), e(c, "trailingIcon", "explore"), e(c, "onClick", () => m("tapped Profile")), e(g, "leadingIcon", "bell"), e(g, "title", "Notifications"), e(g, "subtitle", "Sounds, badges, alerts"), e(g, "trailingIcon", "explore"), e(g, "onClick", () => m("tapped Notifications")), e(y, "leadingIcon", "settings"), e(y, "title", "Settings"), e(y, "trailingIcon", "explore"), e(y, "onClick", () => m("tapped Settings")), i;
          })(), (() => {
            var i = l("text");
            return e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), G((s) => e(i, "label", `last row: ${D()}`, s)), i;
          })()];
        } }), C), B(v, L(J, { title: "PageView \u2014 swipe between pages", get children() {
          return [(() => {
            var i = l("box"), s = l("pageView"), c = l("box"), g = l("text"), y = l("box"), W = l("text"), V = l("box"), K = l("text");
            return _(i, s), e(i, "height", 140), _(s, c), _(s, y), _(s, V), e(s, "onChange", (q) => E(q)), _(c, g), e(c, "width", "fill"), e(c, "height", 140), e(c, "background", "#FF0A84FF"), e(c, "cornerRadius", 12), e(c, "padding", 20), e(g, "label", "Page 1 \u2014 swipe \u2192"), e(g, "fontSize", 16), e(g, "fontWeight", 800), e(g, "color", "#FFFFFFFF"), _(y, W), e(y, "width", "fill"), e(y, "height", 140), e(y, "background", "#FF34C759"), e(y, "cornerRadius", 12), e(y, "padding", 20), e(W, "label", "Page 2"), e(W, "fontSize", 16), e(W, "fontWeight", 800), e(W, "color", "#FFFFFFFF"), _(V, K), e(V, "width", "fill"), e(V, "height", 140), e(V, "background", "#FFFF9F0A"), e(V, "cornerRadius", 12), e(V, "padding", 20), e(K, "label", "Page 3"), e(K, "fontSize", 16), e(K, "fontWeight", 800), e(K, "color", "#FFFFFFFF"), G((q) => e(s, "activeTab", x(), q)), i;
          })(), (() => {
            var i = l("row"), s = l("button"), c = l("button");
            return _(i, s), _(i, c), e(i, "gap", 8), e(s, "label", "\u25C0 Prev"), e(s, "onClick", () => E(Math.max(0, x() - 1))), e(c, "label", "Next \u25B6"), e(c, "onClick", () => E(Math.min(2, x() + 1))), i;
          })(), (() => {
            var i = l("text");
            return e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), G((s) => e(i, "label", `page ${x() + 1} of 3 \u2014 swipe or use the buttons`, s)), i;
          })()];
        } }), C), B(v, L(J, { title: "Pull-to-refresh + swipe-to-dismiss", get children() {
          return [(() => {
            var i = l("box"), s = l("listView");
            return _(i, s), e(i, "height", 210), e(i, "borderWidth", 1), e(i, "borderColor", "#FFE5E5EA"), e(i, "cornerRadius", 8), e(s, "onRefresh", async () => {
              await new Promise((c) => setTimeout(c, 900)), j([`Fresh item ${++P}`, ...z()]);
            }), B(s, L(oe, { get each() {
              return z();
            }, children: (c) => (() => {
              var g = l("dismissible"), y = l("box"), W = l("text");
              return _(g, y), e(g, "onDismiss", () => j(z().filter((V) => V !== c))), _(y, W), e(y, "width", "fill"), e(y, "background", "#FFEFEFF4"), e(y, "cornerRadius", 8), e(y, "padding", 14), e(W, "label", c), e(W, "fontSize", 13), e(W, "color", "#FF1C1C1E"), g;
            })() })), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "Pull the list down to refresh (a 900ms async task \u2014 the spinner waits for it); swipe any row sideways to dismiss it."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })()];
        } }), C), B(v, L(J, { title: "Slivers \u2014 collapsing header (CustomScrollView)", get children() {
          return [(() => {
            var i = l("box"), s = l("customScrollView"), c = l("sliverAppBar"), g = l("box"), y = l("text"), W = l("sliverList"), V = l("sliverGrid");
            return _(i, s), e(i, "height", 340), e(i, "borderWidth", 1), e(i, "borderColor", "#FFE5E5EA"), e(i, "cornerRadius", 8), _(s, c), _(s, W), _(s, V), _(c, g), e(c, "title", "Collapsing header"), e(c, "height", 170), e(c, "sliverMode", "pinned"), e(c, "background", "#FF0A84FF"), _(g, y), e(g, "width", "fill"), e(g, "height", 170), e(g, "background", "#FF5E5CE6"), e(g, "padding", 20), e(y, "label", "Parallax background"), e(y, "fontSize", 18), e(y, "fontWeight", 800), e(y, "color", "#FFFFFFFF"), B(W, L(oe, { each: ["One", "Two", "Three", "Four", "Five"], children: (K) => (() => {
              var q = l("box"), Z = l("text");
              return _(q, Z), e(q, "width", "fill"), e(q, "background", "#FFFFFFFF"), e(q, "padding", 16), e(q, "borderWidth", 1), e(q, "borderColor", "#FFE5E5EA"), e(Z, "label", `Row ${K}`), e(Z, "fontSize", 14), e(Z, "color", "#FF1C1C1E"), q;
            })() })), e(V, "crossAxisCount", 3), e(V, "aspectRatio", 1), e(V, "gap", 8), B(V, L(oe, { each: [ke, Be, Je, bt, It, ke, Be, Je, bt], children: (K) => (() => {
              var q = l("box");
              return e(q, "background", K), e(q, "cornerRadius", 10), q;
            })() })), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "Scroll the panel up \u2014 the purple header collapses into a pinned blue bar. The SliverList builds rows lazily; non-sliver children would auto-wrap in a SliverToBoxAdapter."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })()];
        } }), C), B(v, L(J, { title: "Canvas \u2014 CustomPaint 2-D drawing", get children() {
          return [(() => {
            var i = l("box"), s = l("canvas");
            return _(i, s), e(i, "background", "#FFFFFFFF"), e(i, "cornerRadius", 12), e(i, "borderWidth", 1), e(i, "borderColor", "#FFE5E5EA"), e(i, "padding", 10), e(s, "width", 300), e(s, "height", 170), e(s, "draw", (c) => {
              c.strokeStyle(al).lineWidth(2).beginPath().moveTo(16, 150).lineTo(284, 150).stroke(), [50, 95, 70, h() + 10, 80].forEach((g, y) => {
                c.fillStyle(y === 3 ? ke : bt).fillRect(28 + y * 52, 150 - g, 34, g);
              }), c.fillStyle(Be).beginPath().circle(252, 44, 22).fill(), c.fillStyle(Gn).fontSize(12).fillText("bars \xB7 circle \xB7 path \xB7 text", 18, 22), $().forEach((g) => {
                c.fillStyle(g.color).beginPath().circle(g.x, g.y, g.r).fill();
              });
            }), i;
          })(), (() => {
            var i = l("row"), s = l("button"), c = l("button");
            return _(i, s), _(i, c), e(i, "gap", 8), e(s, "label", "Draw a shape"), e(s, "onClick", () => f([...$(), { x: 24 + Math.random() * 252, y: 16 + Math.random() * 120, r: 8 + Math.random() * 20, color: [ke, Be, Je, It, bt][Math.floor(Math.random() * 5)] }])), e(c, "label", "Clear"), e(c, "onClick", () => f([])), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "Bars, a circle, a stroked path, text. The 4th bar tracks the Controls slider; the buttons append/clear circles \u2014 each click flips the canvasShapes signal, so the draw callback re-records and the host repaints. Static drawings cross the bridge exactly once."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })()];
        } }), C), B(v, L(J, { title: "Drag-and-drop \u2014 DragItem onto DropZone", get children() {
          return [(() => {
            var i = l("row");
            return e(i, "gap", 8), B(i, L(oe, { each: ["Apple", "Banana", "Cherry"], children: (s) => (() => {
              var c = l("dragItem"), g = l("box"), y = l("text");
              return _(c, g), e(c, "dragData", s), _(g, y), e(g, "background", "#FF5E5CE6"), e(g, "cornerRadius", 20), e(g, "padding", 12), e(y, "label", s), e(y, "fontSize", 13), e(y, "color", "#FFFFFFFF"), c;
            })() })), i;
          })(), (() => {
            var i = l("dropZone"), s = l("box"), c = l("text");
            return _(i, s), e(i, "onDrop", (g) => w([...S(), g])), _(s, c), e(s, "width", "fill"), e(s, "height", 90), e(s, "background", "#FFEFEFF4"), e(s, "cornerRadius", 12), e(s, "padding", 16), e(c, "fontSize", 13), e(c, "color", "#FF1C1C1E"), G((g) => e(c, "label", S().length ? `Basket: ${S().join(", ")}` : "Drag a chip into this zone", g)), i;
          })(), (() => {
            var i = l("row"), s = l("button");
            return _(i, s), e(i, "gap", 8), e(s, "label", "Clear basket"), e(s, "onClick", () => w([])), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "Drag a fruit chip onto the zone \u2014 it highlights host-side while you hover; on release onDrop fires with the chip's dragData string. The whole drag is host-side; only the drop crosses the bridge."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })()];
        } }), C), B(v, L(J, { title: "More controls \u2014 radio \xB7 chip \xB7 segmented \xB7 accordion", get children() {
          return [(() => {
            var i = l("row");
            return e(i, "gap", 16), B(i, L(oe, { each: ["S", "M", "L"], children: (s) => (() => {
              var c = l("row"), g = l("radio"), y = l("text");
              return _(c, g), _(c, y), e(c, "gap", 2), e(g, "onChange", () => N(s)), e(y, "label", s), e(y, "fontSize", 13), e(y, "color", "#FF1C1C1E"), G((W) => e(g, "checked", I() === s, W)), c;
            })() })), i;
          })(), (() => {
            var i = l("row");
            return e(i, "gap", 8), B(i, L(oe, { each: ["Red", "Green", "Blue"], children: (s) => (() => {
              var c = l("chip");
              return e(c, "label", s), e(c, "onChange", (g) => ae(g ? [...H(), s] : H().filter((y) => y !== s))), G((g) => e(c, "checked", H().includes(s), g)), c;
            })() })), i;
          })(), (() => {
            var i = l("segmentedButton"), s = l("text"), c = l("text"), g = l("text");
            return _(i, s), _(i, c), _(i, g), e(i, "onChange", (y) => be(y)), e(s, "label", "Day"), e(s, "fontSize", 13), e(c, "label", "Week"), e(c, "fontSize", 13), e(g, "label", "Month"), e(g, "fontSize", 13), G((y) => e(i, "activeTab", re(), y)), i;
          })(), (() => {
            var i = l("row"), s = l("text"), c = l("dropdown"), g = l("text"), y = l("text"), W = l("text");
            return _(i, s), _(i, c), e(i, "gap", 8), e(s, "label", "Priority"), e(s, "fontSize", 13), e(s, "color", "#FF1C1C1E"), _(c, g), _(c, y), _(c, W), e(c, "onChange", (V) => pt(V)), e(g, "label", "Low"), e(g, "fontSize", 13), e(y, "label", "Medium"), e(y, "fontSize", 13), e(W, "label", "High"), e(W, "fontSize", 13), G((V) => e(c, "activeTab", Ye(), V)), i;
          })(), (() => {
            var i = l("box"), s = l("expansionTile"), c = l("box"), g = l("text");
            return _(i, s), e(i, "background", "#FFFFFFFF"), e(i, "cornerRadius", 8), e(i, "borderWidth", 1), e(i, "borderColor", "#FFE5E5EA"), _(s, c), e(s, "title", "Details"), e(s, "onChange", (y) => pe(y)), _(c, g), e(c, "padding", 14), e(c, "background", "#FFEFEFF4"), e(g, "label", "Body content revealed by the accordion \u2014 host-owned open state, host-side expand animation."), e(g, "fontSize", 12), e(g, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = l("text");
            return e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), G((s) => e(i, "label", `size ${I()} \xB7 chips ${H().join("/") || "\u2014"} \xB7 segment ${["Day", "Week", "Month"][re()]} \xB7 priority ${["Low", "Medium", "High"][Ye()]} \xB7 details ${ie() ? "open" : "closed"}`, s)), i;
          })()];
        } }), C), B(v, L(J, { title: "Stepper \u2014 multi-step flow", get children() {
          return [(() => {
            var i = l("stepper"), s = l("step"), c = l("text"), g = l("step"), y = l("text"), W = l("step"), V = l("text");
            return _(i, s), _(i, g), _(i, W), e(i, "onChange", (K) => Ze(K)), _(s, c), e(s, "title", "Account"), e(c, "label", "Create your account \u2014 name, email, password."), e(c, "fontSize", 12), e(c, "color", "#FF8E8E93"), _(g, y), e(g, "title", "Profile"), e(y, "label", "Add a photo and a short bio."), e(y, "fontSize", 12), e(y, "color", "#FF8E8E93"), _(W, V), e(W, "title", "Done"), e(V, "label", "All set \u2014 review and finish."), e(V, "fontSize", 12), e(V, "color", "#FF8E8E93"), G((K) => e(i, "activeTab", lr(), K)), i;
          })(), (() => {
            var i = l("text");
            return e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), G((s) => e(i, "label", `current step: ${lr() + 1} of 3`, s)), i;
          })()];
        } }), C), B(v, L(J, { title: "BottomSheet \u2014 draggable / expandable", get children() {
          var i = l("box"), s = l("stack"), c = l("box"), g = l("text"), y = l("bottomSheet"), W = l("box"), V = l("text");
          return _(i, s), e(i, "height", 300), e(i, "cornerRadius", 12), e(i, "background", "#FFEFEFF4"), _(s, c), _(s, y), _(c, g), e(c, "width", "fill"), e(c, "height", "fill"), e(c, "padding", 16), e(g, "label", "A DraggableScrollableSheet \u2014 drag the sheet up, or scroll its list past the edge to expand it."), e(g, "fontSize", 12), e(g, "color", "#FF8E8E93"), _(y, W), e(y, "initialSize", 0.4), e(y, "minSize", 0.18), e(y, "maxSize", 0.95), e(y, "background", "#FFFFFFFF"), _(W, V), e(W, "padding", 16), e(V, "label", "Sheet content \u2014 drag or scroll"), e(V, "fontSize", 15), e(V, "fontWeight", 700), e(V, "color", "#FF1C1C1E"), B(y, L(oe, { each: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta"], children: (K) => (() => {
            var q = l("box"), Z = l("text");
            return _(q, Z), e(q, "padding", 14), e(Z, "label", K), e(Z, "fontSize", 14), e(Z, "color", "#FF1C1C1E"), q;
          })() }), null), i;
        } }), C), B(v, L(J, { title: "Effects \u2014 BackdropFilter \xB7 InteractiveViewer", get children() {
          return [(() => {
            var i = l("stack"), s = l("image"), c = l("box"), g = l("backdropFilter"), y = l("box");
            return _(i, s), _(i, c), e(s, "src", "https://picsum.photos/seed/skalblur/300/160"), e(s, "width", 300), e(s, "height", 160), e(s, "contentScale", 1), e(s, "cornerRadius", 10), _(c, g), e(c, "top", 0), e(c, "left", 150), e(c, "width", 150), e(c, "height", 160), _(g, y), e(g, "blurRadius", 12), e(y, "width", 150), e(y, "height", 160), e(y, "background", "#33FFFFFF"), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "The right half is frosted by a BackdropFilter."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = l("box"), s = l("interactiveViewer"), c = l("image");
            return _(i, s), e(i, "height", 200), e(i, "cornerRadius", 12), e(i, "background", "#FFEFEFF4"), _(s, c), e(s, "minScale", 1), e(s, "maxScale", 4), e(c, "src", "https://picsum.photos/seed/skalzoom/320/200"), e(c, "width", 320), e(c, "height", 200), e(c, "contentScale", 1), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "Pinch / scroll-wheel to zoom the image, drag to pan."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })()];
        } }), C), B(v, L(J, { title: "Hover \u2014 onHover \xB7 semanticLabel", get children() {
          return [(() => {
            var i = l("box"), s = l("text");
            return _(i, s), e(i, "padding", 16), e(i, "cornerRadius", 10), e(i, "borderWidth", 1), e(i, "borderColor", "#FFE5E5EA"), e(i, "onHover", (c) => Hr(c)), e(i, "semanticLabel", "A hoverable demo card"), e(s, "fontSize", 14), G((c) => {
              var g = Dt() ? ke : ll, y = Dt() ? "Hovering \u2014 pointer is over the card" : "Move the pointer over this card", W = Dt() ? "#FFFFFF" : Gn;
              return g !== c.e && (c.e = e(i, "background", g, c.e)), y !== c.t && (c.t = e(s, "label", y, c.t)), W !== c.a && (c.a = e(s, "color", W, c.a)), c;
            }, { e: undefined, t: undefined, a: undefined }), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "onHover fires on pointer enter/exit (desktop/web). semanticLabel wraps the card in a Semantics node for screen readers."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })()];
        } }), C), B(v, L(J, { title: "Keyboard \u2014 onKey", get children() {
          return [(() => {
            var i = l("box"), s = l("text");
            return _(i, s), e(i, "padding", 16), e(i, "cornerRadius", 10), e(i, "background", "#FFFFFFFF"), e(i, "borderWidth", 1), e(i, "borderColor", "#FFE5E5EA"), e(i, "onKey", (c) => zt(c)), e(s, "fontSize", 14), e(s, "color", "#FF1C1C1E"), G((c) => e(s, "label", `last key: ${ge()}`, c)), i;
          })(), (() => {
            var i = l("text");
            return e(i, "label", "Click the card to focus it, then press keys (\u2318S, Escape, arrows). onKey reports a normalized combo string; build any shortcut layer on it."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })()];
        } }), C), B(v, L(J, { title: "Gestures \u2014 onTap \xB7 onLongPress \xB7 onDoubleTap", get children() {
          return [(() => {
            var i = l("box"), s = l("text");
            return _(i, s), e(i, "background", "#FFEFEFF4"), e(i, "cornerRadius", 12), e(i, "padding", 22), e(i, "onTap", () => m("onTap")), e(i, "onLongPress", () => m("onLongPress")), e(i, "onDoubleTap", () => m("onDoubleTap")), e(s, "label", "Tap / long-press / double-tap this box"), e(s, "fontSize", 13), e(s, "color", "#FF1C1C1E"), i;
          })(), (() => {
            var i = l("text");
            return e(i, "fontSize", 12), e(i, "color", "#FF8E8E93"), G((s) => e(i, "label", `last gesture: ${D()}`, s)), i;
          })()];
        } }), C), B(v, L(J, { title: "Drag \u2014 draggable (zero per-frame bridge traffic)", get children() {
          return [(() => {
            var i = l("box"), s = l("box"), c = l("text");
            return _(i, s), e(i, "height", 150), e(i, "background", "#FFEFEFF4"), e(i, "cornerRadius", 12), _(s, c), e(s, "draggable", true), e(s, "width", 64), e(s, "height", 64), e(s, "background", "#FF0A84FF"), e(s, "cornerRadius", 14), e(s, "onPanEnd", (g, y) => Gr(`${g.toFixed(0)}, ${y.toFixed(0)}`)), e(c, "label", "drag"), e(c, "fontSize", 12), e(c, "color", "#FFFFFFFF"), i;
          })(), (() => {
            var i = l("text");
            return e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), G((s) => e(i, "label", `Drag the blue box \u2014 the host moves it itself, no event per frame. Resting offset: ${Nt()}`, s)), i;
          })()];
        } }), C), B(v, L(J, { title: "Pan \u2014 onPanUpdate delta stream", get children() {
          return [(() => {
            var i = l("box"), s = l("text");
            return _(i, s), e(i, "height", 70), e(i, "background", "#FFEFEFF4"), e(i, "cornerRadius", 12), e(i, "padding", 16), e(i, "onPanStart", () => Ft("drag started")), e(i, "onPanUpdate", (c, g) => Ft(`dx ${c.toFixed(1)}  dy ${g.toFixed(1)}`)), e(i, "onPanEnd", (c, g) => Ft(`fling v ${c.toFixed(0)}, ${g.toFixed(0)} dp/s`)), e(s, "label", "Drag anywhere on this strip"), e(s, "fontSize", 13), e(s, "color", "#FF1C1C1E"), i;
          })(), (() => {
            var i = l("text");
            return e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), G((s) => e(i, "label", `onPanUpdate: ${jr()}`, s)), i;
          })()];
        } }), C), B(v, L(J, { title: "Scale \u2014 onScaleUpdate (pinch / rotate)", get children() {
          return [(() => {
            var i = l("box"), s = l("box"), c = l("text");
            return _(i, s), e(i, "height", 170), e(i, "background", "#FFEFEFF4"), e(i, "cornerRadius", 12), _(s, c), e(s, "width", 96), e(s, "height", 96), e(s, "background", "#FF5E5CE6"), e(s, "cornerRadius", 16), e(s, "onScaleStart", () => {
              ar = We();
            }), e(s, "onScaleUpdate", (g) => $e(Math.max(0.3, ar * g))), e(c, "label", "pinch"), e(c, "fontSize", 13), e(c, "color", "#FFFFFFFF"), G((g) => {
              var y = We(), W = We();
              return y !== g.e && (g.e = e(s, "scaleX", y, g.e)), W !== g.t && (g.t = e(s, "scaleY", W, g.t)), g;
            }, { e: undefined, t: undefined }), i;
          })(), (() => {
            var i = l("text");
            return e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), G((s) => e(i, "label", `Pinch the purple box (two pointers / trackpad). Scale \xD7${We().toFixed(2)}`, s)), i;
          })()];
        } }), C), B(v, L(J, { title: "Dialogs \u2014 imperative JS API", get children() {
          return [(() => {
            var i = l("row"), s = l("button"), c = l("button");
            return _(i, s), _(i, c), e(i, "gap", 8), e(s, "label", "Alert"), e(s, "onClick", async () => {
              await wn({ title: "Heads up", message: "A plain alert dialog.", actions: [{ label: "OK", value: "ok" }] }), we("alert: dismissed");
            }), e(c, "label", "Confirm"), e(c, "onClick", async () => {
              we(`confirm \u2192 ${await wn({ title: "Delete file?", message: "This cannot be undone.", actions: [{ label: "Cancel", value: "cancel" }, { label: "Delete", value: "delete", style: "destructive" }] }) ?? "dismissed"}`);
            }), i;
          })(), (() => {
            var i = l("row"), s = l("button"), c = l("button");
            return _(i, s), _(i, c), e(i, "gap", 8), e(s, "label", "Action sheet"), e(s, "onClick", async () => {
              we(`sheet \u2192 ${await lo({ title: "Choose an action", actions: [{ label: "Copy", value: "copy" }, { label: "Share", value: "share" }, { label: "Delete", value: "delete", style: "destructive" }] }) ?? "cancelled"}`);
            }), e(c, "label", "Snackbar"), e(c, "onClick", () => {
              yn("Hello from a snackbar \uD83D\uDC4B"), we("snackbar: shown");
            }), i;
          })(), (() => {
            var i = l("text");
            return e(i, "fontSize", 12), e(i, "color", "#FF8E8E93"), G((s) => e(i, "label", sr(), s)), i;
          })()];
        } }), C), B(v, L(J, { title: "Pickers \u2014 date \xB7 time", get children() {
          return [(() => {
            var i = l("row"), s = l("button"), c = l("button");
            return _(i, s), _(i, c), e(i, "gap", 8), e(s, "label", "Pick a date"), e(s, "onClick", async () => {
              vt(`date \u2192 ${await ao({ initialDate: "2026-05-17" }) ?? "dismissed"}`);
            }), e(c, "label", "Pick a time"), e(c, "onClick", async () => {
              vt(`time \u2192 ${await so({ initialHour: 9, initialMinute: 30 }) ?? "dismissed"}`);
            }), i;
          })(), (() => {
            var i = l("text");
            return e(i, "fontSize", 12), e(i, "color", "#FF8E8E93"), G((s) => e(i, "label", Qe(), s)), i;
          })()];
        } }), C), B(v, L(J, { title: "Navigation \u2014 push / pop with keep-alive", get children() {
          return [(() => {
            var i = l("text");
            return e(i, "label", "Tap a mailbox to push a screen; the AppBar back button (or system back) pops. Native transition; the screen behind stays mounted."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = l("box");
            return e(i, "height", 320), e(i, "borderWidth", 1), e(i, "borderColor", "#FFE5E5EA"), B(i, L(ur.View, {})), i;
          })()];
        } }), C), B(v, L(J, { title: "Tabs \u2014 bottom bar with keep-alive", get children() {
          return [(() => {
            var i = l("text");
            return e(i, "label", "Every tab subtree is built once and kept alive (IndexedStack) \u2014 switching never re-mounts; scroll & state survive."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = l("box"), s = l("tabs"), c = l("tab"), g = l("column"), y = l("text"), W = l("text"), V = l("tab"), K = l("column"), q = l("text"), Z = l("textInput"), Q = l("tab"), ce = l("column"), Fe = l("text"), et = l("text");
            return _(i, s), e(i, "height", 280), e(i, "borderWidth", 1), e(i, "borderColor", "#FFE5E5EA"), e(i, "cornerRadius", 8), _(s, c), _(s, V), _(s, Q), e(s, "onChange", Bt), e(s, "height", "fill"), _(c, g), e(c, "title", "Home"), e(c, "icon", "home"), _(g, y), _(g, W), e(g, "background", "#FFF2F2F7"), e(g, "padding", 16), e(g, "gap", 8), e(g, "height", "fill"), e(y, "label", "Home"), e(y, "fontSize", 20), e(y, "fontWeight", 800), e(y, "color", "#FF1C1C1E"), e(W, "label", "Switch tabs and come back \u2014 this tab was never torn down."), e(W, "fontSize", 13), e(W, "color", "#FF8E8E93"), _(V, K), e(V, "title", "Search"), e(V, "icon", "search"), _(K, q), _(K, Z), e(K, "background", "#FFF2F2F7"), e(K, "padding", 16), e(K, "gap", 8), e(K, "height", "fill"), e(q, "label", "Search"), e(q, "fontSize", 20), e(q, "fontWeight", 800), e(q, "color", "#FF1C1C1E"), e(Z, "placeholder", "Type to search\u2026"), _(Q, ce), e(Q, "title", "Profile"), e(Q, "icon", "person"), _(ce, Fe), _(ce, et), e(ce, "background", "#FFF2F2F7"), e(ce, "padding", 16), e(ce, "gap", 8), e(ce, "height", "fill"), e(Fe, "label", "Profile"), e(Fe, "fontSize", 20), e(Fe, "fontWeight", 800), e(Fe, "color", "#FF1C1C1E"), e(et, "fontSize", 13), e(et, "color", "#FF8E8E93"), G((tt) => {
              var ei = Lt(), ti = `active tab index: ${Lt()}`;
              return ei !== tt.e && (tt.e = e(s, "activeTab", ei, tt.e)), ti !== tt.t && (tt.t = e(et, "label", ti, tt.t)), tt;
            }, { e: undefined, t: undefined }), i;
          })()];
        } }), C), B(v, L(J, { title: "SafeArea", get children() {
          var i = l("safeArea"), s = l("box"), c = l("text");
          return _(i, s), _(s, c), e(s, "background", "#FFEFEFF4"), e(s, "cornerRadius", 8), e(s, "padding", 14), e(c, "label", "Insets past notches & system bars. (No visible effect here \u2014 the app root already applies one.)"), e(c, "fontSize", 12), e(c, "color", "#FF1C1C1E"), i;
        } }), C), e(C, "label", "\u2014 end of UI demo \u2014"), e(C, "fontSize", 12), e(C, "color", "#FF8E8E93"), v;
      })();
    }
    return L(Kr.View, {});
  }
  var qn = ["Just shipped a new feature, feeling great about how it turned out \uD83D\uDE80", "Hot take: the best APIs are the ones you don't have to read docs for", "Spent the morning refactoring legacy code \u2014 so much cleaner now", "There's no such thing as 'just a small change' in production code", "If your tests are slow, that's a smell. Fast tests = good tests", "Bun's startup time keeps surprising me, even after a year", "Why is naming things still the hardest part of programming?", "Found a 10\xD7 speedup in a critical path today. Profilers, not guesses", "Reading 'The Art of Unix Programming' for the third time", "Premature abstraction is somehow worse than premature optimization", "Latency is a feature, throughput is an artifact of how you measure", "Half of debugging is admitting your assumption was wrong", "You don't ship the codebase you have. You ship the codebase you understand", "Cache invalidation, naming things, off-by-one. The classics", "Every config file format eventually grows a turing-complete templating layer"], hl = Array.from({ length: 15000 }, (t, r) => ({ author: `@user${r * 2654435761 >>> 17}`, body: qn[r % qn.length], num: r + 1 })), gl = [50, 200, 500, 1000, 2000, 5000, 1e4], Kn = "#FFF1F5F9", Xn = "#FF475569", _l = "#FF22C55E", bl = "#FFEF4444", Jn = "#FFFFFFFF";
  function pl(t) {
    const [r, n] = X(0), [o, a] = X(false), [u, d] = X(0), [b, h] = X(false);
    return (() => {
      var F = l("column"), A = l("text"), T = l("text"), D = l("row"), m = l("button"), x = l("button");
      return _(F, A), _(F, T), _(F, D), e(F, "background", "#FFFFFFFF"), e(F, "padding", 12), e(F, "cornerRadius", 10), e(F, "borderWidth", 1), e(F, "borderColor", "#FFE5E5EA"), e(F, "gap", 6), e(A, "fontWeight", 700), e(A, "fontSize", 14), e(A, "color", "#FF1DA1F2"), e(T, "fontSize", 14), e(T, "color", "#FF1F2937"), e(T, "maxLines", 3), e(T, "textOverflow", 1), _(D, m), _(D, x), e(D, "gap", 10), e(m, "fontSize", 12), e(m, "padding", 6), e(m, "cornerRadius", 16), e(m, "onClick", () => {
        const E = !o();
        a(E), n(r() + (E ? 1 : -1));
      }), e(x, "fontSize", 12), e(x, "padding", 6), e(x, "cornerRadius", 16), e(x, "onClick", () => {
        const E = !b();
        h(E), d(u() + (E ? 1 : -1));
      }), G((E) => {
        var z = `#${t.num} \xB7 ${t.author}`, j = t.body, P = `\u2665 ${r()}`, $ = o() ? _l : Kn, f = o() ? Jn : Xn, S = `\u21A9 ${u()}`, w = b() ? bl : Kn, I = b() ? Jn : Xn;
        return z !== E.e && (E.e = e(A, "label", z, E.e)), j !== E.t && (E.t = e(T, "label", j, E.t)), P !== E.a && (E.a = e(m, "label", P, E.a)), $ !== E.o && (E.o = e(m, "background", $, E.o)), f !== E.i && (E.i = e(m, "color", f, E.i)), S !== E.n && (E.n = e(x, "label", S, E.n)), w !== E.s && (E.s = e(x, "background", w, E.s)), I !== E.h && (E.h = e(x, "color", I, E.h)), E;
      }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined, n: undefined, s: undefined, h: undefined }), F;
    })();
  }
  function Fl() {
    const [t, r] = X(50), [n, o] = X(""), a = Vt(() => hl.slice(0, t()));
    return (() => {
      var u = l("listView"), d = l("text"), b = l("text"), h = l("wrap"), F = l("text");
      return _(u, d), _(u, b), _(u, h), _(u, F), e(u, "background", "#FFF2F2F7"), e(u, "padding", 16), e(u, "gap", 12), e(d, "label", "Tweet feed \u2014 virtualized"), e(d, "fontSize", 24), e(d, "fontWeight", 800), e(d, "color", "#FF1C1C1E"), e(b, "label", "ListView.builder materializes only the visible window; the source pool is 15 000 items. Tap a count to mount N."), e(b, "fontSize", 13), e(b, "color", "#FF8E8E93"), e(h, "gap", 6), B(h, L(oe, { each: gl, children: (A) => (() => {
        var T = l("button");
        return e(T, "label", `${A}`), e(T, "onClick", () => {
          const D = performance.now();
          try {
            r(A), o(`mounted ${A} in ${(performance.now() - D).toFixed(2)} ms`);
          } catch (m) {
            o(`ERROR @ ${A}: ${m && (m.message || String(m)) || "unknown"}`);
          }
        }), T;
      })() })), e(F, "fontSize", 12), e(F, "color", "#FF8E8E93"), B(u, L(oe, { get each() {
        return a();
      }, children: (A) => L(pl, { get author() {
        return A.author;
      }, get body() {
        return A.body;
      }, get num() {
        return A.num;
      } }) }), null), G((A) => e(F, "label", n() || `showing ${t()} tweets`, A)), u;
    })();
  }
  function vl() {
    const [t, r] = X("\u2014 waiting for counter events \u2014"), n = zo(), [o, a] = X("\u2014 tap a button to RPC the Ticker \u2014"), [u, d] = X(null), [b, h] = X(false);
    return (() => {
      var F = l("scrollView"), A = l("text"), T = l("text"), D = l("text");
      return _(F, A), _(F, T), _(F, D), e(F, "background", "#FFF2F2F7"), e(F, "padding", 16), e(F, "gap", 14), e(A, "label", "Libraries \u2014 codegen-wrapped widgets"), e(A, "fontSize", 24), e(A, "fontWeight", 800), e(A, "color", "#FF1C1C1E"), e(T, "label", "Custom adapters + real pub.dev packages, brought into JSX by skal_codegen. Imported from 'skal-flutter'."), e(T, "fontSize", 13), e(T, "color", "#FF8E8E93"), B(F, L(J, { title: "Greeting \u2014 hand-written adapter", get children() {
        var m = l("greeting");
        return e(m, "name", "Skal"), e(m, "color", "#FF1DA1F2"), e(m, "fontSize", 20), m;
      } }), D), B(F, L(J, { title: "Shimmer \u2014 pub.dev, named-ctor wrap", get children() {
        return [(() => {
          var m = l("text");
          return e(m, "label", "ShimmerFromColors \u2014 codegen-synthesized from the Shimmer.fromColors named constructor."), e(m, "fontSize", 11), e(m, "color", "#FF8E8E93"), m;
        })(), (() => {
          var m = l("shimmerFromColors"), x = l("greeting");
          return _(m, x), e(m, "baseColor", 4290624957), e(m, "highlightColor", 4292927712), e(m, "period", 1500), e(x, "name", "loading\u2026"), e(x, "color", "#FF333333"), e(x, "fontSize", 28), m;
        })()];
      } }), D), B(F, L(J, { title: "QR code \u2014 qr_flutter, pub.dev wrap", get children() {
        return [(() => {
          var m = l("qrImageView");
          return e(m, "data", "https://skal.dev"), e(m, "size", 200), m;
        })(), (() => {
          var m = l("text");
          return e(m, "label", "QrImageView, generated against qr_flutter's class."), e(m, "fontSize", 11), e(m, "color", "#FF8E8E93"), m;
        })()];
      } }), D), B(F, L(J, { title: "Camera \u2014 host-pattern wrap (controller lifecycle)", get children() {
        return [(() => {
          var m = l("text");
          return e(m, "label", "A synthesized _CameraHost owns the CameraController (init in initState, dispose on unmount). The controller initializes only once Start mounts <Camera> \u2014 no camera / permission \u2192 an inline error banner."), e(m, "fontSize", 11), e(m, "color", "#FF8E8E93"), m;
        })(), (() => {
          var m = l("button");
          return e(m, "onClick", () => h(!b())), G((x) => e(m, "label", b() ? "Stop camera" : "Start camera", x)), m;
        })(), Dr(() => Dr(() => !!b())() && (() => {
          var m = l("box"), x = l("camera");
          return _(m, x), e(m, "background", "#FF000000"), e(m, "padding", 4), e(m, "cornerRadius", 8), e(x, "resolutionIndex", 1), m;
        })())];
      } }), D), B(F, L(J, { title: "Counter \u2014 typed callbacks back to JSX", get children() {
        return [(() => {
          var m = l("counter");
          return e(m, "initial", 0), e(m, "onChanged", (x) => r(`onChanged(${x})`)), e(m, "onReset", () => r("onReset()")), m;
        })(), (() => {
          var m = l("text");
          return e(m, "fontSize", 13), e(m, "color", "#FF1C1C1E"), G((x) => e(m, "label", t(), x)), m;
        })()];
      } }), D), B(F, L(J, { title: "Ticker \u2014 JS \u2192 Dart imperative RPC", get children() {
        return [(() => {
          var m = l("ticker");
          return Io(n, m), e(m, "intervalMs", 500), m;
        })(), (() => {
          var m = l("wrap"), x = l("button"), E = l("button"), z = l("button"), j = l("button"), P = l("button"), $ = l("button"), f = l("button"), S = l("button");
          return _(m, x), _(m, E), _(m, z), _(m, j), _(m, P), _(m, $), _(m, f), _(m, S), e(m, "gap", 6), e(x, "label", "pause"), e(x, "onClick", async () => {
            await n.pause(), a("pause() \u2713");
          }), e(E, "label", "resume"), e(E, "onClick", async () => {
            await n.resume(), a("resume() \u2713");
          }), e(z, "label", "reset"), e(z, "onClick", async () => {
            await n.reset(), a("reset() \u2713");
          }), e(j, "label", "+10"), e(j, "onClick", async () => {
            await n.bump(10), a(`bump(10), now getValue() \u2192 ${await n.getValue()}`);
          }), e(P, "label", "read"), e(P, "onClick", async () => {
            a(`getValue() \u2192 ${await n.getValue()}, isPaused() \u2192 ${await n.isPaused()}`);
          }), e($, "label", "describe"), e($, "onClick", async () => {
            a(`describe() \u2192 ${await n.describe("hello from JSX")}`);
          }), e(f, "label", "snapshot"), e(f, "onClick", async () => {
            const w = await n.snapshot();
            a(`snapshot() \u2192 value=${w.value} paused=${w.paused} ts=${w.timestamp}`);
          }), e(S, "label", "sub/unsub"), e(S, "onClick", () => {
            if (u())
              u()(), d(() => null), a("unsubscribed from ticks$");
            else {
              const w = n.ticks$((I) => {
                a(`stream tick: ${I}`);
              });
              d(() => w), a("subscribed to ticks$ \u2014 wait for emissions\u2026");
            }
          }), m;
        })(), (() => {
          var m = l("text");
          return e(m, "fontSize", 13), e(m, "color", "#FF1C1C1E"), G((x) => e(m, "label", o(), x)), m;
        })()];
      } }), D), B(F, L(J, { title: "Stickers \u2014 List<Widget> children + gradient prop", get children() {
        var m = l("stickers"), x = l("greeting"), E = l("greeting"), z = l("greeting");
        return _(m, x), _(m, E), _(m, z), e(m, "gap", 6), e(m, "padding", 10), e(m, "gradient", { type: "linear", colors: ["#FFFFE082", "#FFB0F0D0", "#FFB0E0FF"], stops: [0, 0.5, 1], begin: "topLeft", end: "bottomRight" }), e(x, "name", "multi-child A"), e(x, "color", "#FF6B4F00"), e(x, "fontSize", 14), e(E, "name", "multi-child B"), e(E, "color", "#FF6B4F00"), e(E, "fontSize", 14), e(z, "name", "multi-child C"), e(z, "color", "#FF6B4F00"), e(z, "fontSize", 14), m;
      } }), D), e(D, "label", "\u2014 end of Libs demo \u2014"), e(D, "fontSize", 12), e(D, "color", "#FF8E8E93"), F;
    })();
  }
  var Yn = (t) => Array.from(t, (r) => r.toString(16).padStart(2, "0")).join(""), El = new Function("m", "return import(m);"), Me = (t) => El(t), me = (t, r) => t && t[r] || t && t.default && t.default[r] || undefined, Zn = [{ title: "Web Crypto \u2014 crypto.subtle (global, native)", probes: [{ label: "crypto.randomUUID()", run: () => crypto.randomUUID() }, { label: "crypto.getRandomValues \u2014 16 bytes", run: () => {
    const t = new Uint8Array(16);
    return crypto.getRandomValues(t), Yn(t);
  } }, { label: "crypto.subtle.digest \u2014 SHA-256 of 64 KB", run: async () => {
    const t = new Uint8Array(65536);
    crypto.getRandomValues(t);
    const r = await crypto.subtle.digest("SHA-256", t);
    return Yn(new Uint8Array(r)).slice(0, 32) + "\u2026";
  } }, { label: "crypto.subtle \u2014 AES-GCM encrypt + decrypt", run: async () => {
    const t = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]), r = crypto.getRandomValues(new Uint8Array(12)), n = new TextEncoder().encode("hello from skal"), o = await crypto.subtle.encrypt({ name: "AES-GCM", iv: r }, t, n), a = await crypto.subtle.decrypt({ name: "AES-GCM", iv: r }, t, o);
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
    const t = await Me("bun:sqlite"), r = me(t, "Database") || t.default;
    if (typeof r != "function")
      throw new Error("bun:sqlite imported, but no Database constructor");
    const n = new r(":memory:");
    n.run("CREATE TABLE t (id INTEGER, name TEXT)"), n.run("INSERT INTO t VALUES (1, 'skal')");
    const o = n.query("SELECT name FROM t WHERE id = ?").get(1);
    return n.close(), `select \u2192 ${JSON.stringify(o)}`;
  } }] }, { title: "Node compatibility \u2014 node: builtins", probes: [{ label: "process \u2014 platform / arch / version", run: () => {
    if (typeof process > "u")
      throw new Error("process global not present");
    return `${process.platform} ${process.arch} \xB7 ${process.version || "(no version)"}`;
  } }, { label: "node:crypto \u2014 createHash('sha256')", run: async () => {
    const t = me(await Me("node:crypto"), "createHash");
    if (!t)
      throw new Error("node:crypto has no createHash");
    return t("sha256").update("hello from skal").digest("hex").slice(0, 32) + "\u2026";
  } }, { label: "node:crypto \u2014 randomBytes(16)", run: async () => {
    const t = me(await Me("node:crypto"), "randomBytes");
    if (!t)
      throw new Error("node:crypto has no randomBytes");
    return t(16).toString("hex");
  } }, { label: "node:os \u2014 platform / arch / cpus", run: async () => {
    const t = await Me("node:os"), r = me(t, "platform"), n = me(t, "arch"), o = me(t, "cpus");
    if (!r)
      throw new Error("node:os has no platform()");
    return `${r()} ${n()} \xB7 ${o().length} cpus`;
  } }, { label: "node:path \u2014 join + normalize", run: async () => {
    const t = me(await Me("node:path"), "join");
    if (!t)
      throw new Error("node:path has no join");
    return t("/a/b", "..", "c", "./d.txt");
  } }, { label: "Buffer \u2014 from / toString", run: () => {
    if (typeof Buffer > "u")
      throw new Error("Buffer global not present");
    return `hex = ${Buffer.from("skal", "utf8").toString("hex")}`;
  } }, { label: "node:fs \u2014 temp write + read", run: async () => {
    const t = await Me("node:fs"), r = await Me("node:os"), n = await Me("node:path"), o = me(t, "writeFileSync"), a = me(t, "readFileSync"), u = me(t, "unlinkSync"), d = me(r, "tmpdir"), b = me(n, "join");
    if (!o || !a || !d || !b)
      throw new Error("node:fs / os / path missing an expected member");
    const h = b(d(), `skal-probe-${Date.now()}.txt`);
    o(h, "skal fs probe");
    const F = a(h, "utf8");
    try {
      u && u(h);
    } catch {}
    return `wrote + read back "${F}"`;
  } }] }, { title: "Standard JS & Web APIs", probes: [{ label: "JSON stringify + parse \u2014 1000-object array", run: () => {
    const t = Array.from({ length: 1000 }, (o, a) => ({ id: a, name: "item" + a, ok: a % 2 === 0 })), r = JSON.stringify(t), n = JSON.parse(r);
    return `${r.length} bytes \xB7 ${n.length} items round-tripped`;
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
  } }] }], Qn = 3000;
  function Sl(t) {
    let r;
    const n = new Promise((o, a) => {
      r = setTimeout(() => a(new Error(`timed out after ${Qn} ms`)), Qn);
    });
    return Promise.race([Promise.resolve().then(() => t.run()), n]).finally(() => clearTimeout(r));
  }
  function ml() {
    const [t, r] = X({}), [n, o] = X(false), a = () => typeof performance < "u" && performance.now ? performance.now() : Date.now();
    async function u() {
      if (!n()) {
        o(true), r({});
        for (const d of Zn)
          for (const b of d.probes) {
            const h = a();
            let F, A = true;
            try {
              F = String(await Sl(b));
            } catch (D) {
              F = D && D.message ? D.message : String(D), A = false;
            }
            const T = a() - h;
            r((D) => ({ ...D, [b.label]: { ms: T, response: F, ok: A } }));
          }
        o(false);
      }
    }
    return oi(() => {
      u();
    }), (() => {
      var d = l("scrollView"), b = l("text"), h = l("text"), F = l("button");
      return _(d, b), _(d, h), _(d, F), e(d, "background", "#FFF2F2F7"), e(d, "padding", 16), e(d, "gap", 14), e(d, "scrollbar", true), e(b, "label", "JS runtime \u2014 probes & timings"), e(b, "fontSize", 24), e(b, "fontWeight", 800), e(b, "color", "#FF1C1C1E"), e(h, "label", "Each function runs in the embedded bun + JSC runtime; its duration and response are logged. Bun / bun:sqlite probes report an error (not a crash) if the runtime doesn't expose them."), e(h, "fontSize", 13), e(h, "color", "#FF8E8E93"), e(F, "onClick", u), B(d, L(oe, { each: Zn, children: (A) => L(J, { get title() {
        return A.title;
      }, get children() {
        return L(oe, { get each() {
          return A.probes;
        }, children: (T) => {
          const D = () => t()[T.label], m = () => {
            const x = D();
            return x ? x.response.length > 110 ? x.response.slice(0, 110) + "\u2026" : x.response : "not run yet";
          };
          return (() => {
            var x = l("column"), E = l("text"), z = l("text"), j = l("text");
            return _(x, E), _(x, z), _(x, j), e(x, "gap", 2), e(E, "fontSize", 13), e(E, "fontWeight", 700), e(E, "color", "#FF1C1C1E"), e(z, "fontSize", 11), e(z, "fontWeight", 700), e(z, "color", "#FF0A84FF"), e(j, "fontSize", 12), e(j, "maxLines", 3), G((P) => {
              var $ = T.label, f = D() ? `${D().ms.toFixed(3)} ms` : "\u2014", S = m(), w = D() ? D().ok ? jn : It : jn;
              return $ !== P.e && (P.e = e(E, "label", $, P.e)), f !== P.t && (P.t = e(z, "label", f, P.t)), S !== P.a && (P.a = e(j, "label", S, P.a)), w !== P.o && (P.o = e(j, "color", w, P.o)), P;
            }, { e: undefined, t: undefined, a: undefined, o: undefined }), x;
          })();
        } });
      } }) }), null), G((A) => e(F, "label", n() ? "Running\u2026" : "Re-run all probes", A)), d;
    })();
  }
  var le = ol({ counter: 0, note: "", scratch: "", settings: { theme: "dark" }, todos: [], archive: [] }, { version: 1, paths: { scratch: { persist: false }, archive: { lazy: true } } });
  function wl() {
    const t = le[Ur], r = () => t.backendKind() === "native" || t.backendKind() === "mmap" || t.backendKind() === "fs", n = () => {
      const a = t.engineStats();
      return `${a ? `${a.records} records \xB7 ${a.segments} segments` : "engine: \u2026"} \xB7 ${t.pending()} pending \xB7 ${t.flushes()} flushes`;
    }, o = () => {
      const a = t.initTiming();
      return a ? `init total ${a.total}ms \u2014 dir-RPC ${a.dir} \xB7 open ${a.open} \xB7 migrate ${a.migrate} \xB7 hydrate ${a.hydrate} (${a.records} records)` : "init: running\u2026";
    };
    return (() => {
      var a = l("scrollView"), u = l("text"), d = l("text"), b = l("text");
      return _(a, u), _(a, d), _(a, b), e(a, "background", "#FFF2F2F7"), e(a, "padding", 16), e(a, "gap", 14), e(a, "scrollbar", true), e(u, "label", "createSkalStore \u2014 reactive \xB7 persistent \xB7 deep-object"), e(u, "fontSize", 23), e(u, "fontWeight", 800), e(u, "color", "#FF1C1C1E"), e(d, "fontSize", 14), e(d, "fontWeight", 800), e(b, "fontSize", 12), e(b, "color", "#FF8E8E93"), B(a, L(J, { title: "Values \u2014 mutate the object directly", get children() {
        return [(() => {
          var h = l("row"), F = l("button"), A = l("text");
          return _(h, F), _(h, A), e(h, "gap", 10), e(F, "label", "counter + 1"), e(F, "onClick", () => {
            le.counter = le.counter + 1;
          }), e(A, "fontSize", 16), e(A, "fontWeight", 800), e(A, "color", "#FF0A84FF"), G((T) => e(A, "label", `db.counter = ${le.counter}`, T)), h;
        })(), (() => {
          var h = l("row"), F = l("button"), A = l("text");
          return _(h, F), _(h, A), e(h, "gap", 10), e(F, "label", "toggle theme"), e(F, "onClick", () => {
            le.settings.theme = le.settings.theme === "dark" ? "light" : "dark";
          }), e(A, "fontSize", 14), e(A, "fontWeight", 700), e(A, "color", "#FF1C1C1E"), G((T) => e(A, "label", `db.settings.theme = ${le.settings.theme}`, T)), h;
        })(), (() => {
          var h = l("text");
          return e(h, "label", "note \u2014 persisted; each change writes one tiny per-leaf frame"), e(h, "fontSize", 11), e(h, "color", "#FF8E8E93"), h;
        })(), (() => {
          var h = l("textInput");
          return e(h, "placeholder", "persisted text\u2026"), e(h, "onChange", (F) => {
            le.note = F;
          }), G((F) => e(h, "value", le.note, F)), h;
        })(), (() => {
          var h = l("text");
          return e(h, "label", "scratch \u2014 config persist:false, so memory only (gone on restart)"), e(h, "fontSize", 11), e(h, "color", "#FF8E8E93"), h;
        })(), (() => {
          var h = l("textInput");
          return e(h, "placeholder", "memory-only text\u2026"), e(h, "onChange", (F) => {
            le.scratch = F;
          }), G((F) => e(h, "value", le.scratch, F)), h;
        })()];
      } }), null), B(a, L(J, { title: "Collection \u2014 todos (array of objects)", get children() {
        return [(() => {
          var h = l("row"), F = l("button"), A = l("button"), T = l("button"), D = l("button");
          return _(h, F), _(h, A), _(h, T), _(h, D), e(h, "gap", 8), e(F, "label", "Add"), e(F, "onClick", () => le.todos.push({ text: "todo " + Date.now() })), e(A, "label", "Add 100"), e(A, "onClick", () => Qr(() => {
            for (let m = 0;m < 100; m++)
              le.todos.push({ text: "bulk " + Date.now() + " #" + m });
          })), e(T, "label", "Remove first"), e(T, "onClick", () => {
            le.todos.length && le.todos.shift();
          }), e(D, "label", "Clear"), e(D, "onClick", () => {
            le.todos.splice(0, le.todos.length);
          }), h;
        })(), (() => {
          var h = l("text");
          return e(h, "fontSize", 12), e(h, "fontWeight", 700), e(h, "color", "#FF0A84FF"), G((F) => e(h, "label", `${le.todos.length} todos \u2014 add/remove writes one element frame + the index, never the whole list`, F)), h;
        })(), (() => {
          var h = l("box"), F = l("listView");
          return _(h, F), e(h, "height", 220), e(h, "cornerRadius", 10), e(h, "background", "#FFEFEFF4"), e(F, "scrollbar", true), B(F, L(oe, { get each() {
            return le.todos;
          }, children: (A) => (() => {
            var T = l("box"), D = l("text");
            return _(T, D), e(T, "padding", 8), e(T, "background", "#FFFFFFFF"), e(T, "cornerRadius", 6), e(T, "borderWidth", 1), e(T, "borderColor", "#FFE5E5EA"), e(D, "fontSize", 12), e(D, "color", "#FF1C1C1E"), G((m) => e(D, "label", A.text, m)), T;
          })() })), h;
        })()];
      } }), null), B(a, L(J, { title: "Lazy \u2014 archive (config lazy:true)", get children() {
        return [(() => {
          var h = l("row"), F = l("button");
          return _(h, F), e(h, "gap", 8), e(F, "label", "Add to archive"), e(F, "onClick", () => le.archive.push({ text: "archived " + Date.now() })), h;
        })(), (() => {
          var h = l("text");
          return e(h, "fontSize", 12), e(h, "color", "#FF8E8E93"), G((F) => e(h, "label", `${le.archive.length} records \u2014 not loaded at open; faults in from disk on first access`, F)), h;
        })()];
      } }), null), B(a, L(J, { title: "Engine", get children() {
        return [(() => {
          var h = l("text");
          return e(h, "fontSize", 11), e(h, "color", "#FF8E8E93"), e(h, "maxLines", 2), G((F) => e(h, "label", n(), F)), h;
        })(), (() => {
          var h = l("text");
          return e(h, "fontSize", 11), e(h, "color", "#FF8E8E93"), e(h, "maxLines", 2), G((F) => e(h, "label", o(), F)), h;
        })(), (() => {
          var h = l("button");
          return e(h, "label", "Flush now"), e(h, "onClick", () => t.flushNow()), h;
        })(), (() => {
          var h = l("text");
          return e(h, "label", "Writes are debounced + batched into one engine flush; reads are pure in-memory."), e(h, "fontSize", 11), e(h, "color", "#FF8E8E93"), h;
        })()];
      } }), null), G((h) => {
        var F = `Backend: ${t.backendKind()} \xB7 schema v${t.version()}`, A = r() ? Be : Je, T = r() ? "Persisted \u2014 change values, quit, and re-run to verify they survive a restart." : "In-memory fallback \u2014 no writable backend, so data resets on restart.";
        return F !== h.e && (h.e = e(d, "label", F, h.e)), A !== h.t && (h.t = e(d, "color", A, h.t)), T !== h.a && (h.a = e(b, "label", T, h.a)), h;
      }, { e: undefined, t: undefined, a: undefined }), a;
    })();
  }
  function yl() {
    const [t, r] = X(0);
    return (() => {
      var n = l("tabs"), o = l("tab"), a = l("tab"), u = l("tab"), d = l("tab"), b = l("tab");
      return _(n, o), _(n, a), _(n, u), _(n, d), _(n, b), e(n, "onChange", r), e(n, "height", "fill"), e(o, "title", "UI"), e(o, "icon", "grid"), B(o, L(dl, {})), e(a, "title", "List"), e(a, "icon", "list"), B(a, L(Fl, {})), e(u, "title", "Libs"), e(u, "icon", "explore"), B(u, L(vl, {})), e(d, "title", "JS"), e(d, "icon", "code"), B(d, L(ml, {})), e(b, "title", "Store"), e(b, "icon", "storage"), B(b, L(wl, {})), G((h) => e(n, "activeTab", t(), h)), n;
    })();
  }
  ko(() => L(yl, {}), Do);
})();
})
