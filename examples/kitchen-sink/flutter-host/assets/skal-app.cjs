// @bun @bytecode @bun-cjs
(function(exports, require, module, __filename, __dirname) {// flutter-host/assets/skal-app.js
(function() {
  var be = { context: undefined, registry: undefined, effects: undefined, done: false, getContextId() {
    return Tn(this.context.count);
  }, getNextContextId() {
    return Tn(this.context.count++);
  } };
  function Tn(e) {
    const r = String(e), n = r.length - 1;
    return be.context.id + (n ? String.fromCharCode(96 + n) : "") + r;
  }
  function Or(e) {
    be.context = e;
  }
  function Ki() {
    return { ...be.context, id: be.getNextContextId(), count: 0 };
  }
  var Ji = (e, r) => e === r, De = Symbol("solid-proxy"), Yi = typeof Proxy == "function", or = Symbol("solid-track"), ar = { equals: Ji }, En = null, $n = Dn, Oe = 1, Mt = 2, Rn = { owned: null, cleanups: null, context: null, owner: null }, ie = null, V = null, Bt = null, St = null, ae = null, he = null, ve = null, sr = 0;
  function yt(e, r) {
    const n = ae, i = ie, a = e.length === 0, l = r === undefined ? i : r, c = a ? Rn : { owned: null, cleanups: null, context: l ? l.context : null, owner: l }, p = a ? e : () => e(() => Ke(() => Je(c)));
    ie = c, ae = null;
    try {
      return Me(p, true);
    } finally {
      ae = n, ie = i;
    }
  }
  function K(e, r) {
    r = r ? Object.assign({}, ar, r) : ar;
    const n = { value: e, observers: null, observerSlots: null, comparator: r.equals || undefined }, i = (a) => (typeof a == "function" && (V && V.running && V.sources.has(n) ? a = a(n.tValue) : a = a(n.value)), In(n, a));
    return [Cn.bind(n), i];
  }
  function Xe(e, r, n) {
    const i = zr(e, r, false, Oe);
    Bt && V && V.running ? he.push(i) : Wt(i);
  }
  function xt(e, r, n) {
    $n = ro;
    const i = zr(e, r, false, Oe), a = Ir && Qi(Ir);
    a && (i.suspense = a), (!n || !n.render) && (i.user = true), ve ? ve.push(i) : Wt(i);
  }
  function Vt(e, r, n) {
    n = n ? Object.assign({}, ar, n) : ar;
    const i = zr(e, r, true, 0);
    return i.observers = null, i.observerSlots = null, i.comparator = n.equals || undefined, Bt && V && V.running ? (i.tState = Oe, he.push(i)) : Wt(i), Cn.bind(i);
  }
  function Pn(e) {
    return Me(e, false);
  }
  function Ke(e) {
    if (!St && ae === null)
      return e();
    const r = ae;
    ae = null;
    try {
      return St ? St.untrack(e) : e();
    } finally {
      ae = r;
    }
  }
  function An(e) {
    xt(() => Ke(e));
  }
  function Fn(e) {
    return ie === null || (ie.cleanups === null ? ie.cleanups = [e] : ie.cleanups.push(e)), e;
  }
  function Cr() {
    return ae;
  }
  function Zi(e) {
    if (V && V.running)
      return e(), V.done;
    const r = ae, n = ie;
    return Promise.resolve().then(() => {
      ae = r, ie = n;
      let i;
      return (Bt || Ir) && (i = V || (V = { sources: new Set, effects: [], promises: new Set, disposed: new Set, queue: new Set, running: true }), i.done || (i.done = new Promise((a) => i.resolve = a)), i.running = true), Me(e, false), ae = ie = null, i ? i.done : undefined;
    });
  }
  var [Vs, On] = K(false);
  function Qi(e) {
    let r;
    return ie && ie.context && (r = ie.context[e.id]) !== undefined ? r : e.defaultValue;
  }
  var Ir;
  function Cn() {
    const e = V && V.running;
    if (this.sources && (e ? this.tState : this.state))
      if ((e ? this.tState : this.state) === Oe)
        Wt(this);
      else {
        const r = he;
        he = null, Me(() => lr(this), false), he = r;
      }
    if (ae) {
      const r = this.observers;
      if (!r || r[r.length - 1] !== ae) {
        const n = r ? r.length : 0;
        ae.sources ? (ae.sources.push(this), ae.sourceSlots.push(n)) : (ae.sources = [this], ae.sourceSlots = [n]), r ? (r.push(ae), this.observerSlots.push(ae.sources.length - 1)) : (this.observers = [ae], this.observerSlots = [ae.sources.length - 1]);
      }
    }
    return e && V.sources.has(this) ? this.tValue : this.value;
  }
  function In(e, r, n) {
    let i = V && V.running && V.sources.has(e) ? e.tValue : e.value;
    if (!e.comparator || !e.comparator(i, r)) {
      if (V) {
        const a = V.running;
        (a || !n && V.sources.has(e)) && (V.sources.add(e), e.tValue = r), a || (e.value = r);
      } else
        e.value = r;
      e.observers && e.observers.length && Me(() => {
        for (let a = 0;a < e.observers.length; a += 1) {
          const l = e.observers[a], c = V && V.running;
          c && V.disposed.has(l) || ((c ? !l.tState : !l.state) && (l.pure ? he.push(l) : ve.push(l), l.observers && Nn(l)), c ? l.tState = Oe : l.state = Oe);
        }
        if (he.length > 1e6)
          throw he = [], new Error;
      }, false);
    }
    return r;
  }
  function Wt(e) {
    if (!e.fn)
      return;
    Je(e);
    const r = sr;
    zn(e, V && V.running && V.sources.has(e) ? e.tValue : e.value, r), V && !V.running && V.sources.has(e) && queueMicrotask(() => {
      Me(() => {
        V && (V.running = true), ae = ie = e, zn(e, e.tValue, r), ae = ie = null;
      }, false);
    });
  }
  function zn(e, r, n) {
    let i;
    const a = ie, l = ae;
    ae = ie = e;
    try {
      i = e.fn(r);
    } catch (c) {
      return e.pure && (V && V.running ? (e.tState = Oe, e.tOwned && e.tOwned.forEach(Je), e.tOwned = undefined) : (e.state = Oe, e.owned && e.owned.forEach(Je), e.owned = null)), e.updatedAt = n + 1, Dr(c);
    } finally {
      ae = l, ie = a;
    }
    (!e.updatedAt || e.updatedAt <= n) && (e.updatedAt != null && ("observers" in e) ? In(e, i, true) : V && V.running && e.pure ? (V.sources.has(e) || (e.value = i), V.sources.add(e), e.tValue = i) : e.value = i, e.updatedAt = n);
  }
  function zr(e, r, n, i = Oe, a) {
    const l = { fn: e, state: i, updatedAt: null, owned: null, sources: null, sourceSlots: null, cleanups: null, value: r, owner: ie, context: ie ? ie.context : null, pure: n };
    if (V && V.running && (l.state = 0, l.tState = i), ie === null || ie !== Rn && (V && V.running && ie.pure ? ie.tOwned ? ie.tOwned.push(l) : ie.tOwned = [l] : ie.owned ? ie.owned.push(l) : ie.owned = [l]), St && l.fn) {
      const c = l.fn, [p, h] = K(undefined, { equals: false }), v = St.factory(c, h);
      Fn(() => v.dispose());
      let E;
      const y = () => Zi(h).then(() => {
        E && (E.dispose(), E = undefined);
      });
      l.fn = (A) => (p(), V && V.running ? (E || (E = St.factory(c, y)), E.track(A)) : v.track(A));
    }
    return l;
  }
  function Ht(e) {
    const r = V && V.running;
    if ((r ? e.tState : e.state) === 0)
      return;
    if ((r ? e.tState : e.state) === Mt)
      return lr(e);
    if (e.suspense && Ke(e.suspense.inFallback))
      return e.suspense.effects.push(e);
    const n = [e];
    for (;(e = e.owner) && (!e.updatedAt || e.updatedAt < sr); ) {
      if (r && V.disposed.has(e))
        return;
      (r ? e.tState : e.state) && n.push(e);
    }
    for (let i = n.length - 1;i >= 0; i--) {
      if (e = n[i], r) {
        let a = e, l = n[i + 1];
        for (;(a = a.owner) && a !== l; )
          if (V.disposed.has(a))
            return;
      }
      if ((r ? e.tState : e.state) === Oe)
        Wt(e);
      else if ((r ? e.tState : e.state) === Mt) {
        const a = he;
        he = null, Me(() => lr(e, n[0]), false), he = a;
      }
    }
  }
  function Me(e, r) {
    if (he)
      return e();
    let n = false;
    r || (he = []), ve ? n = true : ve = [], sr++;
    try {
      const i = e();
      return eo(n), i;
    } catch (i) {
      n || (ve = null), he = null, Dr(i);
    }
  }
  function eo(e) {
    if (he && (Bt && V && V.running ? to(he) : Dn(he), he = null), e)
      return;
    let r;
    if (V) {
      if (!V.promises.size && !V.queue.size) {
        const { sources: i, disposed: a } = V;
        ve.push.apply(ve, V.effects), r = V.resolve;
        for (const l of ve)
          "tState" in l && (l.state = l.tState), delete l.tState;
        V = null, Me(() => {
          for (const l of a)
            Je(l);
          for (const l of i) {
            if (l.value = l.tValue, l.owned)
              for (let c = 0, p = l.owned.length;c < p; c++)
                Je(l.owned[c]);
            l.tOwned && (l.owned = l.tOwned), delete l.tValue, delete l.tOwned, l.tState = 0;
          }
          On(false);
        }, false);
      } else if (V.running) {
        V.running = false, V.effects.push.apply(V.effects, ve), ve = null, On(true);
        return;
      }
    }
    const n = ve;
    ve = null, n.length && Me(() => $n(n), false), r && r();
  }
  function Dn(e) {
    for (let r = 0;r < e.length; r++)
      Ht(e[r]);
  }
  function to(e) {
    for (let r = 0;r < e.length; r++) {
      const n = e[r], i = V.queue;
      i.has(n) || (i.add(n), Bt(() => {
        i.delete(n), Me(() => {
          V.running = true, Ht(n);
        }, false), V && (V.running = false);
      }));
    }
  }
  function ro(e) {
    let r, n = 0;
    for (r = 0;r < e.length; r++) {
      const i = e[r];
      i.user ? e[n++] = i : Ht(i);
    }
    if (be.context) {
      if (be.count) {
        be.effects || (be.effects = []), be.effects.push(...e.slice(0, n));
        return;
      }
      Or();
    }
    for (be.effects && (be.done || !be.count) && (e = [...be.effects, ...e], n += be.effects.length, delete be.effects), r = 0;r < n; r++)
      Ht(e[r]);
  }
  function lr(e, r) {
    const n = V && V.running;
    n ? e.tState = 0 : e.state = 0;
    for (let i = 0;i < e.sources.length; i += 1) {
      const a = e.sources[i];
      if (a.sources) {
        const l = n ? a.tState : a.state;
        l === Oe ? a !== r && (!a.updatedAt || a.updatedAt < sr) && Ht(a) : l === Mt && lr(a, r);
      }
    }
  }
  function Nn(e) {
    const r = V && V.running;
    for (let n = 0;n < e.observers.length; n += 1) {
      const i = e.observers[n];
      (r ? !i.tState : !i.state) && (r ? i.tState = Mt : i.state = Mt, i.pure ? he.push(i) : ve.push(i), i.observers && Nn(i));
    }
  }
  function Je(e) {
    let r;
    if (e.sources)
      for (;e.sources.length; ) {
        const n = e.sources.pop(), i = e.sourceSlots.pop(), a = n.observers;
        if (a && a.length) {
          const l = a.pop(), c = n.observerSlots.pop();
          i < a.length && (l.sourceSlots[c] = i, a[i] = l, n.observerSlots[i] = c);
        }
      }
    if (e.tOwned) {
      for (r = e.tOwned.length - 1;r >= 0; r--)
        Je(e.tOwned[r]);
      delete e.tOwned;
    }
    if (V && V.running && e.pure)
      Ln(e, true);
    else if (e.owned) {
      for (r = e.owned.length - 1;r >= 0; r--)
        Je(e.owned[r]);
      e.owned = null;
    }
    if (e.cleanups) {
      for (r = e.cleanups.length - 1;r >= 0; r--)
        e.cleanups[r]();
      e.cleanups = null;
    }
    V && V.running ? e.tState = 0 : e.state = 0;
  }
  function Ln(e, r) {
    if (r || (e.tState = 0, V.disposed.add(e)), e.owned)
      for (let n = 0;n < e.owned.length; n++)
        Ln(e.owned[n]);
  }
  function no(e) {
    return e instanceof Error ? e : new Error(typeof e == "string" ? e : "Unknown error", { cause: e });
  }
  function Mn(e, r, n) {
    try {
      for (const i of r)
        i(e);
    } catch (i) {
      Dr(i, n && n.owner || null);
    }
  }
  function Dr(e, r = ie) {
    const n = En && r && r.context && r.context[En], i = no(e);
    if (!n)
      throw i;
    ve ? ve.push({ fn() {
      Mn(i, n, r);
    }, state: Oe }) : Mn(i, n, r);
  }
  var io = Symbol("fallback");
  function Bn(e) {
    for (let r = 0;r < e.length; r++)
      e[r]();
  }
  function oo(e, r, n = {}) {
    let i = [], a = [], l = [], c = 0, p = r.length > 1 ? [] : null;
    return Fn(() => Bn(l)), () => {
      let h = e() || [], v = h.length, E, y;
      return h[or], Ke(() => {
        let g, z, T, F, N, x, P, f, S;
        if (v === 0)
          c !== 0 && (Bn(l), l = [], i = [], a = [], c = 0, p && (p = [])), n.fallback && (i = [io], a[0] = yt((k) => (l[0] = k, n.fallback())), c = 1);
        else if (c === 0) {
          for (a = new Array(v), y = 0;y < v; y++)
            i[y] = h[y], a[y] = yt(A);
          c = v;
        } else {
          for (T = new Array(v), F = new Array(v), p && (N = new Array(v)), x = 0, P = Math.min(c, v);x < P && i[x] === h[x]; x++)
            ;
          for (P = c - 1, f = v - 1;P >= x && f >= x && i[P] === h[f]; P--, f--)
            T[f] = a[P], F[f] = l[P], p && (N[f] = p[P]);
          for (g = new Map, z = new Array(f + 1), y = f;y >= x; y--)
            S = h[y], E = g.get(S), z[y] = E === undefined ? -1 : E, g.set(S, y);
          for (E = x;E <= P; E++)
            S = i[E], y = g.get(S), y !== undefined && y !== -1 ? (T[y] = a[E], F[y] = l[E], p && (N[y] = p[E]), y = z[y], g.set(S, y)) : l[E]();
          for (y = x;y < v; y++)
            y in T ? (a[y] = T[y], l[y] = F[y], p && (p[y] = N[y], p[y](y))) : a[y] = yt(A);
          a = a.slice(0, c = v), i = h.slice(0);
        }
        return a;
      });
      function A(g) {
        if (l[y] = g, p) {
          const [z, T] = K(y);
          return p[y] = T, r(h[y], z);
        }
        return r(h[y]);
      }
    };
  }
  var ao = false;
  function so(e, r) {
    if (ao && be.context) {
      const n = be.context;
      Or(Ki());
      const i = Ke(() => e(r || {}));
      return Or(n), i;
    }
    return Ke(() => e(r || {}));
  }
  function cr() {
    return true;
  }
  var lo = { get(e, r, n) {
    return r === De ? n : e.get(r);
  }, has(e, r) {
    return r === De ? true : e.has(r);
  }, set: cr, deleteProperty: cr, getOwnPropertyDescriptor(e, r) {
    return { configurable: true, enumerable: true, get() {
      return e.get(r);
    }, set: cr, deleteProperty: cr };
  }, ownKeys(e) {
    return e.keys();
  } };
  function Nr(e) {
    return (e = typeof e == "function" ? e() : e) ? e : {};
  }
  function co() {
    for (let e = 0, r = this.length;e < r; ++e) {
      const n = this[e]();
      if (n !== undefined)
        return n;
    }
  }
  function Vn(...e) {
    let r = false;
    for (let c = 0;c < e.length; c++) {
      const p = e[c];
      r = r || !!p && De in p, e[c] = typeof p == "function" ? (r = true, Vt(p)) : p;
    }
    if (Yi && r)
      return new Proxy({ get(c) {
        for (let p = e.length - 1;p >= 0; p--) {
          const h = Nr(e[p])[c];
          if (h !== undefined)
            return h;
        }
      }, has(c) {
        for (let p = e.length - 1;p >= 0; p--)
          if (c in Nr(e[p]))
            return true;
        return false;
      }, keys() {
        const c = [];
        for (let p = 0;p < e.length; p++)
          c.push(...Object.keys(Nr(e[p])));
        return [...new Set(c)];
      } }, lo);
    const n = {}, i = Object.create(null);
    for (let c = e.length - 1;c >= 0; c--) {
      const p = e[c];
      if (!p)
        continue;
      const h = Object.getOwnPropertyNames(p);
      for (let v = h.length - 1;v >= 0; v--) {
        const E = h[v];
        if (E === "__proto__" || E === "constructor")
          continue;
        const y = Object.getOwnPropertyDescriptor(p, E);
        if (!i[E])
          i[E] = y.get ? { enumerable: true, configurable: true, get: co.bind(n[E] = [y.get.bind(p)]) } : y.value !== undefined ? y : undefined;
        else {
          const A = n[E];
          A && (y.get ? A.push(y.get.bind(p)) : y.value !== undefined && A.push(() => y.value));
        }
      }
    }
    const a = {}, l = Object.keys(i);
    for (let c = l.length - 1;c >= 0; c--) {
      const p = l[c], h = i[p];
      h && h.get ? Object.defineProperty(a, p, h) : a[p] = h ? h.value : undefined;
    }
    return a;
  }
  function ce(e) {
    const r = "fallback" in e && { fallback: () => e.fallback };
    return Vt(oo(() => e.each, e.children, r || undefined));
  }
  var uo = (e) => Vt(() => e());
  function fo({ createElement: e, createTextNode: r, isTextNode: n, replaceText: i, insertNode: a, removeNode: l, setProperty: c, getParentNode: p, getFirstChild: h, getNextSibling: v }) {
    function E(x, P, f, S) {
      if (f !== undefined && !S && (S = []), typeof P != "function")
        return y(x, P, S, f);
      Xe((k) => y(x, P(), k, f), S);
    }
    function y(x, P, f, S, k) {
      for (;typeof f == "function"; )
        f = f();
      if (P === f)
        return f;
      const D = typeof P, M = S !== undefined;
      if (D === "string" || D === "number")
        if (D === "number" && (P = P.toString()), M) {
          let j = f[0];
          j && n(j) ? i(j, P) : j = r(P), f = z(x, f, S, j);
        } else
          f !== "" && typeof f == "string" ? i(h(x), f = P) : (z(x, f, S, r(P)), f = P);
      else if (P == null || D === "boolean")
        f = z(x, f, S);
      else {
        if (D === "function")
          return Xe(() => {
            let j = P();
            for (;typeof j == "function"; )
              j = j();
            f = y(x, j, f, S);
          }), () => f;
        if (Array.isArray(P)) {
          const j = [];
          if (A(j, P, k))
            return Xe(() => f = y(x, j, f, S, true)), () => f;
          if (j.length === 0) {
            const fe = z(x, f, S);
            if (M)
              return f = fe;
          } else
            Array.isArray(f) ? f.length === 0 ? T(x, j, S) : g(x, f, j) : f == null || f === "" ? T(x, j) : g(x, M && f || [h(x)], j);
          f = j;
        } else {
          if (Array.isArray(f)) {
            if (M)
              return f = z(x, f, S, P);
            z(x, f, null, P);
          } else
            f == null || f === "" || !h(x) ? a(x, P) : F(x, P, h(x));
          f = P;
        }
      }
      return f;
    }
    function A(x, P, f) {
      let S = false;
      for (let k = 0, D = P.length;k < D; k++) {
        let M = P[k], j;
        if (!(M == null || M === true || M === false))
          if (Array.isArray(M))
            S = A(x, M) || S;
          else if ((j = typeof M) == "string" || j === "number")
            x.push(r(M));
          else if (j === "function")
            if (f) {
              for (;typeof M == "function"; )
                M = M();
              S = A(x, Array.isArray(M) ? M : [M]) || S;
            } else
              x.push(M), S = true;
          else
            x.push(M);
      }
      return S;
    }
    function g(x, P, f) {
      let S = f.length, k = P.length, D = S, M = 0, j = 0, fe = v(P[k - 1]), oe = null;
      for (;M < k || j < D; ) {
        if (P[M] === f[j]) {
          M++, j++;
          continue;
        }
        for (;P[k - 1] === f[D - 1]; )
          k--, D--;
        if (k === M) {
          const Ee = D < S ? j ? v(f[j - 1]) : f[D - j] : fe;
          for (;j < D; )
            a(x, f[j++], Ee);
        } else if (D === j)
          for (;M < k; )
            (!oe || !oe.has(P[M])) && l(x, P[M]), M++;
        else if (P[M] === f[D - 1] && f[j] === P[k - 1]) {
          const Ee = v(P[--k]);
          a(x, f[j++], v(P[M++])), a(x, f[--D], Ee), P[k] = f[D];
        } else {
          if (!oe) {
            oe = new Map;
            let le = j;
            for (;le < D; )
              oe.set(f[le], le++);
          }
          const Ee = oe.get(P[M]);
          if (Ee != null)
            if (j < Ee && Ee < D) {
              let le = M, $e = 1, bt;
              for (;++le < k && le < D && !((bt = oe.get(P[le])) == null || bt !== Ee + $e); )
                $e++;
              if ($e > Ee - j) {
                const zt = P[M];
                for (;j < Ee; )
                  a(x, f[j++], zt);
              } else
                F(x, f[j++], P[M++]);
            } else
              M++;
          else
            l(x, P[M++]);
        }
      }
    }
    function z(x, P, f, S) {
      if (f === undefined) {
        let D;
        for (;D = h(x); )
          l(x, D);
        return S && a(x, S), "";
      }
      const k = S || r("");
      if (P.length) {
        let D = false;
        for (let M = P.length - 1;M >= 0; M--) {
          const j = P[M];
          if (k !== j) {
            const fe = p(j) === x;
            !D && !M ? fe ? F(x, k, j) : a(x, k, f) : fe && l(x, j);
          } else
            D = true;
        }
      } else
        a(x, k, f);
      return [k];
    }
    function T(x, P, f) {
      for (let S = 0, k = P.length;S < k; S++)
        a(x, P[S], f);
    }
    function F(x, P, f) {
      a(x, P, f), l(x, f);
    }
    function N(x, P, f = {}, S) {
      return P || (P = {}), S || Xe(() => f.children = y(x, P.children, f.children)), Xe(() => P.ref && P.ref(x)), Xe(() => {
        for (const k in P) {
          if (k === "children" || k === "ref")
            continue;
          const D = P[k];
          D !== f[k] && (c(x, k, D, f[k]), f[k] = D);
        }
      }), f;
    }
    return { render(x, P) {
      let f;
      return yt((S) => {
        f = S, E(P, x());
      }), f;
    }, insert: E, spread(x, P, f) {
      typeof P == "function" ? Xe((S) => N(x, P(), S, f)) : N(x, P, undefined, f);
    }, createElement: e, createTextNode: r, insertNode: a, setProp(x, P, f, S) {
      return c(x, P, f, S), f;
    }, mergeProps: Vn, effect: Xe, memo: uo, createComponent: so, use(x, P, f) {
      return Ke(() => x(P, f));
    } };
  }
  function Wn(e) {
    const r = fo(e);
    return r.mergeProps = Vn, r;
  }
  function ho() {
    const e = globalThis.__skalHot;
    if (e)
      return e;
    const r = { currentDrain: null, setDrain(i) {
      this.currentDrain = i;
    }, stash: new Map, _cfg: null, configure(i) {
      this._cfg = Object.assign({}, this._cfg, i);
    }, _mounted: false, _dispose: null, mount(i) {
      if (this._mounted)
        return;
      const a = this._cfg;
      this._dispose = a ? a.render(i) : null, this._mounted = true;
    }, beginReload() {
      const i = this._cfg;
      try {
        this._dispose && this._dispose();
      } catch {}
      this._dispose = null, this._mounted = false;
      try {
        i && i.cleanup && i.cleanup();
      } catch {}
      try {
        i && i.reset && i.reset();
      } catch {}
    } }, n = function() {
      const i = globalThis.__skalHot && globalThis.__skalHot.currentDrain;
      i && i();
    };
    return n.__skalTrampoline = true, globalThis.__skal_drainEvents = n, globalThis.__skalHot = r, r;
  }
  var Hn = 6 * 1024 * 1024, Ut = 4194368, go = 768 * 1024, Un = 4980800, Gn = 4980800, jn = 2, qn = 3, po = 6, Xn = 7, bo = 10, Kn = 12, Jn = 0, _o = 2, vo = 4, Ws = 1, Hs = 2, Us = 3, Gs = 4, js = 16, qs = 17, Xs = 20, Ks = 21, Js = 22, Ys = 23, Zs = 24, Qs = 25, el = 26, tl = 27, rl = 28, nl = 29, il = 30, ol = 31, al = 32, sl = 33, ll = 34, cl = 35, ul = 36, dl = 37, fl = 38, hl = 39, gl = 40, pl = 41, bl = 0, _l = 1, vl = 2, ml = 3, wl = 4, Sl = 5, yl = 6, xl = 7, kl = 9, Tl = 10, El = 11, $l = 12, Rl = 13, Pl = 14, Al = 15, Fl = 16, Ol = 17, Cl = 18, Il = 19, zl = 20, Dl = 21, Nl = 22, Ll = 23, Ml = 24, Bl = 25, Vl = 26, Wl = 27, Hl = 28, Ul = 29, Gl = 30, jl = 31, ql = 32, Xl = 33, Kl = 34, Jl = 35, Yl = 36, Zl = 37, Ql = 38, ec = 39, tc = 40, rc = 41, nc = 42, ic = 43, oc = 44, ac = 45, sc = 46, lc = 47, cc = 48, uc = 49, dc = 1, fc = 2, hc = 3, gc = 4, pc = 5, bc = 6, _c = 7, vc = 8, mc = 9, wc = 10, Sc = 11, yc = 12, xc = 13, kc = 14, Tc = 15, Ec = 16, $c = 17, Rc = 18, Pc = 19, Ac = 20, Fc = 21, Oc = 22, Cc = 23, Ic = 0, zc = 1, Dc = 2, Nc = 3, Lc = 4, Mc = 5, Bc = 6, Vc = 7, Wc = 0, Hc = 1, Uc = 2, Gc = 3, jc = 4, qc = 5, Xc = 6, Kc = 7, Jc = 8, Yc = 9, Zc = 10, Qc = 11, eu = 12, tu = 13, ru = 14, nu = 15, iu = 16, ou = 32, au = 33, su = 34, lu = 35, cu = 36, uu = 37, du = 64, fu = 65, hu = 66, gu = 67, pu = 68, bu = 69, _u = 70, vu = 71, mu = 72, wu = 73, Su = 74, yu = 75, xu = 76, ku = 96, Tu = 97, Eu = 98, $u = 99, Ru = 128, Pu = 129, Au = 130, Fu = 131, Ou = 132, Cu = 133, Iu = 134, zu = 135, Du = 136, Nu = 137, Lu = 160, Mu = 161, Bu = 162, Vu = 163, Wu = 164, Hu = 165, Uu = 166, Gu = 167, ju = 168, qu = 169, Xu = 170, Ku = 171, Ju = 172, Yu = 173, Zu = 174, Qu = 175, ed = 176, td = 177, rd = 178, nd = 179, id = 180, od = 181, ad = 182, sd = 183, ld = -1, mo = 2147483646, wo = 2147483645, ur = typeof globalThis.__skal_acquireBridge == "function", Ue;
  if (ur) {
    if (Ue = globalThis.__skal_acquireBridge(), !Ue || Ue.byteLength !== Hn)
      throw new Error(`Skal: bridge buffer not available (got ${Ue && Ue.byteLength})`);
  } else
    Ue = new ArrayBuffer(Hn);
  var Yn = new Uint8Array(Ue), ge = new Uint32Array(Ue), dr = new BigInt64Array(Ue), So = new TextEncoder, Gt = 16, yo = 1048592, xo = 16384, ko = yo - 4, Zn = ge[jn], Qn = ge[qn], fr = Atomics.load(dr, Jn), Ge = Zn ? (Zn >> 2) + Gt : Gt, kt = Qn ? Qn + Ut : Ut, hr = Ge, Lr = false, Mr = false, Br = false;
  function Vr() {
    Ge = Gt, kt = Ut, hr = Gt, Lr = true;
  }
  function Wr() {
    ge[jn] = Ge - Gt << 2, ge[qn] = kt - Ut, Lr && (ge[Kn] = ge[Kn] + 1 >>> 0, Lr = false), fr += 1n, Atomics.store(dr, Jn, fr), hr = Ge;
  }
  function ei() {
    Br = true;
    try {
      Wr();
      const e = fr, r = globalThis.__skal_drainOpsSync;
      if (typeof r == "function") {
        if (globalThis.__skal_opRingResets = (globalThis.__skal_opRingResets | 0) + 1, Mr)
          console.warn("Skal: op ring re-overflowed during inline drain \u2014 chunk large renders to avoid stale ops");
        else {
          Mr = true;
          try {
            r();
          } finally {
            Mr = false;
          }
        }
        Vr();
        return;
      }
      const n = performance.now() + 5000;
      for (;!(Atomics.load(dr, vo) >= e); )
        if (performance.now() > n) {
          console.warn("Skal: drain spin timeout \u2014 UI thread slow; ring will overwrite");
          break;
        }
      Vr();
    } finally {
      Br = false;
    }
  }
  function ne(e, r, n, i) {
    let a = Ge;
    a >= ko && (ei(), a = Ge), ge[a] = e >>> 0, ge[a + 1] = r >>> 0, ge[a + 2] = n >>> 0, ge[a + 3] = i >>> 0, Ge = a + 4, Ge - hr >= xo && Wr();
  }
  var Ye = 0, Ze = 0;
  function nt(e) {
    kt + e.length * 3 > Gn && ei();
    const r = kt - Ut, n = Yn.subarray(kt, Gn), { read: i, written: a } = So.encodeInto(e, n);
    if (i !== e.length)
      throw new Error(`Skal: string too large for heap (${e.length} code units > ${go} bytes)`);
    kt += a, Ye = r, Ze = a;
  }
  function gr(e, r) {
    nt(r), ne(20, e, Ye, Ze);
  }
  var ti = 8192, To = (e, r) => typeof r == "bigint" ? `${r}n` : r;
  function Eo(e) {
    if (typeof e == "string")
      return e;
    if (e instanceof Error)
      return e.stack || e.message || String(e);
    if (typeof e == "object" && e !== null)
      try {
        return JSON.stringify(e, To);
      } catch {
        return String(e);
      }
    return String(e);
  }
  var Hr = false;
  function it(e, r) {
    if (!(Hr || Br)) {
      Hr = true;
      try {
        let n = "";
        for (let i = 0;i < r.length; i++)
          i && (n += " "), n += Eo(r[i]);
        if (n.length === 0)
          return;
        n.length > ti && (n = n.slice(0, ti) + "\u2026"), nt(n), ne(40, e, Ye, Ze), ee();
      } catch {} finally {
        Hr = false;
      }
    }
  }
  function $o() {
    const e = { log: function() {
      it(0, arguments);
    }, info: function() {
      it(1, arguments);
    }, warn: function() {
      it(2, arguments);
    }, error: function() {
      it(3, arguments);
    }, debug: function() {
      it(4, arguments);
    }, trace: function() {
      it(4, arguments);
    } };
    e.dir = e.log, e.dirxml = e.log, e.table = e.log, e.group = e.log, e.groupCollapsed = e.log, e.assert = function(n) {
      if (!n) {
        const i = Array.prototype.slice.call(arguments, 1);
        it(3, ["Assertion failed:"].concat(i));
      }
    };
    const r = function() {};
    globalThis.console = new Proxy(e, { get(n, i) {
      const a = n[i];
      return a !== undefined ? a : r;
    } });
  }
  ur && typeof window > "u" && $o();
  var Ur = false;
  function ri() {
    Ur = false, Ge !== hr && Wr();
  }
  function ee() {
    Ur || (Ur = true, queueMicrotask(ri));
  }
  function Ro() {
    Vr(), ne(41, 1, 0, 0), ri();
  }
  var Be = 1024, U = new Int8Array(256);
  U.fill(-1), U[0] = 0, U[1] = 1, U[2] = 2, U[3] = 3, U[4] = 4, U[5] = 5, U[6] = 6, U[7] = 7, U[8] = 8, U[9] = 9, U[32] = 10, U[33] = 11, U[34] = 12, U[35] = 13, U[36] = 14, U[37] = 15, U[64] = 16, U[65] = 17, U[66] = 18, U[67] = 19, U[68] = 20, U[69] = 21, U[70] = 22, U[96] = 23, U[97] = 24, U[128] = 25, U[129] = 26, U[130] = 27, U[131] = 28, U[160] = 29, U[161] = 30, U[162] = 31, U[10] = 32, U[11] = 33, U[12] = 34, U[13] = 35, U[14] = 36, U[15] = 37, U[16] = 38, U[132] = 39, U[133] = 40, U[134] = 41, U[135] = 42, U[136] = 43, U[163] = 44, U[164] = 45, U[165] = 46, U[166] = 47, U[71] = 48, U[98] = 49, U[137] = 50, U[72] = 51, U[167] = 52, U[168] = 53, U[169] = 54, U[170] = 55, U[171] = 56, U[172] = 57, U[173] = 58, U[174] = 59, U[73] = 60, U[99] = 61, U[175] = 62, U[74] = 63;
  var Pe = 64, pr = new Int32Array(Be * Pe), jt = new Float32Array(Be * Pe), br = new Array(Be * Pe), qt = new Uint8Array(Be * Pe), Tt = 6, Et = new Float32Array(Be * Tt);
  Et.fill(NaN);
  var _r = new Map, ni = [], Po = 0;
  function Ao() {
    const e = Be * 2, r = Be * Pe, n = e * Pe, i = Be * Tt, a = e * Tt, l = new Int32Array(n);
    l.set(pr), pr = l;
    const c = new Uint8Array(n);
    c.set(qt), qt = c;
    const p = new Float32Array(n);
    p.set(jt), p.fill(NaN, r), jt = p;
    const h = new Float32Array(a);
    h.set(Et), h.fill(NaN, i), Et = h, br.length = n, Be = e;
  }
  function vr(e) {
    let r = _r.get(e);
    if (r === undefined) {
      r = ni.pop(), r === undefined && (r = Po++), r >= Be && Ao(), _r.set(e, r);
      const n = r * Pe;
      qt.fill(0, n, n + Pe), jt.fill(NaN, n, n + Pe);
      for (let i = n;i < n + Pe; i++)
        br[i] = undefined;
    }
    return r;
  }
  var ii = new Map, oi = new Map, ai = new Map, $t = new Map;
  function Fo(e) {
    const r = _r.get(e);
    if (r !== undefined) {
      _r.delete(e), ni.push(r);
      const n = r * Tt;
      Et.fill(NaN, n, n + Tt);
    }
    ii.delete(e), oi.delete(e), ai.delete(e), Yo(e);
  }
  var Ne = 0, Qe = 0, Rt = new Float32Array(1), Xt = new Uint32Array(Rt.buffer);
  function we(e, r, n) {
    const i = n | 0, a = U[r];
    if (a < 0) {
      ne(16, e, r, i), Ne++;
      return;
    }
    const l = vr(e) * Pe + a;
    if (qt[l] !== 0 && pr[l] === i) {
      Qe++;
      return;
    }
    pr[l] = i, qt[l] = 1, ne(16, e, r, i), Ne++;
  }
  function si(e, r, n) {
    const i = U[r];
    if (i < 0) {
      Rt[0] = n, ne(17, e, r, Xt[0]), Ne++;
      return;
    }
    const a = vr(e) * Pe + i;
    if (jt[a] === n) {
      Qe++;
      return;
    }
    jt[a] = n, Rt[0] = n, ne(17, e, r, Xt[0]), Ne++;
  }
  function Oo(e, r, n) {
    const i = U[r];
    if (i < 0) {
      nt(n == null ? "" : String(n)), ne(22, e, (r & 255) << 24 | Ye & 16777215, Ze), Ne++;
      return;
    }
    const a = vr(e) * Pe + i;
    if (br[a] === n) {
      Qe++;
      return;
    }
    br[a] = n, nt(n == null ? "" : String(n)), ne(22, e, (r & 255) << 24 | Ye & 16777215, Ze), Ne++;
  }
  function Pt(e, r, n, i) {
    const a = vr(e) * Tt + n;
    if (Et[a] === i) {
      Qe++;
      return;
    }
    Et[a] = i, Rt[0] = i, ne(r, e, 0, Xt[0]), Ne++;
  }
  function Co(e, r) {
    Pt(e, 32, 0, r);
  }
  function Io(e, r) {
    Pt(e, 33, 1, r);
  }
  function zo(e, r) {
    Pt(e, 34, 2, r);
  }
  function Do(e, r) {
    Pt(e, 35, 3, r);
  }
  function No(e, r) {
    Pt(e, 36, 4, r);
  }
  function Lo(e, r) {
    Pt(e, 37, 5, r);
  }
  var Mo = { material: 0, cupertino: 1, adaptive: 2 }, Bo = { light: 0, dark: 1 };
  function Vo(e, r) {
    ne(38, typeof e == "string" ? Mo[e] ?? 0 : e | 0, typeof r == "string" ? Bo[r] ?? 0 : r | 0, 0), ee();
  }
  function Wo(e) {
    ne(39, e, 0, 0), ee();
  }
  function li(e) {
    return st(1, "showDialog", [JSON.stringify(e || {})]);
  }
  function Ho(e) {
    return st(1, "showActionSheet", [JSON.stringify(e || {})]);
  }
  function ci(e) {
    return st(1, "showSnackbar", [JSON.stringify(typeof e == "string" ? { message: e } : e || {})]);
  }
  function Uo(e) {
    return st(1, "showDatePicker", [JSON.stringify(e || {})]);
  }
  function Go(e) {
    return st(1, "showTimePicker", [JSON.stringify(e || {})]);
  }
  function jo() {
    return st(1, "getDataDir", []);
  }
  var ui = new Map;
  function qo(e) {
    let r = 2166136261;
    for (let n = 0;n < e.length; n++)
      r ^= e.charCodeAt(n), r = Math.imul(r, 16777619) >>> 0;
    return r;
  }
  function ot(e) {
    let r = ui.get(e);
    return r !== undefined || (r = qo(e), nt(e), ne(23, r, Ye, Ze), ui.set(e, r)), r;
  }
  function Xo(e, r) {
    ne(4, e, ot(r), 0);
  }
  function Gr(e, r) {
    let n = e.get(r);
    return n === undefined && (n = new Map, e.set(r, n)), n;
  }
  function di(e, r, n) {
    const i = ot(r), a = n >>> 0, l = Gr(ii, e);
    if (l.get(i) === a) {
      Qe++;
      return;
    }
    l.set(i, a), ne(24, e, i, a), Ne++;
  }
  function fi(e, r, n) {
    const i = ot(r), a = Gr(oi, e);
    if (a.get(i) === n) {
      Qe++;
      return;
    }
    a.set(i, n), Rt[0] = n, ne(25, e, i, Xt[0]), Ne++;
  }
  function hi(e, r, n) {
    const i = ot(r), a = n == null ? "" : String(n), l = Gr(ai, e);
    if (l.get(i) === a) {
      Qe++;
      return;
    }
    l.set(i, a), nt(a);
    const c = Ye & 16777215, p = Ze & 255;
    ne(26, e, i, c << 8 | p), Ne++;
  }
  function Ko(e, r, n) {
    ne(27, e, ot(r), n);
  }
  var at = new Map, Ve = new Map, jr = globalThis.__skalNextCallId || 1;
  function gi(e, r) {
    for (let n = 0;n < r.length; n++) {
      const i = r[n];
      if (typeof i == "number")
        Number.isInteger(i) ? ne(29, e, 1, i | 0) : (Rt[0] = i, ne(29, e, 2, Xt[0]));
      else if (typeof i == "boolean")
        ne(29, e, 3, i ? 1 : 0);
      else if (typeof i == "string") {
        nt(i);
        const a = Ye >>> 0;
        ne(29, e, 4 | (Ze & 16777215) << 8, a);
      } else
        ne(29, e, 0, 0);
    }
  }
  function st(e, r, n) {
    const i = ot(r), a = jr++;
    return gi(a, n), ne(28, e, i, a), ee(), new Promise((l, c) => {
      at.set(a, { resolve: l, reject: c });
    });
  }
  function Jo(e, r, n, i, a) {
    const l = ot(r), c = jr++;
    gi(c, n), ne(30, e, l, c), ee(), Ve.set(c, { nodeId: e, onValue: i, onError: a && a.onError, onDone: a && a.onDone });
    let p = $t.get(e);
    return p === undefined && (p = new Set, $t.set(e, p)), p.add(c), function() {
      if (!Ve.has(c))
        return;
      Ve.delete(c);
      const v = $t.get(e);
      v && (v.delete(c), v.size === 0 && $t.delete(e)), ne(31, c, 0, 0), ee();
    };
  }
  function Yo(e) {
    const r = $t.get(e);
    if (r !== undefined) {
      for (const n of r)
        Ve.has(n) && (Ve.delete(n), ne(31, n, 0, 0));
      $t.delete(e), ee();
    }
  }
  var qr = new Map, pi = globalThis.__skalNextHandlerId || 1;
  function Xr(e) {
    const r = pi++;
    return qr.set(r, e), r;
  }
  function bi(e, r, n) {
    ne(21, e, r, n);
  }
  var Kr = 0n, lt = null, Jr = 1310736, Zo = 1572864, Qo = 65532, _i = new ArrayBuffer(4), Yr = new Float32Array(_i), Zr = new Uint32Array(_i), ea = new TextDecoder("utf-8");
  function Qr(e, r) {
    return r === 0 ? "" : ea.decode(Yn.subarray(Un + e, Un + e + r));
  }
  function en(e, r) {
    ge[bo] = e + r;
  }
  function vi() {
    const e = Atomics.load(dr, _o);
    if (e === Kr)
      return;
    const r = Jr + (ge[po] >> 2);
    let n = Jr + (ge[Xn] >> 2);
    const i = Zo, a = Jr;
    let l = Qo;
    for (;n !== r && l-- > 0; ) {
      const c = ge[n + 0], p = c & 255, h = c >>> 8 & 255, v = ge[n + 1], E = ge[n + 2], y = ge[n + 3];
      let A, g = false;
      if (h === 1)
        A = E | 0, g = true;
      else if (h === 2)
        Zr[0] = E, A = Yr[0], g = true;
      else if (h === 3)
        A = E !== 0, g = true;
      else if (h === 4)
        A = Qr(y, E), g = true, en(y, E);
      else if (h === 5) {
        const z = Qr(y, E);
        try {
          A = JSON.parse(z);
        } catch {
          A = z;
        }
        g = true, en(y, E);
      } else if (h === 6) {
        const z = Qr(y, E);
        try {
          A = JSON.parse(z);
        } catch {
          A = [];
        }
        g = true, en(y, E);
      } else if (h === 7) {
        Zr[0] = E;
        const z = Yr[0];
        Zr[0] = y, A = [z, Yr[0]], g = true;
      }
      if (p === 3) {
        const z = at.get(v);
        if (z) {
          at.delete(v);
          try {
            z.resolve(g ? A : undefined);
          } catch (T) {
            lt = T && (T.stack || T.message || String(T)) || "unknown";
          }
        }
      } else if (p === 4) {
        const z = at.get(v);
        if (z) {
          at.delete(v);
          try {
            const T = typeof A == "string" ? A : `skal RPC error (status ${A})`;
            z.reject(new Error(T));
          } catch (T) {
            lt = T && (T.stack || T.message || String(T)) || "unknown";
          }
        }
      } else if (p === 5) {
        const z = Ve.get(v);
        if (z)
          try {
            z.onValue(g ? A : undefined);
          } catch (T) {
            lt = T && (T.stack || T.message || String(T)) || "unknown";
          }
      } else if (p === 6) {
        const z = Ve.get(v);
        if (z) {
          Ve.delete(v);
          try {
            z.onDone && z.onDone();
          } catch (T) {
            lt = T && (T.stack || T.message || String(T)) || "unknown";
          }
        }
      } else if (p === 7) {
        const z = Ve.get(v);
        if (z) {
          Ve.delete(v);
          try {
            z.onError && z.onError(new Error(typeof A == "string" ? A : "skal stream error"));
          } catch (T) {
            lt = T && (T.stack || T.message || String(T)) || "unknown";
          }
        }
      } else {
        const z = qr.get(v);
        if (z)
          try {
            g ? (h === 6 || h === 7) && Array.isArray(A) ? z(...A) : z(A) : z();
          } catch (T) {
            lt = T && (T.stack || T.message || String(T)) || "unknown";
          }
      }
      n += 4, n >= i && (n = a);
    }
    ge[Xn] = n - a << 2, Kr = e;
  }
  if (ur && typeof window > "u" && !globalThis.__skalRelease) {
    const e = ho();
    e.setDrain(vi), e.configure({ cleanup() {
      globalThis.__skalNextCallId = jr, globalThis.__skalNextHandlerId = pi;
      for (const r of at.values())
        try {
          r.reject(new Error("skal: hot reload"));
        } catch {}
      at.clear();
    } });
  } else
    globalThis.__skal_drainEvents = vi;
  globalThis.skalStatus = () => JSON.stringify({ handlerCount: qr.size, opSeq: Number(fr), lastEventSeq: Number(Kr), lastHandlerError: lt, propWrites: Ne, propSkips: Qe });
  var cd = 1, ta = 2;
  function mi() {
    return ta++;
  }
  var ra = { box: 0, column: 1, scrollView: 5, listView: 6, reorderableListView: 7, row: 2, text: 3, button: 4, image: 9, stack: 10, switch: 11, slider: 12, checkbox: 13, activityIndicator: 14, progressBar: 15, lazyGrid: 16, wrap: 17, safeArea: 18, richText: 19, textInput: 20, navigator: 21, screen: 22, tabs: 23, tab: 24, animatedList: 25, crossFade: 26, hero: 27, listTile: 28, pageView: 29, dismissible: 30, customScrollView: 31, sliverAppBar: 32, sliverList: 33, sliverGrid: 34, canvas: 35, dragItem: 36, dropZone: 37, radio: 38, chip: 39, segmentedButton: 40, expansionTile: 41, dropdown: 42, stepper: 43, step: 44, drawer: 45, bottomSheet: 46, backdropFilter: 47, interactiveViewer: 48, htmlEmbed: 49 };
  function na() {
    const e = [], r = { _cmds: e, fillStyle(n) {
      return e.push(["fillStyle", tn(n)]), r;
    }, strokeStyle(n) {
      return e.push(["strokeStyle", tn(n)]), r;
    }, lineWidth(n) {
      return e.push(["lineWidth", +n || 0]), r;
    }, fillRect(n, i, a, l) {
      return e.push(["fillRect", +n, +i, +a, +l]), r;
    }, strokeRect(n, i, a, l) {
      return e.push(["strokeRect", +n, +i, +a, +l]), r;
    }, circle(n, i, a) {
      return e.push(["circle", +n, +i, +a]), r;
    }, line(n, i, a, l) {
      return e.push(["line", +n, +i, +a, +l]), r;
    }, beginPath() {
      return e.push(["beginPath"]), r;
    }, moveTo(n, i) {
      return e.push(["moveTo", +n, +i]), r;
    }, lineTo(n, i) {
      return e.push(["lineTo", +n, +i]), r;
    }, closePath() {
      return e.push(["closePath"]), r;
    }, fill() {
      return e.push(["fill"]), r;
    }, stroke() {
      return e.push(["stroke"]), r;
    }, fontSize(n) {
      return e.push(["fontSize", +n || 14]), r;
    }, fillText(n, i, a) {
      return e.push(["fillText", String(n), +i, +a]), r;
    } };
    return r;
  }
  var ia = { padding: [0, "u32"], paddingTop: [1, "u32"], paddingRight: [2, "u32"], paddingBottom: [3, "u32"], paddingLeft: [4, "u32"], width: [5, "dim"], height: [6, "dim"], weight: [7, "f32"], alignment: [8, "u32"], gap: [9, "u32"], axis: [10, "u32"], top: [11, "u32"], right: [12, "u32"], bottom: [13, "u32"], left: [14, "u32"], crossAxisCount: [15, "u32"], aspectRatio: [16, "f32"], background: [32, "color"], color: [33, "color"], cornerRadius: [34, "u32"], borderWidth: [35, "u32"], borderColor: [36, "color"], shadow: [37, "u32"], fontSize: [64, "u32"], fontWeight: [65, "u32"], fontFamily: [66, "u32"], textAlign: [67, "u32"], lineHeight: [68, "u32"], maxLines: [69, "u32"], textOverflow: [70, "u32"], src: [96, "str"], contentScale: [97, "u32"], placeholder: [128, "str"], value: [129, "str"], keyboardType: [130, "u32"], secureEntry: [131, "u32"], checked: [132, "u32"], min: [134, "f32"], max: [135, "f32"], progress: [136, "f32"], initialSize: [176, "f32"], minSize: [177, "f32"], maxSize: [178, "f32"], presentation: [166, "u32"], title: [71, "str"], icon: [98, "str"], leadingIcon: [98, "str"], subtitle: [73, "str"], trailingIcon: [99, "str"], activeTab: [137, "u32"], tag: [72, "str"], transition: [171, "u32"], enabled: [160, "u32"], focusable: [161, "u32"], visible: [162, "u32"], draggable: [172, "u32"], spring: [173, "u32"], release: [174, "u32"], sliverMode: [175, "u32"], dragData: [74, "str"], scrollbar: [179, "u32"], blurRadius: [180, "u32"], minScale: [181, "f32"], maxScale: [182, "f32"], viewType: [183, "str"], semanticLabel: [75, "str"], testID: [76, "str"] }, oa = { opacity: Co, translationX: Io, translationY: zo, scaleX: Do, scaleY: No, rotation: Lo }, aa = { onClick: 1, onclick: 1, onTap: 1, onLongPress: 8, onDoubleTap: 9, onChange: 2, onSubmit: 10, onReorder: 11, onPop: 12, onDismiss: 20, onPanStart: 13, onPanUpdate: 14, onPanEnd: 15, onScaleStart: 16, onScaleUpdate: 17, onScaleEnd: 18, onDrop: 21, onHover: 22, onKey: 23 }, sa = { linear: 0, easeIn: 1, easeOut: 2, easeInOut: 3, bounce: 4, elastic: 5, fastOutSlowIn: 6 }, la = { gentle: 1, bouncy: 2, stiff: 3 };
  function tn(e) {
    if (typeof e == "number")
      return e | 0;
    if (typeof e != "string")
      return 0;
    let r = e.trim();
    r.startsWith("#") && (r = r.slice(1));
    let n = 0, i = 0, a = 0, l = 255;
    return r.length === 3 ? (n = parseInt(r[0] + r[0], 16), i = parseInt(r[1] + r[1], 16), a = parseInt(r[2] + r[2], 16)) : r.length === 4 ? (n = parseInt(r[0] + r[0], 16), i = parseInt(r[1] + r[1], 16), a = parseInt(r[2] + r[2], 16), l = parseInt(r[3] + r[3], 16)) : r.length === 6 ? (n = parseInt(r.slice(0, 2), 16), i = parseInt(r.slice(2, 4), 16), a = parseInt(r.slice(4, 6), 16)) : r.length === 8 && (l = parseInt(r.slice(0, 2), 16), n = parseInt(r.slice(2, 4), 16), i = parseInt(r.slice(4, 6), 16), a = parseInt(r.slice(6, 8), 16)), (l & 255) << 24 | (n & 255) << 16 | (i & 255) << 8 | a & 255 | 0;
  }
  function ca(e) {
    return typeof e == "number" ? e | 0 : e === "fill" ? mo : e === "wrap" ? wo : -1;
  }
  function ua(e) {
    if (Array.isArray(e))
      return true;
    const r = Object.getPrototypeOf(e);
    return r === Object.prototype || r === null;
  }
  function da(e, r, n) {
    if (n == null)
      return;
    if (r === "ref" && n && typeof n.__skalBind == "function") {
      n.__skalBind(e.id);
      return;
    }
    const i = typeof n;
    if (i === "object" && ua(n)) {
      hi(e.id, r, JSON.stringify(n)), ee();
      return;
    }
    if (i === "function") {
      const a = Xr(n);
      Ko(e.id, r, a), ee();
      return;
    }
    if (i === "number") {
      Number.isInteger(n) && n >= 0 && n <= 4294967295 && di(e.id, r, n | 0), fi(e.id, r, n), ee();
      return;
    }
    if (i === "string") {
      hi(e.id, r, n), ee();
      return;
    }
    if (i === "boolean") {
      di(e.id, r, n ? 1 : 0), ee();
      return;
    }
  }
  function fa(e) {
    const r = [e];
    for (;r.length > 0; ) {
      const n = r.pop();
      Fo(n.id);
      let i = n.firstChild;
      for (;i; )
        r.push(i), i = i.nextSibling;
    }
  }
  var mr = class {
    constructor(e, r, n = false, i = false) {
      this.tag = e, this.id = r, this.isText = n, this.isCustom = i, this.parent = null, this.firstChild = null, this.lastChild = null, this.nextSibling = null, this.prevSibling = null, this.text = "";
    }
  }, ha = Wn({ createElement(e) {
    const r = mi(), n = ra[e];
    return n !== undefined ? (ne(1, r, n, 0), ee(), new mr(e, r, false, false)) : (Xo(r, e), ee(), new mr(e, r, false, true));
  }, createTextNode(e) {
    const r = mi();
    ne(1, r, 3, 0);
    const n = e == null ? "" : String(e);
    n.length > 0 && gr(r, n), ee();
    const i = new mr("#text", r, true);
    return i.text = n, i;
  }, replaceText(e, r) {
    const n = r == null ? "" : String(r);
    e.text !== n && (e.text = n, gr(e.id, n), ee());
  }, setProperty(e, r, n, i) {
    if (e.isCustom) {
      da(e, r, n);
      return;
    }
    if (r === "onRefresh") {
      if (typeof n == "function") {
        const p = e.id, h = n, E = Xr(async () => {
          try {
            await h();
          } finally {
            Wo(p);
          }
        });
        bi(e.id, 19, E), ee();
      }
      return;
    }
    if (r === "draw" && typeof n == "function") {
      const p = n, h = e;
      xt(() => {
        const v = na();
        try {
          p(v);
        } catch {}
        const E = JSON.stringify(v._cmds);
        E !== h._skalCanvasProgram && (h._skalCanvasProgram = E, gr(h.id, E), ee());
      });
      return;
    }
    const a = aa[r];
    if (a !== undefined) {
      if (typeof n == "function") {
        const p = Xr(n);
        bi(e.id, a, p), ee();
      }
      return;
    }
    if (r === "value" && e.tag === "slider") {
      si(e.id, 133, Number(n) || 0), ee();
      return;
    }
    if (r === "draggable" && typeof n == "string") {
      we(e.id, 172, { free: 1, both: 1, horizontal: 2, x: 2, vertical: 3, y: 3 }[n] ?? 0), ee();
      return;
    }
    if (r === "spring" && typeof n == "string") {
      we(e.id, 173, { gentle: 1, bouncy: 2, stiff: 3, wobbly: 2 }[n] ?? 0), ee();
      return;
    }
    if (r === "release" && typeof n == "string") {
      we(e.id, 174, { none: 0, glide: 1, friction: 1, springback: 2, spring: 2 }[n.toLowerCase()] ?? 0), ee();
      return;
    }
    if (r === "sliverMode" && typeof n == "string") {
      we(e.id, 175, { normal: 0, pinned: 1, floating: 2, both: 3 }[n.toLowerCase()] ?? 0), ee();
      return;
    }
    if (r === "animate" && n && typeof n == "object") {
      if (we(e.id, 163, n.duration | 0), n.curve != null) {
        const p = typeof n.curve == "string" ? sa[n.curve] ?? 0 : n.curve | 0;
        we(e.id, 164, p);
      }
      if (n.delay != null && we(e.id, 165, n.delay | 0), n.repeat != null && we(e.id, 167, n.repeat ? 1 : 0), n.reverse != null && we(e.id, 168, n.reverse ? 1 : 0), n.loop != null && we(e.id, 169, n.loop | 0), n.spring != null) {
        const p = typeof n.spring == "string" ? la[n.spring] ?? 0 : n.spring ? 2 : 0;
        we(e.id, 170, p);
      }
      ee();
      return;
    }
    if (r === "label" && (e.tag === "button" || e.tag === "text" || e.tag === "chip")) {
      const p = n == null ? "" : String(n);
      gr(e.id, p), ee();
      return;
    }
    const l = oa[r];
    if (l !== undefined) {
      typeof n == "number" && (l(e.id, n), ee());
      return;
    }
    const c = ia[r];
    if (c !== undefined) {
      const [p, h] = c;
      if (n == null)
        return;
      switch (h) {
        case "u32":
          typeof n == "number" ? (we(e.id, p, n | 0), ee()) : typeof n == "boolean" && (we(e.id, p, n ? 1 : 0), ee());
          return;
        case "f32":
          typeof n == "number" && (si(e.id, p, n), ee());
          return;
        case "str":
          Oo(e.id, p, String(n)), ee();
          return;
        case "color":
          we(e.id, p, tn(n)), ee();
          return;
        case "dim":
          we(e.id, p, ca(n)), ee();
          return;
      }
      return;
    }
    if (r === "style" && n && typeof n == "object") {
      for (const p in n)
        this.setProperty(e, p, n[p]);
      return;
    }
  }, insertNode(e, r, n) {
    if (r === n)
      return;
    if (r.parent) {
      const a = r.parent;
      r.prevSibling ? r.prevSibling.nextSibling = r.nextSibling : a.firstChild === r && (a.firstChild = r.nextSibling), r.nextSibling ? r.nextSibling.prevSibling = r.prevSibling : a.lastChild === r && (a.lastChild = r.prevSibling), r.prevSibling = null, r.nextSibling = null;
    }
    const i = n ? n.id : 0;
    ne(3, e.id, r.id, i), ee(), r.parent = e, n ? (r.nextSibling = n, r.prevSibling = n.prevSibling, n.prevSibling ? n.prevSibling.nextSibling = r : e.firstChild = r, n.prevSibling = r) : (r.prevSibling = e.lastChild, r.nextSibling = null, e.lastChild ? e.lastChild.nextSibling = r : e.firstChild = r, e.lastChild = r);
  }, removeNode(e, r) {
    ne(2, r.id, 0, 0), fa(r), ee(), r.prevSibling ? r.prevSibling.nextSibling = r.nextSibling : e.firstChild = r.nextSibling, r.nextSibling ? r.nextSibling.prevSibling = r.prevSibling : e.lastChild = r.prevSibling, r.parent = null, r.prevSibling = null, r.nextSibling = null;
  }, isTextNode(e) {
    return e.isText;
  }, getParentNode(e) {
    return e.parent;
  }, getFirstChild(e) {
    return e.firstChild;
  }, getNextSibling(e) {
    return e.nextSibling;
  } }), { render: rn, effect: q, memo: nn, createComponent: L, createElement: s, createTextNode: ud, insertNode: _, insert: B, spread: dd, setProp: t, mergeProps: fd, use: ga } = ha;
  ne(1, 1, 0, 0), ee();
  var on = new mr("box", 1, false);
  globalThis.__skalHot && globalThis.__skalHot.configure({ render: (e) => rn(e, on), reset: () => Ro() });
  var wi = "/flutter-web-plugins", At = null;
  async function Si() {
    return At || (globalThis.__skalPluginCall ? (At = Promise.resolve(), At) : (At = pa(), At));
  }
  async function pa() {
    if (typeof document > "u")
      throw new Error("Skal plugin bridge: ensurePluginHost called with no DOM (SSR? worker?). The hidden Flutter Web host needs a real DOM to mount into.");
    const e = document.createElement("div");
    e.id = "skal-plugin-host", e.setAttribute("aria-hidden", "true"), e.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;left:-9999px;top:-9999px;pointer-events:none;contain:strict;overflow:hidden", document.body.appendChild(e), globalThis.__skalPluginHostMount = e;
    const r = new Promise((a) => {
      if (globalThis.__skalPluginCall)
        return a();
      const l = () => {
        window.removeEventListener("skal-plugin-host-ready", l), a();
      };
      window.addEventListener("skal-plugin-host-ready", l, { once: true });
    }), n = document.createElement("script");
    n.src = `${wi}/flutter_bootstrap.js`, n.async = true;
    const i = new Promise((a, l) => {
      n.onerror = () => l(new Error(`Skal plugin bridge: failed to load ${n.src}. Did you build the plugin host (\`bun run build:flutter-plugins\`) and is the vite middleware (Phase 3) serving ${wi}/*?`));
    });
    if (document.head.appendChild(n), await Promise.race([r, i]), typeof globalThis.__skalPluginCall != "function")
      throw new Error(`Skal plugin bridge: host signaled ready but __skalPluginCall is not a function (got ${typeof globalThis.__skalPluginCall}).`);
  }
  var an = Promise.resolve();
  async function ba(e) {
    await Si();
    const r = globalThis.__skalFlutterApp;
    if (!r || typeof r.addView != "function")
      throw new Error("Skal plugin bridge: addView not available. Multi-view requires Flutter Web 3.10+ with multiViewEnabled:true in the bootstrap config.");
    return an = an.catch(() => {}).then(async () => {
      const n = await r.addView({ hostElement: e });
      return await new Promise((i) => requestAnimationFrame(i)), n;
    }), an;
  }
  async function _a(e) {
    const r = globalThis.__skalFlutterApp;
    !r || typeof r.removeView != "function" || await r.removeView(e);
  }
  async function sn(e, r) {
    await Si();
    const n = JSON.stringify(r ?? {}), i = await globalThis.__skalPluginCall(e, n);
    let a;
    try {
      a = JSON.parse(i);
    } catch {
      throw new Error(`Skal plugin bridge: host returned non-JSON for "${e}": ${i}`);
    }
    if (!a || typeof a != "object")
      throw new Error(`Skal plugin bridge: host returned non-envelope for "${e}": ${i}`);
    if (a.ok === true)
      return a.value;
    const l = new Error(a.error || `Skal plugin "${e}" failed`);
    throw a.stack && (l.stack = a.stack), l;
  }
  var va = { column: "div", scrollView: "div", listView: "div", reorderableListView: "div", row: "div", box: "div", text: "span", button: "button", image: "img", stack: "div", switch: "input", slider: "input", checkbox: "input", activityIndicator: "div", progressBar: "progress", lazyGrid: "div", wrap: "div", safeArea: "div", richText: "span", textInput: "input", navigator: "div", screen: "div", tabs: "div", tab: "div", animatedList: "div", crossFade: "div", hero: "div", listTile: "div", pageView: "div", dismissible: "div", flutterEmbed: "div", customScrollView: "div", sliverAppBar: "div", sliverList: "div", sliverGrid: "div", canvas: "canvas", dragItem: "div", dropZone: "div", radio: "input", chip: "div", segmentedButton: "div", expansionTile: "div", dropdown: "select", stepper: "div", step: "div", drawer: "aside", bottomSheet: "div", backdropFilter: "div", interactiveViewer: "div" };
  if (typeof document < "u" && !document.getElementById("skal-kf")) {
    const e = document.createElement("style");
    e.id = "skal-kf", e.textContent = "@keyframes skal-spin{to{transform:rotate(360deg)}}", document.head.appendChild(e);
  }
  var ma = { grid: "\u25A6", list: "\u2630", explore: "\u29BF", code: "\u27E8\u27E9", storage: "\u2630", home: "\u2302", settings: "\u2699", search: "\uD83D\uDD0D", user: "\u263B", heart: "\u2661", star: "\u2605", plus: "+" }, wa = "#0A84FF", Sa = "#8E8E93", ya = "#F2F2F7", xa = "#E5E5EA";
  function ka(e) {
    const r = [];
    for (const n of e.children)
      n._skalTag === "tab" && r.push(n);
    return r;
  }
  function Ta(e) {
    let r = e._skalBar;
    return r && r.parentElement === e || (r = document.createElement("div"), r.setAttribute("role", "tablist"), r.style.cssText = `display:flex;flex-direction:row;align-items:stretch;flex:0 0 auto;border-top:1px solid ${xa};background:${ya};padding:6px 4px;padding-bottom:calc(6px + env(safe-area-inset-bottom, 0px));min-height:50px;gap:4px;user-select:none;box-sizing:border-box;`, e.appendChild(r), e._skalBar = r), r;
  }
  function Ea(e) {
    return new Promise((r) => {
      if (e.offsetWidth > 0 && e.offsetHeight > 0) {
        r();
        return;
      }
      if (typeof ResizeObserver > "u") {
        requestAnimationFrame(() => r());
        return;
      }
      const n = new ResizeObserver((i) => {
        for (const a of i) {
          const l = a.contentRect;
          if (l.width > 0 && l.height > 0) {
            n.disconnect(), r();
            return;
          }
        }
      });
      n.observe(e);
    });
  }
  async function $a(e) {
    return e._skalViewPromise || (e._skalViewPromise = (async () => {
      if (await Ea(e), e._skalEmbedRemoved)
        throw new Error("Skal <flutterEmbed>: removed before view could be added");
      const r = await ba(e);
      return typeof window < "u" && requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      }), r;
    })()), e._skalViewPromise;
  }
  function ln(e) {
    e._skalSyncScheduled || (e._skalSyncScheduled = true, queueMicrotask(async () => {
      e._skalSyncScheduled = false;
      const r = e._skalEmbedWidget;
      if (r)
        try {
          const n = await $a(e);
          if (e._skalEmbedRemoved)
            return;
          await sn("embed.setSpec", { viewId: n, widget: r, props: e._skalEmbedProps || {} });
        } catch (n) {
          console.error(`Skal <flutterEmbed widget="${r}"> failed:`, n);
        }
    }));
  }
  async function Ra(e) {
    if (e._skalEmbedRemoved = true, !!e._skalViewPromise)
      try {
        const r = await e._skalViewPromise;
        try {
          await sn("embed.unsetSpec", { viewId: r });
        } catch {}
        await _a(r);
      } catch (r) {
        console.warn("Skal <flutterEmbed> teardown failed:", r);
      }
  }
  function wr(e) {
    e._skalTabsRenderScheduled || (e._skalTabsRenderScheduled = true, queueMicrotask(() => {
      e._skalTabsRenderScheduled = false, Pa(e);
    }));
  }
  function Pa(e) {
    const r = ka(e), n = e._skalActiveTab | 0, i = r.length === 0 ? 0 : Math.min(Math.max(n, 0), r.length - 1);
    for (let l = 0;l < r.length; l++) {
      const c = r[l];
      l === i ? (c.style.display = "flex", c.style.flexDirection = "column", c.style.flex = "1 1 auto", c.style.minHeight = "0", c.style.overflow = "auto") : c.style.display = "none";
    }
    const a = Ta(e);
    a.innerHTML = "";
    for (let l = 0;l < r.length; l++) {
      const c = r[l], p = l === i, h = document.createElement("button");
      h.type = "button", h.setAttribute("role", "tab"), h.setAttribute("aria-selected", p ? "true" : "false"), h.style.cssText = "flex:1 1 0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:transparent;border:0;cursor:pointer;font:inherit;padding:4px 2px;gap:2px;line-height:1.15;font-size:11px;color:" + (p ? wa : Sa) + ";";
      const v = c._skalIcon;
      if (v) {
        const y = document.createElement("span");
        y.textContent = ma[v] || "\u25CF", y.style.cssText = "font-size:20px;line-height:1;", h.appendChild(y);
      }
      const E = c._skalTitle;
      if (E) {
        const y = document.createElement("span");
        y.textContent = E, h.appendChild(y);
      }
      h.onclick = () => {
        const y = e._skalOnChange;
        typeof y == "function" && y(l);
      }, a.appendChild(h);
    }
  }
  function Aa(e, r) {
    const n = e.style;
    switch (r) {
      case "column":
        n.display = "flex", n.flexDirection = "column", n.alignItems = "flex-start", n.boxSizing = "border-box", n.width = "100%", n.padding = "16px", n.gap = "8px";
        break;
      case "scrollView":
      case "listView":
      case "reorderableListView":
        n.display = "flex", n.flexDirection = "column", n.alignItems = "flex-start", n.boxSizing = "border-box", n.width = "100%", n.height = "100%", n.overflowY = "auto", n.padding = "16px", n.gap = "8px", n.webkitOverflowScrolling = "touch";
        break;
      case "row":
        n.display = "flex", n.flexDirection = "row", n.boxSizing = "border-box", n.overflowX = "auto", n.scrollbarWidth = "none", n.msOverflowStyle = "none";
        break;
      case "listTile":
        n.display = "flex", n.flexDirection = "row", n.alignItems = "center", n.boxSizing = "border-box", n.width = "100%", n.minHeight = "56px", n.padding = "8px 16px", n.gap = "16px";
        break;
      case "pageView":
        n.display = "flex", n.flexDirection = "row", n.boxSizing = "border-box", n.width = "100%", n.height = "100%", n.overflowX = "auto", n.scrollSnapType = "x mandatory", n.scrollbarWidth = "none", n.msOverflowStyle = "none";
        break;
      case "customScrollView":
        n.display = "flex", n.flexDirection = "column", n.boxSizing = "border-box", n.width = "100%", n.height = "100%", n.overflowY = "auto", n.webkitOverflowScrolling = "touch";
        break;
      case "sliverAppBar":
        n.position = "sticky", n.top = "0", n.zIndex = "1", n.boxSizing = "border-box", n.width = "100%";
        break;
      case "sliverList":
        n.display = "flex", n.flexDirection = "column", n.boxSizing = "border-box", n.width = "100%";
        break;
      case "sliverGrid":
        n.display = "grid", n.boxSizing = "border-box", n.width = "100%";
        break;
      case "box":
        n.display = "block", n.position = "relative", n.boxSizing = "border-box";
        break;
      case "stack":
        n.display = "block", n.position = "relative", n.boxSizing = "border-box";
        break;
      case "switch":
      case "checkbox":
        e.type = "checkbox";
        break;
      case "slider":
        e.type = "range", e.min = "0", e.max = "1", e.step = "any", n.width = "100%";
        break;
      case "activityIndicator":
        n.width = "24px", n.height = "24px", n.boxSizing = "border-box", n.border = "3px solid rgba(0,0,0,0.15)", n.borderTopColor = "rgba(0,0,0,0.55)", n.borderRadius = "50%", n.animation = "skal-spin 0.8s linear infinite";
        break;
      case "progressBar":
        n.width = "100%";
        break;
      case "text":
        n.fontFamily = 'ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace', n.whiteSpace = "pre-line";
        break;
      case "button":
        n.display = "inline-flex", n.alignItems = "center", n.justifyContent = "center", n.padding = "8px 24px", n.background = "#6750A4", n.color = "#FFFFFF", n.border = "none", n.borderRadius = "20px", n.fontSize = "14px", n.fontWeight = "500", n.cursor = "pointer", n.fontFamily = "inherit", n.boxSizing = "border-box";
        break;
      case "image":
        n.display = "block", n.objectFit = "contain";
        break;
      case "lazyGrid":
        n.display = "grid", n.gridTemplateColumns = "repeat(2, 1fr)", n.gap = "8px", n.boxSizing = "border-box", n.width = "100%", n.padding = "16px", n.overflowY = "auto";
        break;
      case "wrap":
        n.display = "flex", n.flexWrap = "wrap", n.gap = "8px", n.boxSizing = "border-box";
        break;
      case "safeArea":
        n.display = "block", n.boxSizing = "border-box", n.paddingTop = "env(safe-area-inset-top)", n.paddingBottom = "env(safe-area-inset-bottom)", n.paddingLeft = "env(safe-area-inset-left)", n.paddingRight = "env(safe-area-inset-right)";
        break;
      case "richText":
        n.fontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, sans-serif', n.whiteSpace = "pre-line";
        break;
      case "textInput":
        e.type = "text", n.boxSizing = "border-box", n.padding = "8px 12px", n.border = "1px solid rgba(0,0,0,0.4)", n.borderRadius = "4px", n.fontSize = "14px", n.fontFamily = "inherit";
        break;
      case "navigator":
        n.position = "relative", n.overflow = "hidden", n.boxSizing = "border-box", n.width = "100%", n.height = "100%", n.flex = "1 1 auto", n.minHeight = "0";
        break;
      case "screen":
        n.position = "absolute", n.inset = "0", n.overflow = "auto", n.boxSizing = "border-box", n.background = "#FFFFFF";
        break;
      case "tabs":
        n.display = "flex", n.flexDirection = "column", n.boxSizing = "border-box", n.height = "100%", n.minHeight = "0", n.overflow = "hidden";
        break;
      case "tab":
        n.display = "block", n.boxSizing = "border-box";
        break;
      case "flutterEmbed":
        n.display = "block", n.boxSizing = "border-box", n.position = "relative", n.width = "100%", n.alignSelf = "stretch", n.overflow = "hidden";
        break;
    }
  }
  var Fa = ["contain", "cover", "fill", "contain", "contain", "none", "scale-down"];
  function cn(e) {
    if (e == null)
      return null;
    if (typeof e == "number") {
      const c = e >>> 24 & 255;
      return `rgba(${e >>> 16 & 255}, ${e >>> 8 & 255}, ${e & 255}, ${(c / 255).toFixed(3)})`;
    }
    if (typeof e != "string")
      return null;
    let r = e.trim();
    r.startsWith("#") && (r = r.slice(1));
    let n = 0, i = 0, a = 0, l = 255;
    if (r.length === 3)
      n = parseInt(r[0] + r[0], 16), i = parseInt(r[1] + r[1], 16), a = parseInt(r[2] + r[2], 16);
    else if (r.length === 6)
      n = parseInt(r.slice(0, 2), 16), i = parseInt(r.slice(2, 4), 16), a = parseInt(r.slice(4, 6), 16);
    else if (r.length === 8)
      l = parseInt(r.slice(0, 2), 16), n = parseInt(r.slice(2, 4), 16), i = parseInt(r.slice(4, 6), 16), a = parseInt(r.slice(6, 8), 16);
    else
      return e;
    return `rgba(${n}, ${i}, ${a}, ${(l / 255).toFixed(3)})`;
  }
  function yi(e) {
    return typeof e == "number" ? `${e}px` : e === "fill" ? "100%" : e === "wrap" ? "auto" : typeof e == "string" ? e : null;
  }
  var xi = { 0: 'system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, sans-serif', 1: '"Times New Roman", Times, serif', 2: 'ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace', 3: 'system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, sans-serif' }, Oa = { linear: 0, easeIn: 1, easeOut: 2, easeInOut: 3, bounce: 4, elastic: 5, fastOutSlowIn: 6 }, Ca = ["linear", "ease-in", "ease-out", "ease-in-out", "cubic-bezier(.4,0,.2,1)", "cubic-bezier(.4,0,.2,1)", "cubic-bezier(.4,0,.2,1)"], Ia = ["start", "center", "end", "justify"], za = ["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"];
  function ct(e) {
    return e._skalHot || (e._skalHot = { tx: 0, ty: 0, sx: 1, sy: 1, rz: 0 }, e.style.willChange = "transform, opacity"), e._skalHot;
  }
  function je(e) {
    const r = e._skalHot;
    r && (e.style.transform = `translate(${r.tx}px, ${r.ty}px) scale(${r.sx}, ${r.sy}) rotate(${r.rz}deg)`);
  }
  function un(e) {
    if (e._skalGAttached)
      return;
    e._skalGAttached = true, e.style.touchAction = "none";
    const r = new Map;
    let n = -1, i = 0, a = 0, l = 0, c = 0, p = 0, h = 1, v = 0, E = false;
    e.addEventListener("pointerdown", (A) => {
      const g = e._skalG;
      if (!g)
        return;
      r.set(A.pointerId, { x: A.clientX, y: A.clientY });
      const z = g.scaleStart || g.scaleUpdate || g.scaleEnd;
      if (r.size === 2 && z) {
        const [F, N] = [...r.values()];
        h = Math.hypot(F.x - N.x, F.y - N.y) || 1, v = Math.atan2(N.y - F.y, N.x - F.x), E = true, g.scaleStart && g.scaleStart();
        return;
      }
      const T = g.panStart || g.panUpdate || g.panEnd || g.draggable;
      if (n === -1 && T && !z) {
        e._skalReleaseCancel && (e._skalReleaseCancel(), e._skalReleaseCancel = null), n = A.pointerId, e.setPointerCapture(A.pointerId);
        const F = e.getBoundingClientRect();
        i = A.clientX, a = A.clientY, l = A.timeStamp, c = 0, p = 0, g.panStart && g.panStart(A.clientX - F.left, A.clientY - F.top);
      }
    }), e.addEventListener("pointermove", (A) => {
      const g = e._skalG;
      if (!g)
        return;
      if (r.has(A.pointerId) && r.set(A.pointerId, { x: A.clientX, y: A.clientY }), E && r.size >= 2) {
        const [N, x] = [...r.values()], P = Math.hypot(N.x - x.x, N.y - x.y), f = Math.atan2(x.y - N.y, x.x - N.x) - v;
        g.scaleUpdate && g.scaleUpdate(P / h, f);
        return;
      }
      if (A.pointerId !== n)
        return;
      const z = A.clientX - i, T = A.clientY - a, F = Math.max(1, A.timeStamp - l);
      if (c = z / F * 1000, p = T / F * 1000, i = A.clientX, a = A.clientY, l = A.timeStamp, g.draggable) {
        const N = ct(e);
        g.draggable !== 3 && (N.tx += z), g.draggable !== 2 && (N.ty += T), je(e);
      } else
        g.panUpdate && g.panUpdate(z, T);
    });
    const y = (A) => {
      const g = e._skalG;
      if (r.delete(A.pointerId), E && r.size < 2 && (E = false, g && g.scaleEnd && g.scaleEnd()), A.pointerId === n && (n = -1, !!g)) {
        if (g.draggable && g.release)
          Da(e, g, c, p);
        else if (g.panEnd)
          if (g.draggable) {
            const z = e._skalHot || { tx: 0, ty: 0 };
            g.panEnd(z.tx, z.ty);
          } else
            g.panEnd(c, p);
      }
    };
    e.addEventListener("pointerup", y), e.addEventListener("pointercancel", y);
  }
  function Da(e, r, n, i) {
    const a = ct(e), l = r.release === 2, c = 2 * Math.sqrt(200) * 0.7;
    r.draggable === 2 && (i = 0), r.draggable === 3 && (n = 0);
    let p = performance.now(), h = 0;
    const v = (E) => {
      let y = (E - p) / 1000;
      if (p = E, y > 0.05 && (y = 0.05), l) {
        if (n += (-200 * a.tx - c * n) * y, i += (-200 * a.ty - c * i) * y, a.tx += n * y, a.ty += i * y, Math.abs(a.tx) < 0.5 && Math.abs(a.ty) < 0.5 && Math.abs(n) < 5 && Math.abs(i) < 5) {
          a.tx = 0, a.ty = 0, je(e), e._skalReleaseCancel = null, r.panEnd && r.panEnd(0, 0);
          return;
        }
      } else {
        const A = Math.exp(-3 * y);
        if (n *= A, i *= A, a.tx += n * y, a.ty += i * y, Math.abs(n) < 5 && Math.abs(i) < 5) {
          je(e), e._skalReleaseCancel = null, r.panEnd && r.panEnd(a.tx, a.ty);
          return;
        }
      }
      je(e), h = requestAnimationFrame(v);
    };
    e._skalReleaseCancel = () => {
      h && cancelAnimationFrame(h);
    }, h = requestAnimationFrame(v);
  }
  var Na = { onPanStart: "panStart", onPanUpdate: "panUpdate", onPanEnd: "panEnd", onScaleStart: "scaleStart", onScaleUpdate: "scaleUpdate", onScaleEnd: "scaleEnd" }, La = { free: 1, both: 1, horizontal: 2, x: 2, vertical: 3, y: 3 }, Ma = { none: 0, glide: 1, friction: 1, springback: 2, spring: 2 }, Ba = { gentle: 1, bouncy: 2, stiff: 3, wobbly: 2 };
  function Va(e, r, n) {
    const i = e.style;
    switch (r) {
      case "padding":
        i.padding = `${n}px`;
        return;
      case "paddingTop":
        i.paddingTop = `${n}px`;
        return;
      case "paddingRight":
        i.paddingRight = `${n}px`;
        return;
      case "paddingBottom":
        i.paddingBottom = `${n}px`;
        return;
      case "paddingLeft":
        i.paddingLeft = `${n}px`;
        return;
      case "width": {
        const a = yi(n);
        a != null && (i.width = a);
        return;
      }
      case "height": {
        const a = yi(n);
        a != null && (i.height = a);
        return;
      }
      case "weight":
        i.flexGrow = String(n);
        return;
      case "gap":
        i.gap = `${n}px`;
        return;
      case "alignment": {
        const a = za[n];
        a && (i.justifyContent = a);
        return;
      }
      case "axis":
        n === 1 ? (i.flexDirection = "row", i.overflowX = "auto", i.overflowY = "hidden") : (i.flexDirection = "column", i.overflowX = "hidden", i.overflowY = "auto");
        return;
      case "crossAxisCount":
        i.gridTemplateColumns = `repeat(${n}, 1fr)`;
        return;
      case "aspectRatio":
        return;
      case "top":
        i.position = "absolute", i.top = `${n}px`;
        return;
      case "right":
        i.position = "absolute", i.right = `${n}px`;
        return;
      case "bottom":
        i.position = "absolute", i.bottom = `${n}px`;
        return;
      case "left":
        i.position = "absolute", i.left = `${n}px`;
        return;
      case "background": {
        const a = cn(n);
        a && (i.background = a);
        return;
      }
      case "color": {
        const a = cn(n);
        a && (i.color = a);
        return;
      }
      case "cornerRadius":
        i.borderRadius = `${n}px`;
        return;
      case "borderWidth":
        i.borderWidth = `${n}px`, i.borderStyle = "solid";
        return;
      case "borderColor": {
        const a = cn(n);
        a && (i.borderColor = a);
        return;
      }
      case "shadow":
        i.boxShadow = `0 ${n / 2}px ${n}px rgba(0,0,0,0.2)`;
        return;
      case "fontSize":
        i.fontSize = `${n}px`;
        return;
      case "fontWeight":
        i.fontWeight = String(n);
        return;
      case "fontFamily":
        i.fontFamily = xi[n] || xi[0];
        return;
      case "textAlign":
        i.textAlign = Ia[n] || "start";
        return;
      case "lineHeight":
        i.lineHeight = `${n}px`;
        return;
      case "maxLines":
        n && n > 0 && n !== 2147483647 && (i.display = "-webkit-box", i.webkitLineClamp = String(n), i.webkitBoxOrient = "vertical", i.overflow = "hidden");
        return;
      case "textOverflow":
        n === 1 ? i.textOverflow = "ellipsis" : n === 2 ? i.overflow = "visible" : i.textOverflow = "clip";
        return;
      case "src":
        e._skalTag === "image" && (e.src = String(n));
        return;
      case "contentScale":
        i.objectFit = Fa[n] || "contain";
        return;
      case "checked":
        e.checked = !!n;
        return;
      case "min":
        e.min = String(n);
        return;
      case "max":
        e.max = String(n);
        return;
      case "progress":
        n < 0 ? e.removeAttribute("value") : e.value = String(n);
        return;
      case "placeholder":
        if (e._skalTag === "button")
          return;
        e.placeholder = String(n);
        return;
      case "value":
        if (e._skalTag === "button")
          return;
        e.value = String(n);
        return;
      case "secureEntry":
        e._skalTag === "textInput" && (e.type = n ? "password" : "text");
        return;
      case "keyboardType":
        e.inputMode = ["text", "numeric", "email", "tel", "url", "text"][n] || "text";
        return;
      case "enabled":
        e.disabled = !n;
        return;
      case "focusable":
        e.tabIndex = n ? 0 : -1;
        return;
      case "visible":
        i.display = n ? "" : "none";
        return;
      case "opacity":
        i.opacity = String(n);
        return;
      case "translationX":
        ct(e).tx = n, je(e);
        return;
      case "translationY":
        ct(e).ty = n, je(e);
        return;
      case "scaleX":
        ct(e).sx = n, je(e);
        return;
      case "scaleY":
        ct(e).sy = n, je(e);
        return;
      case "rotation":
        ct(e).rz = n, je(e);
        return;
    }
  }
  var ki = new Set;
  function Wa(e) {
    ki.has(e) || (ki.add(e), console.warn(`Skal web: unknown intrinsic <${e}> \u2014 rendering placeholder. Custom widgets / Flutter plugins need the B.5 plugin host (WEB_SUPPORT_PLAN.md Phases 1\u20135).`));
  }
  var Ha = Wn({ createElement(e) {
    const r = va[e];
    if (r === undefined) {
      Wa(e);
      const i = document.createElement("div");
      return i._skalTag = e, i.setAttribute("data-skal-unknown", e), i.style.outline = "1px dashed #d33", i.style.padding = "4px", i.style.color = "#d33", i.style.font = "11px ui-monospace, monospace", i.appendChild(document.createTextNode(`<${e}>`)), i;
    }
    const n = document.createElement(r);
    return n._skalTag = e, Aa(n, e), n;
  }, createTextNode(e) {
    return document.createTextNode(e == null ? "" : String(e));
  }, replaceText(e, r) {
    e.data = r == null ? "" : String(r);
  }, setProperty(e, r, n, i) {
    const a = e._skalTag;
    if (a === "flutterEmbed") {
      if (r === "widget") {
        e._skalEmbedWidget = n == null ? "" : String(n), ln(e);
        return;
      }
      if (r === "props") {
        e._skalEmbedProps = n && typeof n == "object" ? n : {}, ln(e);
        return;
      }
    }
    if (a === "tabs") {
      if (r === "activeTab") {
        e._skalActiveTab = n | 0, wr(e);
        return;
      }
      if (r === "onChange") {
        e._skalOnChange = typeof n == "function" ? n : null;
        return;
      }
    } else if (a === "tab" && (r === "title" || r === "icon")) {
      r === "title" ? e._skalTitle = n == null ? "" : String(n) : e._skalIcon = n == null ? "" : String(n);
      const c = e.parentElement;
      c && c._skalTag === "tabs" && wr(c);
      return;
    }
    if (r === "onClick" || r === "onclick" || r === "onTap") {
      e.onclick = typeof n == "function" ? n : null;
      return;
    }
    if (r === "onDoubleTap") {
      e.ondblclick = typeof n == "function" ? n : null;
      return;
    }
    if (r === "onChange") {
      e.oninput = typeof n == "function" ? n : null;
      return;
    }
    if (r === "onSubmit") {
      e.onkeydown = typeof n == "function" ? (c) => {
        c.key === "Enter" && n(e.value);
      } : null;
      return;
    }
    if (r === "onLongPress") {
      e.oncontextmenu = typeof n == "function" ? (c) => {
        c.preventDefault(), n(c);
      } : null;
      return;
    }
    const l = Na[r];
    if (l !== undefined) {
      (e._skalG ||= {})[l] = typeof n == "function" ? n : null, un(e);
      return;
    }
    if (r === "draggable") {
      const c = e._skalG ||= {};
      c.draggable = typeof n == "string" ? La[n] || 0 : n === true ? 1 : n | 0, un(e);
      return;
    }
    if (r === "release") {
      const c = e._skalG ||= {};
      c.release = typeof n == "string" ? Ma[n.toLowerCase()] || 0 : n === true ? 1 : n | 0, un(e);
      return;
    }
    if (r === "spring") {
      const c = typeof n == "string" ? Ba[n] || 0 : n === true ? 1 : n | 0;
      if (c) {
        const p = c === 2 ? "cubic-bezier(0.34, 1.56, 0.64, 1)" : c === 3 ? "cubic-bezier(0.22, 1, 0.36, 1)" : "cubic-bezier(0.4, 0, 0.2, 1)", h = c === 2 ? 620 : c === 3 ? 340 : 460;
        e.style.transition = `transform ${h}ms ${p}, opacity ${h}ms ${p}`;
      } else
        e.style.transition = "";
      return;
    }
    if (r === "label" && (e._skalTag === "button" || e._skalTag === "text")) {
      e.textContent = n == null ? "" : String(n);
      return;
    }
    if (r === "title" && e._skalTag === "listTile") {
      e.textContent = n == null ? "" : String(n);
      return;
    }
    if (r === "animate" && n && typeof n == "object") {
      const c = n.duration | 0;
      let p = n.curve;
      p = typeof p == "string" ? Oa[p] ?? 0 : p | 0;
      const h = n.delay | 0;
      e.style.transition = `all ${c}ms ${Ca[p] || "linear"} ${h}ms`;
      return;
    }
    n != null && Va(e, r, n);
  }, insertNode(e, r, n) {
    e._skalTag === "tabs" && e._skalBar && !n ? e.insertBefore(r, e._skalBar) : e.insertBefore(r, n || null), e._skalTag === "pageView" && r.style && (r.style.flex = "0 0 100%", r.style.scrollSnapAlign = "start"), e._skalTag === "tabs" && r._skalTag === "tab" && wr(e), r._skalTag === "flutterEmbed" && ln(r);
  }, removeNode(e, r) {
    e.removeChild(r), e._skalTag === "tabs" && r._skalTag === "tab" && wr(e), r._skalTag === "flutterEmbed" && Ra(r);
  }, isTextNode(e) {
    return e.nodeType === 3;
  }, getParentNode(e) {
    return e.parentNode;
  }, getFirstChild(e) {
    return e.firstChild;
  }, getNextSibling(e) {
    return e.nextSibling;
  } }), { render: Ti, effect: Ua, memo: hd, createComponent: gd, createElement: et, createTextNode: Ga, insertNode: ut, insert: pd, spread: bd, setProp: de, mergeProps: _d, use: vd } = Ha;
  function Z(e) {
    return function() {
      throw new Error(`Skal: <${e}> was used without the babel-plugin-skal-jsx transform. Add the plugin to your Vite/babel config \u2014 see examples/kitchen-sink/vite.config.js for an example. (This wrapper exists as a fallback so misconfigured builds fail loud rather than rendering blanks.)`);
    };
  }
  var md = Z("Box"), wd = Z("Container"), Sd = Z("Column"), yd = Z("Row"), xd = Z("Text"), kd = Z("Button"), Td = Z("ScrollView"), Ed = Z("ListView"), $d = Z("ReorderableListView"), Rd = Z("Image"), Pd = Z("Stack"), Ad = Z("Switch"), Fd = Z("Slider"), Od = Z("Checkbox"), Cd = Z("ActivityIndicator"), Id = Z("ProgressBar"), zd = Z("LazyGrid"), Dd = Z("Wrap"), Nd = Z("SafeArea"), Ld = Z("RichText"), Md = Z("TextInput"), Bd = Z("Navigator"), Vd = Z("Screen"), Wd = Z("Tabs"), Hd = Z("Tab"), Ud = Z("AnimatedList"), Gd = Z("CrossFade"), jd = Z("Hero"), qd = Z("ListTile"), Xd = Z("PageView"), Kd = Z("Dismissible"), Jd = Z("CustomScrollView"), Yd = Z("SliverAppBar"), Zd = Z("SliverList"), Qd = Z("SliverGrid"), ef = Z("Canvas"), tf = Z("DragItem"), rf = Z("DropZone"), nf = Z("Radio"), of = Z("Chip"), af = Z("SegmentedButton"), sf = Z("ExpansionTile"), lf = Z("Dropdown"), cf = Z("Stepper"), uf = Z("Step"), df = Z("Drawer"), ff = Z("BottomSheet"), hf = Z("BackdropFilter"), gf = Z("InteractiveViewer"), pf = Z("FlutterEmbed"), bf = Z("HtmlEmbed"), Ei = new Map;
  function Kt(e, r) {
    if (typeof e != "string" || e.length === 0)
      throw new TypeError("registerHtmlView: viewType must be a non-empty string");
    if (typeof r != "function")
      throw new TypeError("registerHtmlView: factory must be a function");
    Ei.set(e, r);
    const n = globalThis.__skalRegisterHtmlView;
    typeof n == "function" && n(e);
  }
  typeof globalThis < "u" && (globalThis.__skalCreateHtmlViewElement = function(e, r) {
    const n = Ei.get(e), i = document.createElement("div");
    if (i.setAttribute("data-skal-view-type", e), i.setAttribute("data-skal-view-id", String(r)), i.style.cssText = "width:100%;height:100%;box-sizing:border-box;", !n)
      return i.textContent = `<HtmlEmbed viewType="${e}"> \u2014 no factory registered`, i.style.cssText += "color:#d33;font:12px ui-monospace,monospace;padding:8px;border:1px dashed #d33;background:#fff5f5;", i;
    try {
      n(i, r);
    } catch (a) {
      console.error(`Skal registerHtmlView('${e}') factory threw:`, a), i.textContent = `<HtmlEmbed viewType="${e}"> factory threw: ${a}`, i.style.cssText += "color:#d33;font:12px ui-monospace,monospace;padding:8px;";
    }
    return i;
  });
  function ja() {
    let e = 0;
    const r = function() {};
    return r.__skalBind = (n) => {
      e = n;
    }, new Proxy(r, { apply(n, i, a) {
      const l = a[0];
      l && typeof l.id == "number" && (e = l.id);
    }, get(n, i) {
      if (i === "__skalBind" || typeof i == "symbol")
        return r[i];
      if (typeof i == "string" && i.endsWith("$") && i.length > 1) {
        const a = i.slice(0, -1);
        return (...l) => {
          if (e === 0)
            throw new Error(`skal ref: cannot call .${String(i)}() before the host mounts. Move the call into a JSX event handler.`);
          const c = l[l.length - 1];
          if (typeof c != "function")
            throw new TypeError(`skal ref: .${String(i)}() requires a callback as its last argument (got ${typeof c})`);
          const p = l.slice(0, -1);
          return Jo(e, a, p, c);
        };
      }
      return (...a) => e === 0 ? Promise.reject(new Error(`skal ref: cannot call .${String(i)}() before the host mounts. Move the call into a JSX event handler.`)) : st(e, i, a);
    } });
  }
  var qa = 0, Xa = 0;
  function $i(e, r) {
    const n = globalThis.__skalHot && globalThis.__skalHot.stash;
    if (!n)
      return K(r);
    const [i, a] = K(n.has(e) ? n.get(e) : r);
    return [i, (l) => {
      const c = a(l);
      return n.set(e, i()), c;
    }];
  }
  function Ka(e, r) {
    return $i("hotstate:" + (r ?? qa++), e);
  }
  function dn(e, r, n) {
    const i = (F) => {
      const N = e[F];
      return typeof N == "function" ? N : N && N.component || null;
    }, a = (F) => {
      const N = e[F];
      return N && typeof N == "object" ? N.title : undefined;
    }, l = (F) => {
      const N = e[F];
      return N && typeof N == "object" ? N.transition : undefined;
    }, c = (F) => F === "fade" ? 1 : F === "none" ? 2 : typeof F == "number" ? F : 0, p = !!(n && n.linking), h = typeof window < "u", v = () => {
      if (!h)
        return null;
      const F = (window.location.hash || "").replace(/^#\/?/, "").split("?")[0];
      return F && e[F] ? F : null;
    };
    let E = typeof r == "string" ? r : r && r.name || Object.keys(e)[0];
    if (p) {
      const F = v();
      F && (E = F);
    }
    const y = [{ name: E, params: {}, title: a(E), transition: l(E) }], [A, g] = $i("router:" + (n && n.key != null ? n.key : Xa++), y), z = A();
    Array.isArray(z) && z.length > 0 && z.every((F) => F && e[F.name]) || g(y);
    const T = { stack: A, navigate(F, N, x) {
      g([...A(), { name: F, params: N || {}, presentation: x && x.presentation, title: (x && x.title) !== undefined ? x.title : a(F), transition: (x && x.transition) !== undefined ? x.transition : l(F) }]);
    }, back() {
      const F = A();
      F.length > 1 && g(F.slice(0, -1));
    }, replace(F, N, x) {
      g([...A().slice(0, -1), { name: F, params: N || {}, title: (x && x.title) !== undefined ? x.title : a(F), transition: (x && x.transition) !== undefined ? x.transition : l(F) }]);
    }, reset(F, N) {
      g([{ name: F, params: N || {}, title: a(F), transition: l(F) }]);
    }, canGoBack() {
      return A().length > 1;
    } };
    return p && h && xt(() => {
      const F = A(), N = "#/" + F[F.length - 1].name;
      window.location.hash !== N && window.history.replaceState({}, "", N);
    }), T.View = () => (() => {
      var F = s("navigator");
      return t(F, "onPop", () => T.back()), B(F, L(ce, { get each() {
        return A();
      }, children: (N) => {
        const x = i(N.name);
        return (() => {
          var P = s("screen");
          return B(P, x ? L(x, { get params() {
            return N.params || {};
          }, router: T }) : null), q((f) => {
            var S = N.presentation === "modal" ? 1 : 0, k = N.title || "", D = c(N.transition);
            return S !== f.e && (f.e = t(P, "presentation", S, f.e)), k !== f.t && (f.t = t(P, "title", k, f.t)), D !== f.a && (f.a = t(P, "transition", D, f.a)), f;
          }, { e: undefined, t: undefined, a: undefined }), P;
        })();
      } })), F;
    })(), T;
  }
  var Sr = Symbol("store-raw"), dt = Symbol("store-node"), We = Symbol("store-has"), Ri = Symbol("store-self");
  function Pi(e) {
    let r = e[De];
    if (!r && (Object.defineProperty(e, De, { value: r = new Proxy(e, Za) }), !Array.isArray(e))) {
      const n = Object.keys(e), i = Object.getOwnPropertyDescriptors(e), a = Object.getPrototypeOf(e), l = a !== null && e !== null && typeof e == "object" && !Array.isArray(e) && a !== Object.prototype;
      if (l) {
        const c = Object.getOwnPropertyDescriptors(a);
        n.push(...Object.keys(c)), Object.assign(i, c);
      }
      for (let c = 0, p = n.length;c < p; c++) {
        const h = n[c];
        l && h === "constructor" || i[h].get && Object.defineProperty(e, h, { configurable: true, enumerable: i[h].enumerable, get: i[h].get.bind(r) });
      }
    }
    return r;
  }
  function Ft(e) {
    let r;
    return e != null && typeof e == "object" && (e[De] || !(r = Object.getPrototypeOf(e)) || r === Object.prototype || Array.isArray(e));
  }
  function Ot(e, r = new Set) {
    let n, i, a, l;
    if (n = e != null && e[Sr])
      return n;
    if (!Ft(e) || r.has(e))
      return e;
    if (Array.isArray(e)) {
      Object.isFrozen(e) ? e = e.slice(0) : r.add(e);
      for (let c = 0, p = e.length;c < p; c++)
        a = e[c], (i = Ot(a, r)) !== a && (e[c] = i);
    } else {
      Object.isFrozen(e) ? e = Object.assign({}, e) : r.add(e);
      const c = Object.keys(e), p = Object.getOwnPropertyDescriptors(e);
      for (let h = 0, v = c.length;h < v; h++)
        l = c[h], !p[l].get && (a = e[l], (i = Ot(a, r)) !== a && (e[l] = i));
    }
    return e;
  }
  function yr(e, r) {
    let n = e[r];
    return n || Object.defineProperty(e, r, { value: n = Object.create(null) }), n;
  }
  function Jt(e, r, n) {
    if (e[r])
      return e[r];
    const [i, a] = K(n, { equals: false, internal: true });
    return i.$ = a, e[r] = i;
  }
  function Ja(e, r) {
    const n = Reflect.getOwnPropertyDescriptor(e, r);
    return !n || n.get || !n.configurable || r === De || r === dt || (delete n.value, delete n.writable, n.get = () => e[De][r]), n;
  }
  function Ai(e) {
    Cr() && Jt(yr(e, dt), Ri)();
  }
  function Ya(e) {
    return Ai(e), Reflect.ownKeys(e);
  }
  var Za = { get(e, r, n) {
    if (r === Sr)
      return e;
    if (r === De)
      return n;
    if (r === or)
      return Ai(e), n;
    const i = yr(e, dt), a = i[r];
    let l = a ? a() : e[r];
    if (r === dt || r === We || r === "__proto__")
      return l;
    if (!a) {
      const c = Object.getOwnPropertyDescriptor(e, r);
      Cr() && (typeof l != "function" || e.hasOwnProperty(r)) && !(c && c.get) && (l = Jt(i, r, l)());
    }
    return Ft(l) ? Pi(l) : l;
  }, has(e, r) {
    return r === Sr || r === De || r === or || r === dt || r === We || r === "__proto__" ? true : (Cr() && Jt(yr(e, We), r)(), (r in e));
  }, set() {
    return true;
  }, deleteProperty() {
    return true;
  }, ownKeys: Ya, getOwnPropertyDescriptor: Ja };
  function Ct(e, r, n, i = false) {
    if (r === "__proto__" || !i && e[r] === n)
      return;
    const a = e[r], l = e.length;
    n === undefined ? (delete e[r], e[We] && e[We][r] && a !== undefined && e[We][r].$()) : (e[r] = n, e[We] && e[We][r] && a === undefined && e[We][r].$());
    let c = yr(e, dt), p;
    if ((p = Jt(c, r, a)) && p.$(() => n), Array.isArray(e) && e.length !== l) {
      for (let h = e.length;h < l; h++)
        (p = c[h]) && p.$();
      (p = Jt(c, "length", l)) && p.$(e.length);
    }
    (p = c[Ri]) && p.$();
  }
  function Fi(e, r) {
    const n = Object.keys(r);
    for (let i = 0;i < n.length; i += 1) {
      const a = n[i];
      Oi(a) || Ct(e, a, r[a]);
    }
  }
  function Oi(e) {
    return e === "__proto__" || e === "constructor" || e === "prototype";
  }
  function Qa(e, r) {
    if (typeof r == "function" && (r = r(e)), r = Ot(r), Array.isArray(r)) {
      if (e === r)
        return;
      let n = 0, i = r.length;
      for (;n < i; n++) {
        const a = r[n];
        e[n] !== a && Ct(e, n, a);
      }
      Ct(e, "length", i);
    } else
      Fi(e, r);
  }
  function Yt(e, r, n = []) {
    let i, a = e;
    if (r.length > 1) {
      i = r.shift();
      const c = typeof i, p = Array.isArray(e);
      if (c === "string" && (i === "__proto__" || r.length > 1 && Oi(i)))
        return;
      if (Array.isArray(i)) {
        for (let h = 0;h < i.length; h++)
          Yt(e, [i[h]].concat(r), n);
        return;
      } else if (p && c === "function") {
        for (let h = 0;h < e.length; h++)
          i(e[h], h) && Yt(e, [h].concat(r), n);
        return;
      } else if (p && c === "object") {
        const { from: h = 0, to: v = e.length - 1, by: E = 1 } = i;
        for (let y = h;y <= v; y += E)
          Yt(e, [y].concat(r), n);
        return;
      } else if (r.length > 1) {
        Yt(e[i], r, [i].concat(n));
        return;
      }
      a = e[i], n = [i].concat(n);
    }
    let l = r[0];
    typeof l == "function" && (l = l(a, n), l === a) || i === undefined && l == null || (l = Ot(l), i === undefined || Ft(a) && Ft(l) && !Array.isArray(l) ? Fi(a, l) : Ct(e, i, l));
  }
  function es(...[e, r]) {
    const n = Ot(e || {}), i = Array.isArray(n), a = Pi(n);
    function l(...c) {
      Pn(() => {
        i && c.length === 1 ? Qa(n, c[0]) : Yt(n, c);
      });
    }
    return [a, l];
  }
  var xr = new WeakMap, Ci = { get(e, r) {
    if (r === Sr)
      return e;
    const n = e[r];
    if (r === De || r === or || r === dt || r === We || r === "__proto__")
      return n;
    let i;
    return Ft(n) ? xr.get(n) || (xr.set(n, i = new Proxy(n, Ci)), i) : n;
  }, set(e, r, n) {
    return Ct(e, r, Ot(n)), true;
  }, deleteProperty(e, r) {
    return Ct(e, r, undefined, true), true;
  } };
  function kr(e) {
    return (r) => {
      if (Ft(r)) {
        let n;
        (n = xr.get(r)) || xr.set(r, n = new Proxy(r, Ci)), e(n);
      }
      return r;
    };
  }
  var _f = 15, ts = (() => {
    const e = new Uint32Array(256);
    for (let r = 0;r < 256; r++) {
      let n = r;
      for (let i = 0;i < 8; i++)
        n = n & 1 ? 3988292384 ^ n >>> 1 : n >>> 1;
      e[r] = n >>> 0;
    }
    return e;
  })();
  function Ii(e, r = 0, n = e.length) {
    let i = 4294967295;
    for (let a = r;a < n; a++)
      i = ts[(i ^ e[a]) & 255] ^ i >>> 8;
    return (i ^ 4294967295) >>> 0;
  }
  function zi(e, r, n, i, a, l) {
    const c = 15 + a.length + l.length, p = new DataView(e.buffer, e.byteOffset + r, c);
    return p.setUint32(4, n >>> 0, true), e[r + 8] = i & 255, p.setUint16(9, a.length, true), p.setUint32(11, l.length, true), e.set(a, r + 15), e.set(l, r + 15 + a.length), p.setUint32(0, Ii(e, r + 4, r + c), true), c;
  }
  function Tr(e, r, n = true) {
    if (r + 15 > e.length)
      return null;
    const i = new DataView(e.buffer, e.byteOffset, e.byteLength), a = i.getUint32(r, true), l = i.getUint32(r + 4, true), c = e[r + 8], p = i.getUint16(r + 9, true), h = i.getUint32(r + 11, true), v = 15 + p + h;
    if (r + v > e.length || n && Ii(e, r + 4, r + v) !== a)
      return null;
    const E = r + 15, y = E + p;
    return { seq: l, flags: c, total: v, key: e.subarray(E, y), value: e.subarray(y, y + h) };
  }
  var ft = 256 * 1024, rs = 0.4, ns = 1000, is = 8, os = 16, as = new TextEncoder, ss = new TextDecoder, fn = (e) => as.encode(e), hn = (e) => ss.decode(e), Di = () => Date.now(), Ni = new Uint8Array(0), Li = 1397442609, gn = new Function("m", "return import(m);"), pn = (e, r) => e && e[r] ? e : e && e.default || e, bn = class {
    constructor() {
      this.kind = "memory", this._segs = new Map, this._meta = new Map;
    }
    listSegments() {
      return [...this._segs.keys()].sort((e, r) => e - r);
    }
    appendSegment(e, r) {
      const n = this._segs.get(e);
      if (!n) {
        this._segs.set(e, r.slice());
        return;
      }
      const i = new Uint8Array(n.length + r.length);
      i.set(n), i.set(r, n.length), this._segs.set(e, i);
    }
    getSegment(e) {
      return this._segs.get(e) || null;
    }
    dropSegment(e) {
      this._segs.delete(e);
    }
    flush() {}
    metaGet(e) {
      return this._meta.get(e) || null;
    }
    metaPut(e, r) {
      this._meta.set(e, r.slice());
    }
  }, ls = class {
    constructor(e, r, n) {
      this.kind = "fs", this._fs = e, this._p = r, this.root = n;
    }
    _seg(e) {
      return this._p.join(this.root, `seg-${String(e).padStart(5, "0")}.log`);
    }
    listSegments() {
      let e = [];
      try {
        e = this._fs.readdirSync(this.root);
      } catch {
        return [];
      }
      return e.filter((r) => /^seg-\d+\.log$/.test(r)).map((r) => parseInt(r.slice(4), 10)).sort((r, n) => r - n);
    }
    appendSegment(e, r) {
      this._fs.appendFileSync(this._seg(e), r);
    }
    getSegment(e) {
      try {
        return new Uint8Array(this._fs.readFileSync(this._seg(e)));
      } catch {
        return null;
      }
    }
    dropSegment(e) {
      try {
        this._fs.unlinkSync(this._seg(e));
      } catch {}
    }
    flush() {}
    metaGet(e) {
      try {
        return new Uint8Array(this._fs.readFileSync(this._p.join(this.root, `meta-${e}`)));
      } catch {
        return null;
      }
    }
    metaPut(e, r) {
      this._fs.writeFileSync(this._p.join(this.root, `meta-${e}`), r);
    }
  }, cs = class {
    constructor(e, r, n, i) {
      this.kind = "mmap", this.directActive = true, this._mmap = e, this._fs = r, this._p = n, this.root = i, this._open = new Map;
      try {
        for (const a of r.readdirSync(i))
          if (a.endsWith(".dead"))
            try {
              r.unlinkSync(n.join(i, a));
            } catch {}
      } catch {}
    }
    _segPath(e) {
      return this._p.join(this.root, `seg-${String(e).padStart(5, "0")}.log`);
    }
    _handle(e) {
      let r = this._open.get(e);
      if (r)
        return this._open.delete(e), this._open.set(e, r), r;
      const n = this._mmap(this._segPath(e), { shared: true });
      let i = 0;
      for (;i < n.length; ) {
        const a = Tr(n, i);
        if (!a)
          break;
        i += a.total;
      }
      return r = { mapped: n, cursor: i }, this._open.set(e, r), this._evictOpen(e), r;
    }
    _evictOpen(e) {
      for (;this._open.size > os; ) {
        const r = this._open.keys().next().value;
        if (r === e)
          break;
        this._open.delete(r);
      }
    }
    createSegment(e, r) {
      const n = this._segPath(e);
      this._fs.writeFileSync(n, new Uint8Array(r));
      const i = { mapped: this._mmap(n, { shared: true }), cursor: 0 };
      return this._open.set(e, i), this._evictOpen(e), i;
    }
    segmentCapacity(e) {
      const r = this._open.get(e);
      if (r)
        return r.mapped.length;
      try {
        return this._handle(e).mapped.length;
      } catch {
        return 0;
      }
    }
    listSegments() {
      let e = [];
      try {
        e = this._fs.readdirSync(this.root);
      } catch {
        return [];
      }
      return e.filter((r) => /^seg-\d+\.log$/.test(r)).map((r) => parseInt(r.slice(4), 10)).sort((r, n) => r - n);
    }
    segmentLen(e) {
      try {
        return this._handle(e).cursor;
      } catch {
        return 0;
      }
    }
    reserve(e, r) {
      const n = this._handle(e), i = n.cursor;
      return n.cursor += r, { mapped: n.mapped, offset: i };
    }
    getSegment(e) {
      let r;
      try {
        r = this._handle(e);
      } catch {
        return null;
      }
      return r.mapped.subarray(0, r.cursor);
    }
    dropSegment(e) {
      this._open.delete(e);
      try {
        this._fs.renameSync(this._segPath(e), this._segPath(e) + ".dead");
      } catch {}
    }
    flush() {}
    metaGet(e) {
      try {
        return new Uint8Array(this._fs.readFileSync(this._p.join(this.root, `meta-${e}`)));
      } catch {
        return null;
      }
    }
    metaPut(e, r) {
      this._fs.writeFileSync(this._p.join(this.root, `meta-${e}`), r);
    }
  };
  function Zt(e, r) {
    return e.diag = r, e;
  }
  async function us(e) {
    let r, n, i;
    try {
      const c = Promise.all([gn("node:fs"), gn("node:os"), gn("node:path")]), p = new Promise((y, A) => setTimeout(() => A(new Error("module import timed out")), 2000)), [h, v, E] = await Promise.race([c, p]);
      if (r = pn(h, "readFileSync"), n = pn(v, "tmpdir"), i = pn(E, "join"), typeof r.readFileSync != "function" || typeof r.writeFileSync != "function" || typeof n.tmpdir != "function" || typeof i.join != "function")
        return Zt(new bn, "node:fs/os/path resolved but missing methods");
    } catch (c) {
      return Zt(new bn, "node: import failed \u2014 " + (c && c.message || c));
    }
    const a = e && e.length ? e : i.join(n.tmpdir(), "skal-store");
    let l = "";
    try {
      if (typeof Bun < "u" && typeof Bun.mmap == "function") {
        const c = i.join(a, "mmap");
        r.mkdirSync(c, { recursive: true });
        const p = i.join(c, ".mmap-probe");
        r.writeFileSync(p, new Uint8Array(64));
        const h = Bun.mmap(p, { shared: true });
        if (h && h.length >= 64)
          return Zt(new cs((v, E) => Bun.mmap(v, E), r, i, c), "mmap @ " + c);
        l += "Bun.mmap probe unusable; ";
      } else
        l += "Bun.mmap absent; ";
    } catch (c) {
      l += "mmap \u2014 " + (c && c.message || c) + "; ";
    }
    try {
      if (typeof r.appendFileSync == "function") {
        const c = i.join(a, "fs");
        return r.mkdirSync(c, { recursive: true }), r.writeFileSync(i.join(c, ".fs-probe"), new Uint8Array(1)), Zt(new ls(r, i, c), l + "fs @ " + c);
      }
      l += "fs.appendFileSync absent; ";
    } catch (c) {
      l += "fs \u2014 " + (c && c.message || c) + "; ";
    }
    return Zt(new bn, l + "memory fallback");
  }
  var ds = class {
    constructor(e) {
      this._b = e, this._keydir = new Map, this._dead = new Map, this._cache = new Map, this._seq = 0, this._active = null, this._lastHintMs = 0;
    }
    get backendKind() {
      return this._b.kind;
    }
    open() {
      const e = this._b.listSegments(), r = this._loadHint(e);
      if (r && (this._keydir = r.keydir, this._dead = r.dead, this._seq = r.seq), e.length === 0) {
        const c = r ? r.tail.id : 0;
        this._active = this._b.directActive ? { id: c, direct: true } : { id: c, buf: new Uint8Array(ft), len: 0, persisted: 0 };
        return;
      }
      const n = e[e.length - 1], i = r ? r.tail.id : n, a = r ? r.tail.id : e[0];
      let l = null;
      for (const c of e) {
        if (c < a)
          continue;
        const p = this._b.getSegment(c) || new Uint8Array(0);
        let h = r && c === r.tail.id ? r.tail.len : 0;
        for (;h < p.length; ) {
          const v = Tr(p, h);
          if (!v)
            break;
          const E = hn(v.key), y = this._keydir.get(E);
          y && this._addDead(y.seg, y.len), v.flags & 1 ? (this._keydir.delete(E), this._addDead(c, v.total)) : this._keydir.set(E, { seg: c, off: h, len: v.total, seq: v.seq }), v.seq > this._seq && (this._seq = v.seq), h += v.total;
        }
        c === i ? l = p : this._cacheSet(c, p);
      }
      if (this._cache.delete(i), this._b.directActive)
        this._b.getSegment(i), this._active = { id: i, direct: true };
      else {
        l == null && (l = this._b.getSegment(i) || new Uint8Array(0));
        const c = new Uint8Array(Math.max(ft, l.length));
        c.set(l), this._active = { id: i, buf: c, len: l.length, persisted: l.length };
      }
    }
    _addDead(e, r) {
      this._dead.set(e, (this._dead.get(e) || 0) + r);
    }
    _cacheGet(e) {
      const r = this._cache.get(e);
      return r !== undefined && (this._cache.delete(e), this._cache.set(e, r)), r;
    }
    _cacheSet(e, r) {
      for (this._cache.delete(e), this._cache.set(e, r);this._cache.size > is; )
        this._cache.delete(this._cache.keys().next().value);
    }
    _loadHint(e) {
      let r;
      try {
        r = this._b.metaGet("hint");
      } catch {
        return null;
      }
      if (!r || r.length < 20)
        return null;
      const n = new DataView(r.buffer, r.byteOffset, r.byteLength);
      if (n.getUint32(0, true) !== Li)
        return null;
      const i = n.getUint32(4, true), a = n.getUint32(8, true), l = n.getUint32(12, true), c = n.getUint32(16, true), p = new Set(e), h = new Map;
      let v = 20;
      try {
        for (let A = 0;A < c; A++) {
          const g = n.getUint16(v, true);
          if (v += 2, v + g + 16 > r.length)
            return null;
          const z = hn(r.subarray(v, v + g));
          v += g;
          const T = n.getUint32(v, true);
          v += 4;
          const F = n.getUint32(v, true);
          v += 4;
          const N = n.getUint32(v, true);
          v += 4;
          const x = n.getUint32(v, true);
          if (v += 4, !p.has(T))
            return null;
          h.set(z, { seg: T, off: F, len: N, seq: x });
        }
        const E = n.getUint32(v, true);
        v += 4;
        const y = new Map;
        for (let A = 0;A < E; A++) {
          const g = n.getUint32(v, true);
          v += 4, y.set(g, n.getUint32(v, true)), v += 4;
        }
        return !p.has(a) && l !== 0 ? null : { seq: i, tail: { id: a, len: l }, keydir: h, dead: y };
      } catch {
        return null;
      }
    }
    _tailLen() {
      const e = this._active;
      return e ? e.direct ? this._b.segmentLen(e.id) : e.persisted : 0;
    }
    _writeHint() {
      this._lastHintMs = Di();
      const e = this._active, r = [];
      let n = 20;
      for (const [c, p] of this._keydir) {
        const h = fn(c);
        r.push([h, p]), n += 2 + h.length + 16;
      }
      n += 4 + this._dead.size * 8;
      const i = new Uint8Array(n), a = new DataView(i.buffer);
      a.setUint32(0, Li, true), a.setUint32(4, this._seq >>> 0, true), a.setUint32(8, e ? e.id : 0, true), a.setUint32(12, this._tailLen(), true), a.setUint32(16, r.length, true);
      let l = 20;
      for (const [c, p] of r)
        a.setUint16(l, c.length, true), l += 2, i.set(c, l), l += c.length, a.setUint32(l, p.seg, true), l += 4, a.setUint32(l, p.off, true), l += 4, a.setUint32(l, p.len, true), l += 4, a.setUint32(l, p.seq >>> 0, true), l += 4;
      a.setUint32(l, this._dead.size, true), l += 4;
      for (const [c, p] of this._dead)
        a.setUint32(l, c, true), l += 4, a.setUint32(l, p, true), l += 4;
      try {
        this._b.metaPut("hint", i);
      } catch {}
    }
    _seal() {
      const e = this._active;
      if (e.direct) {
        this._active = { id: e.id + 1, direct: true };
        return;
      }
      e.len > e.persisted && this._b.appendSegment(e.id, e.buf.subarray(e.persisted, e.len)), this._cacheSet(e.id, e.buf.slice(0, e.len)), this._active = { id: e.id + 1, buf: new Uint8Array(ft), len: 0, persisted: 0 };
    }
    _writeFrame(e, r, n, i) {
      const a = 15 + n.length + i.length, l = this._active;
      if (l.direct) {
        const h = this._b.segmentCapacity(l.id);
        h === 0 ? this._b.createSegment(l.id, Math.max(ft, a)) : this._b.segmentLen(l.id) + a > h && (this._seal(), this._b.createSegment(this._active.id, Math.max(ft, a)));
        const v = this._b.reserve(this._active.id, a);
        return zi(v.mapped, v.offset, e, r, n, i), v.offset;
      }
      l.len > 0 && l.len + a > ft && this._seal();
      const c = this._active;
      if (c.len + a > c.buf.length) {
        const h = new Uint8Array(Math.max(c.buf.length * 2, c.len + a));
        h.set(c.buf.subarray(0, c.len)), c.buf = h;
      }
      const p = c.len;
      return zi(c.buf, p, e, r, n, i), c.len += a, p;
    }
    put(e, r) {
      const n = ++this._seq, i = fn(e), a = this._writeFrame(n, 0, i, r), l = this._keydir.get(e);
      l && this._addDead(l.seg, l.len), this._keydir.set(e, { seg: this._active.id, off: a, len: 15 + i.length + r.length, seq: n });
    }
    del(e) {
      const r = this._keydir.get(e);
      r && (this._writeFrame(++this._seq, 1, fn(e), Ni), this._addDead(r.seg, r.len), this._keydir.delete(e));
    }
    delPrefix(e) {
      if (!e)
        return;
      const r = e + ".", n = e + "#", i = [];
      for (const a of this._keydir.keys())
        (a.startsWith(r) || a.startsWith(n)) && i.push(a);
      for (const a of i)
        this.del(a);
    }
    get(e) {
      const r = this._keydir.get(e);
      if (!r)
        return null;
      const n = this._segBytes(r.seg);
      if (!n)
        return null;
      const i = Tr(n, r.off, false);
      return !i || i.flags & 1 ? null : i.value.slice();
    }
    _segBytes(e) {
      if (this._active && e === this._active.id)
        return this._active.direct ? this._b.getSegment(e) : this._active.buf.subarray(0, this._active.len);
      let r = this._cacheGet(e);
      return r || (r = this._b.getSegment(e), r && this._cacheSet(e, r)), r;
    }
    flush() {
      const e = this._active;
      e && !e.direct && e.len > e.persisted && (this._b.appendSegment(e.id, e.buf.subarray(e.persisted, e.len)), e.persisted = e.len), this._b.flush(), Di() - this._lastHintMs >= ns && this._writeHint();
    }
    compact() {
      let e = -1, r = 0;
      for (const [c, p] of this._dead)
        this._active && c === this._active.id || p > r && (r = p, e = c);
      if (e < 0 || r < ft * rs)
        return false;
      const n = this._segBytes(e);
      if (!n)
        return false;
      const i = this._b.listSegments(), a = i.length > 0 && e === i[0];
      let l = 0;
      for (;l < n.length; ) {
        const c = Tr(n, l);
        if (!c)
          break;
        const p = hn(c.key);
        if (c.flags & 1)
          !a && !this._keydir.has(p) && (this._writeFrame(++this._seq, 1, c.key, Ni), this._addDead(this._active.id, 15 + c.key.length));
        else {
          const h = this._keydir.get(p);
          h && h.seg === e && h.off === l && this.put(p, c.value.slice());
        }
        l += c.total;
      }
      return this.flush(), this._b.dropSegment(e), this._cache.delete(e), this._dead.delete(e), this._writeHint(), true;
    }
    stats() {
      let e = 0;
      for (const r of this._dead.values())
        e += r;
      return { backend: this._b.kind, records: this._keydir.size, segments: this._b.listSegments().length, activeSegment: this._active ? this._active.id : -1, deadBytes: e, seq: this._seq };
    }
  }, fs = class {
    constructor(e) {
      this.backendKind = "native", this._dir = e, this._h = 0;
    }
    open() {
      const e = globalThis.__skal_store_open;
      if (this._h = typeof e == "function" && e(this._dir) || 0, !this._h)
        throw new Error("skal-store: native engine open failed @ " + this._dir);
    }
    put(e, r) {
      globalThis.__skal_store_put(this._h, e, r);
    }
    del(e) {
      globalThis.__skal_store_del(this._h, e);
    }
    delPrefix(e) {
      const r = globalThis.__skal_store_del_prefix;
      typeof r == "function" && r(this._h, e);
    }
    get(e) {
      const r = globalThis.__skal_store_get(this._h, e);
      return r ? new Uint8Array(r) : null;
    }
    flush() {}
    compact() {
      return !!globalThis.__skal_store_compact(this._h);
    }
    stats() {
      const e = this._h ? globalThis.__skal_store_stats(this._h) : null;
      if (!e)
        return { backend: "native", records: 0, segments: 0, deadBytes: 0, seq: 0 };
      const r = new DataView(e);
      return { backend: "native", records: r.getUint32(0, true), segments: r.getUint32(4, true), deadBytes: r.getUint32(8, true), seq: r.getUint32(12, true) };
    }
  }, hs = 60, gs = 8192, Er = Symbol("skal.indexDirty"), ps = new TextEncoder, bs = new TextDecoder;
  function ht(e) {
    return ps.encode(JSON.stringify(e));
  }
  function Le(e) {
    return JSON.parse(bs.decode(e));
  }
  var _n = Symbol.for("skal.store"), Ae = (e) => e !== null && typeof e == "object" && !Array.isArray(e), qe = (e) => Array.isArray(e) && e.every(Ae), vn = (e) => typeof e == "string" && /^(0|[1-9]\d*)$/.test(e), _e = (e, r) => e ? e + "." + r : r, Qt = () => typeof performance < "u" && performance.now ? performance.now() : Date.now();
  function It(e) {
    if (Array.isArray(e))
      return e.map(It);
    if (Ae(e)) {
      const r = {};
      for (const n of Object.keys(e))
        r[n] = It(e[n]);
      return r;
    }
    return e;
  }
  async function _s() {
    const e = globalThis.__skal_data_dir;
    if (typeof e == "string" && e.length)
      return e;
    for (let r = 0;r < 5; r++) {
      try {
        const n = await Promise.race([jo(), new Promise((i, a) => setTimeout(() => a(new Error("getDataDir timeout")), 800))]);
        if (typeof n == "string" && n.length)
          return n;
      } catch {}
      await new Promise((n) => setTimeout(n, 150));
    }
    return "";
  }
  function vs(e, r = {}) {
    const n = { name: r.name || "store", paths: r.paths || null, residentMax: r.residentMax || 1e4, version: r.version || 0, migrate: r.migrate || null };
    let i = false, a = false;
    if (n.paths)
      for (const R in n.paths) {
        const m = n.paths[R];
        m && m.lazy === true && (i = true), m && m.persist === false && (a = true);
      }
    const l = new Map;
    function c(R) {
      const m = l.get(R);
      if (m)
        return m;
      let w = true, C = false;
      if (n.paths) {
        const O = [];
        for (const o in n.paths)
          (o === R || R.startsWith(o + ".")) && O.push(o);
        O.sort((o, u) => o.length - u.length);
        for (const o of O) {
          const u = n.paths[o];
          u.persist !== undefined && (w = u.persist), u.lazy !== undefined && (C = u.lazy);
        }
      }
      const I = { persist: w, lazy: C };
      return l.set(R, I), I;
    }
    const [p, h] = es(It(e)), [v, E] = K(false), [y, A] = K("\u2026"), [g, z] = K(null);
    let T = null;
    const F = new Map, N = new Map, x = new Map, P = new Set;
    let f = null, S = 0;
    function k(R) {
      const m = N.get(R) || 1;
      return N.set(R, m + 1), String(m);
    }
    function D() {
      f == null && (f = setTimeout(() => {
        f = null, M();
      }, hs));
    }
    function M() {
      if (!(!T || F.size === 0 && P.size === 0)) {
        if (P.size > 0) {
          if (T.delPrefix)
            for (const R of P)
              T.delPrefix(R);
          P.clear();
        }
        for (const [R, m] of F)
          if (m === null)
            T.del(R);
          else if (m === Er) {
            const w = R.slice(2, -2), C = oe(w === "" ? [] : w.split("."));
            Array.isArray(C) && T.put(R, ht({ ids: C.map((I) => I && I._id), nextId: N.get(w) || C.length + 1 }));
          } else
            T.put(R, m);
        F.clear(), T.flush(), S++;
      }
    }
    function j() {
      f != null && (clearTimeout(f), f = null), M();
    }
    function fe(R) {
      const m = [];
      let w = p;
      for (const C of R)
        if (C !== null && typeof C == "object") {
          let I = -1;
          if (Array.isArray(w)) {
            const O = C.hint;
            O >= 0 && O < w.length && w[O] && w[O]._id === C.__id ? I = O : (I = w.findIndex((o) => o && o._id === C.__id), C.hint = I);
          }
          m.push(I), w = I < 0 ? undefined : w[I];
        } else
          m.push(C), w = w?.[C];
      return { path: m, value: w };
    }
    function oe(R) {
      let m = p;
      for (let w = 0;w < R.length; w++) {
        const C = R[w];
        if (C !== null && typeof C == "object") {
          let I = -1;
          if (Array.isArray(m)) {
            const O = C.hint;
            O >= 0 && O < m.length && m[O] && m[O]._id === C.__id ? I = O : (I = m.findIndex((o) => o && o._id === C.__id), C.hint = I);
          }
          m = I < 0 ? undefined : m[I];
        } else
          m = m?.[C];
        if (m == null)
          return;
      }
      return m;
    }
    function Ee(R, m) {
      let w = p;
      for (let C = 0;C < R.length; C++) {
        const I = R[C];
        if (I !== null && typeof I == "object") {
          let O = -1;
          if (Array.isArray(w)) {
            const o = I.hint;
            o >= 0 && o < w.length && w[o] && w[o]._id === I.__id ? O = o : (O = w.findIndex((u) => u && u._id === I.__id), I.hint = O);
          }
          w = O < 0 ? undefined : w[O];
        } else
          w = w?.[I];
        if (w == null)
          return;
      }
      return w[m];
    }
    function le(R, ...m) {
      for (let w = 0;w < R.length; w++) {
        const C = R[w];
        if (C !== null && typeof C == "object") {
          const I = fe(R);
          if (I.path.indexOf(-1) >= 0)
            return;
          h(...I.path, ...m);
          return;
        }
      }
      h(...R, ...m);
    }
    const $e = new Map;
    function bt(R) {
      let m = e;
      for (const w of R.split(".")) {
        if (m == null)
          return;
        m = m[w];
      }
      return It(m);
    }
    function zt(R) {
      for ($e.delete(R), $e.set(R, true);$e.size > n.residentMax; ) {
        const m = $e.keys().next().value;
        if (m === R)
          break;
        $e.delete(m), le(m.split("."), bt(m));
      }
    }
    function $r(R, m) {
      if (!(!T || $e.has(m))) {
        if (Array.isArray(oe(R)))
          Lt(R, m);
        else {
          const w = T.get("k:" + m);
          w != null && le(R, Le(w));
        }
        zt(m);
      }
    }
    function _t(R, m, w, C) {
      if (w) {
        F.set("k:" + w.storeKey, ht(oe(w.solidPath)));
        return;
      }
      if (qe(C)) {
        for (const I of C)
          F.set("k:" + _e(m, I._id), ht(I));
        F.set("k:" + m + "#x", Er);
        return;
      }
      if (m === "" && Ae(C)) {
        for (const I of Object.keys(C)) {
          const O = _e(m, I);
          c(O).persist && _t([...R, I], O, null, C[I]);
        }
        return;
      }
      F.set("k:" + m, ht(C));
    }
    function er(R, m) {
      if (qe(m)) {
        for (const w of m)
          w && w._id != null && F.set("k:" + _e(R, w._id), null);
        F.set("k:" + R + "#x", null);
        return;
      }
      F.set("k:" + R, null), R && m !== null && typeof m == "object" && P.add(R);
    }
    function wn(R, m, w, C) {
      let I = C;
      !w && qe(C) && (I = C.map((u) => u._id != null ? u : { ...u, _id: k(m) }));
      let O = false;
      for (let u = 0;u < R.length; u++) {
        const d = R[u];
        if (d !== null && typeof d == "object") {
          O = true;
          break;
        }
      }
      if (O) {
        const u = fe(R);
        if (u.path.indexOf(-1) >= 0)
          return;
        h(...u.path, I);
      } else
        h(...R, I);
      Array.isArray(I) && x.delete(m), m && xe.size > 0 && He(m, I !== null && typeof I == "object");
      let o = true;
      if (i || a) {
        const u = c(m);
        !w && u.lazy && zt(m), o = u.persist;
      }
      o && (!w && m && I !== null && typeof I == "object" && P.add(m), _t(R, m, w, I), D());
    }
    const xe = new Map;
    let tr = new Set, rr = false;
    function Sn() {
      rr || (rr = true, queueMicrotask(yn));
    }
    function yn() {
      rr = false;
      const R = tr;
      tr = new Set;
      for (const m of R)
        if (!m._disposed) {
          m._dirty = false;
          try {
            Dt(m);
          } catch (w) {
            console.error("[skal] effect threw:", w);
          }
        }
    }
    function Dt(R) {
      const { _sps: m, _vals: w } = R;
      for (let C = 0;C < m.length; C++)
        w[C] = oe(m[C]);
      R._fn(w);
    }
    function rt(R) {
      for (const m of R)
        m._dirty || (m._dirty = true, tr.add(m));
    }
    function He(R, m) {
      const w = xe.get(R);
      if (w && rt(w), m)
        if (R === "")
          for (const [, C] of xe)
            C !== w && rt(C);
        else {
          const C = R + ".";
          for (const [I, O] of xe)
            I.startsWith(C) && rt(O);
        }
      (w || m) && Sn();
    }
    function Rr(R, m) {
      const w = new Array(R.length);
      for (let O = 0;O < R.length; O++)
        w[O] = R[O].split(".");
      const C = { _fn: m, _paths: R, _sps: w, _vals: new Array(R.length), _dirty: false, _disposed: false };
      for (let O = 0;O < R.length; O++) {
        const o = R[O];
        let u = xe.get(o);
        u || (u = new Set, xe.set(o, u)), u.add(C);
      }
      const I = () => {
        if (!C._disposed) {
          C._disposed = true;
          for (let O = 0;O < C._paths.length; O++) {
            const o = xe.get(C._paths[O]);
            o && (o.delete(C), o.size === 0 && xe.delete(C._paths[O]));
          }
        }
      };
      try {
        Dt(C);
      } catch (O) {
        throw I(), O;
      }
      return I;
    }
    const Pr = { ready: v, backendKind: y, initTiming: g, flushNow: j, version: () => n.version, pending: () => F.size, flushes: () => S, resident: () => $e.size, engineStats: () => T && T.stats ? T.stats() : null, createEffect: Rr }, ze = new Map;
    function vt(R, m, w, C) {
      C === undefined && (C = Array.isArray(oe(R)));
      const I = ze.get(m);
      if (I !== undefined && I.isArray === C)
        return I.node;
      const O = C ? xn(R, m, w) : Ar(R, m, w);
      return ze.set(m, { node: O, isArray: C }), ze.size > gs && ze.delete(ze.keys().next().value), O;
    }
    function Nt(R) {
      if (R.length) {
        for (const m of ze.keys())
          for (const w of R)
            if (m === w || m.startsWith(w + ".") || m.startsWith(w + "#")) {
              ze.delete(m);
              break;
            }
      }
    }
    function Ar(R, m, w) {
      return new Proxy({}, { get(C, I) {
        if (I === _n)
          return Pr;
        if (typeof I == "symbol")
          return;
        if (i && !w) {
          const o = m ? m + "." + I : I;
          !$e.has(o) && c(o).lazy && Ke(() => $r(R.length === 0 ? [I] : [...R, I], o));
        }
        const O = Ee(R, I);
        return O !== null && typeof O == "object" ? vt(R.length === 0 ? [I] : [...R, I], m ? m + "." + I : I, w, Array.isArray(O)) : O;
      }, set(C, I, O) {
        return typeof I == "symbol" ? false : (wn(R.length === 0 ? [I] : [...R, I], m ? m + "." + I : I, w, O), true);
      }, has(C, I) {
        const O = oe(R);
        return O != null && I in O;
      }, ownKeys() {
        const C = oe(R);
        return C ? Reflect.ownKeys(C) : [];
      }, getOwnPropertyDescriptor(C, I) {
        const O = oe(R);
        if (O != null && I in O)
          return { enumerable: I !== "_id", configurable: true };
      }, deleteProperty(C, I) {
        if (typeof I == "symbol")
          return false;
        const O = m ? m + "." + I : I, o = oe(R.length === 0 ? [I] : [...R, I]);
        return le(R, kr((u) => {
          u != null && delete u[I];
        })), w ? _t(R, m, w, null) : (!a || c(O).persist) && er(O, o), o !== null && typeof o == "object" && (Nt([O]), x.delete(O)), O && xe.size > 0 && He(O, true), D(), true;
      } });
    }
    function xn(R, m, w) {
      const C = () => oe(R) || [], I = () => {
        (w || !a || c(m).persist) && _t(R, m, w, C()), D();
      };
      function O(d, b, ...$) {
        const H = C(), G = H.length;
        d = d < 0 ? Math.max(0, G + d) : Math.min(d, G), b = b === undefined ? G - d : Math.max(0, Math.min(b, G - d));
        const J = H.slice(d, d + b);
        let X = $;
        if (w || (X = $.map((re) => Ae(re) && re._id == null ? { ...re, _id: k(m) } : re)), b === 0 && d === G && X.length > 0)
          for (let re = 0;re < X.length; re++)
            le([...R, G + re], X[re]);
        else
          le(R, kr((re) => {
            re.splice(d, b, ...X);
          }));
        if (!w) {
          const re = [];
          for (const pe of J)
            if (pe && pe._id != null) {
              const Re = _e(m, pe._id);
              F.set("k:" + Re, null), re.push(Re);
            }
          Nt(re);
        }
        let te = false;
        if (!w) {
          const re = x.get(m);
          te = re === undefined ? qe(H) : re, te && (te = X.every(Ae)), x.set(m, te);
        }
        if (te) {
          for (const re of X)
            re && re._id != null && F.set("k:" + _e(m, re._id), ht(re));
          F.set("k:" + m + "#x", Er), D();
        } else
          I();
        return xe.size > 0 && He(m, true), J;
      }
      function o(d, b) {
        le(R, kr(d));
        const $ = x.get(m);
        return b && !w && ($ === undefined ? qe(C()) : $) ? (F.set("k:" + m + "#x", Er), D()) : I(), xe.size > 0 && He(m, true), C();
      }
      const u = { splice: O, push: (...d) => (O(C().length, 0, ...d), C().length), unshift: (...d) => (O(0, 0, ...d), C().length), pop: () => O(C().length - 1, 1)[0], shift: () => O(0, 1)[0], sort: (d) => o((b) => {
        b.sort(d);
      }, true), reverse: () => o((d) => {
        d.reverse();
      }, true), fill: (d, b, $) => o((H) => {
        H.fill(d, b, $);
      }, false), copyWithin: (d, b, $) => o((H) => {
        H.copyWithin(d, b, $);
      }, false) };
      return new Proxy([], { get(d, b) {
        if (b === _n)
          return Pr;
        if (b === "length")
          return C().length;
        if (typeof b == "string" && Object.hasOwn(u, b))
          return u[b];
        if (vn(b)) {
          const G = C(), J = +b, X = G[J];
          if (X !== null && typeof X == "object") {
            let te = false;
            if (!w) {
              const Re = x.get(m);
              Re === undefined ? (te = qe(C()), x.set(m, te)) : te = Re;
            }
            if (te && X._id != null) {
              const Re = _e(m, X._id), mt = [...R, { __id: X._id, hint: J }];
              return vt(mt, Re, { solidPath: mt, storeKey: Re }, false);
            }
            const re = _e(m, b), pe = [...R, J];
            return w ? vt(pe, re, w, Array.isArray(X)) : vt(pe, re, { solidPath: R, storeKey: m }, Array.isArray(X));
          }
          return X;
        }
        const $ = C(), H = $[b];
        return typeof H == "function" ? H.bind($) : H;
      }, set(d, b, $) {
        if (b === "length") {
          const H = +$;
          let G = null;
          if (!w && H < C().length) {
            const J = x.get(m);
            (J === undefined ? qe(C()) : J) && (G = C().slice(H));
          }
          if (le(R, kr((J) => {
            J.length = H;
          })), x.delete(m), G) {
            const J = [];
            for (const X of G)
              if (X && X._id != null) {
                const te = _e(m, X._id);
                F.set("k:" + te, null), J.push(te);
              }
            Nt(J);
          }
          return I(), xe.size > 0 && He(m, true), true;
        }
        if (vn(b)) {
          const H = +b, G = C()[H];
          let J = $;
          !w && Ae($) && $._id == null && (J = { ...$, _id: G && G._id != null ? G._id : k(m) }), le(R, H, J);
          let X = false;
          if (!w) {
            const te = x.get(m);
            X = te === undefined ? qe(C()) : te, X && !Ae(J) && (X = false), x.set(m, X);
          }
          if (X && J && J._id != null ? (F.set("k:" + _e(m, J._id), ht(J)), D()) : I(), xe.size > 0) {
            const te = J !== null && typeof J == "object";
            He(_e(m, b), te);
            const re = J && J._id != null ? J._id : null;
            X && re != null && He(_e(m, re), te);
            const pe = G && G._id != null ? G._id : null;
            pe != null && pe !== re && He(_e(m, pe), true);
          }
          return true;
        }
        return false;
      }, has(d, b) {
        return b === "length" || typeof b == "string" && Object.hasOwn(u, b) ? true : (b in C());
      }, ownKeys() {
        return Reflect.ownKeys(C());
      }, getOwnPropertyDescriptor(d, b) {
        const $ = C();
        if (b === "length")
          return { value: $.length, writable: true, enumerable: false, configurable: false };
        if (vn(b) && +b < $.length)
          return { enumerable: true, configurable: true };
      } });
    }
    function Fr(R, m, w) {
      if (Array.isArray(R)) {
        const I = T.get("k:" + m + "#x");
        if (I != null) {
          w.push(m + "#x");
          const o = Le(I), u = [];
          for (const d of o.ids || []) {
            const b = _e(m, d);
            w.push(b);
            const $ = T.get("k:" + b);
            $ != null && u.push(Le($));
          }
          return u;
        }
        const O = T.get("k:" + m);
        return O != null ? (w.push(m), Le(O)) : It(R);
      }
      if (Ae(R)) {
        const I = {};
        for (const O of Object.keys(R))
          I[O] = Fr(R[O], _e(m, O), w);
        return I;
      }
      const C = T.get("k:" + m);
      return C != null ? (w.push(m), Le(C)) : R;
    }
    function nr(R, m) {
      if (qe(R)) {
        let w = 0;
        for (const C of R) {
          const I = C._id == null ? 0 : +C._id;
          I > w && (w = I);
        }
        w + 1 > (N.get(m) || 1) && N.set(m, w + 1);
        for (const C of R)
          C._id == null && (C._id = k(m));
      } else if (Ae(R))
        for (const w of Object.keys(R))
          nr(R[w], _e(m, w));
    }
    function ir(R, m, w) {
      for (const C of Object.keys(R)) {
        const I = R[C], O = [...m, C], o = _e(w, C), u = c(o);
        if (Array.isArray(I))
          u.persist && !u.lazy && Lt(O, o);
        else if (Ae(I)) {
          let d = true;
          if (u.persist && !u.lazy && !F.has("k:" + o)) {
            const b = T.get("k:" + o);
            if (b != null) {
              const $ = Le(b);
              le(O, $), Ae($) || (d = false, T.delPrefix && P.add(o));
            }
          }
          d && ir(I, O, o);
        } else {
          if (!u.persist || u.lazy || F.has("k:" + o))
            continue;
          const d = T.get("k:" + o);
          if (d != null) {
            const b = Le(d);
            le(O, b), Ae(b) && ir(b, O, o);
          }
        }
      }
    }
    function Lt(R, m) {
      if (!c(m).persist || F.has("k:" + m + "#x") || F.has("k:" + m))
        return;
      x.delete(m);
      const w = T.get("k:" + m + "#x");
      if (w != null) {
        const I = Le(w);
        N.set(m, I.nextId || 1);
        const O = [];
        for (const o of I.ids || []) {
          const u = T.get("k:" + _e(m, o));
          u != null && O.push(Le(u));
        }
        le(R, O);
        return;
      }
      const C = T.get("k:" + m);
      C != null && le(R, Le(C));
    }
    async function kn() {
      const R = Qt();
      let m = R, w = R, C = R;
      try {
        const u = await _s();
        if (m = Qt(), typeof globalThis.__skal_store_open == "function" && u)
          try {
            const G = new fs(u + "/" + n.name);
            G.open(), T = G, A("native");
          } catch {
            T = null;
          }
        if (!T) {
          const G = await us(u), J = new ds(G);
          J.open(), T = J, A(G.kind);
        }
        w = Qt();
        let d = null;
        const b = T.get("k:#meta");
        if (b != null)
          try {
            d = Le(b);
          } catch {
            d = null;
          }
        const $ = d ? d.version | 0 : 0;
        let H = false;
        if (d && d.shape && n.migrate && $ < n.version) {
          const G = [], J = Fr(d.shape, "", G);
          let X = null;
          try {
            X = n.migrate(J, $);
          } catch {
            X = null;
          }
          if (Ae(X)) {
            for (const te of G)
              F.set("k:" + te, null);
            nr(X, ""), x.clear(), le([], X), _t([], "", null, X), H = true;
          }
        }
        (!d || $ !== n.version) && F.set("k:#meta", ht({ version: n.version, shape: It(e) })), C = Qt(), H || ir(e, [], ""), D();
      } catch {}
      const I = Qt(), O = T && T.stats ? T.stats() : null, o = (u) => Math.round(u * 10) / 10;
      z({ total: o(I - R), dir: o(m - R), open: o(w - m), migrate: o(C - w), hydrate: o(I - C), records: O ? O.records : 0 }), E(true);
    }
    return kn(), vt([], "", null, Array.isArray(e));
  }
  function ms() {
    const [e, r] = K(0);
    return (() => {
      var n = et("column"), i = et("text"), a = et("row"), l = et("button"), c = et("button"), p = et("button"), h = et("text");
      return ut(n, i), ut(n, a), ut(n, h), de(n, "gap", 8), de(n, "padding", 12), de(n, "background", "#FFF8FAFC"), de(n, "cornerRadius", 10), de(i, "fontSize", 13), de(i, "fontWeight", 600), de(i, "color", "#FF1A1A2E"), ut(a, l), ut(a, c), ut(a, p), de(a, "gap", 8), de(l, "label", "+1"), de(l, "onClick", () => r((v) => v + 1)), de(c, "label", "-1"), de(c, "onClick", () => r((v) => v - 1)), de(p, "label", "reset"), de(p, "onClick", () => r(0)), de(h, "label", "Same <Column>/<Text>/<Button> syntax as App.jsx \u2014 just compiled with moduleName: skal/renderer-web because this file is *.dom.jsx. The babel macro + skal-flutter codegen vocab work identically; only the sink (DOM vs bridge) changes."), de(h, "fontSize", 11), de(h, "color", "#FF4A4A5E"), Ua((v) => de(i, "label", `Skal JSX inside HtmlEmbed (DOM render) \u2014 n = ${e()}`, v)), n;
    })();
  }
  async function ws() {
    return sn("geolocator.getCurrentPosition", {});
  }
  var ke = "#FFF2F2F7", Te = "#FFFFFFFF", Se = "#FFE5E5EA", Q = "#FF1C1C1E", W = "#FF8E8E93", se = "#FF0A84FF", ye = "#FF34C759", Ce = "#FFFF9F0A", gt = "#FFFF3B30", Fe = "#FF5E5CE6", me = "#FFEFEFF4", Ss = "#FF334155", Mi = typeof window < "u" && !ur;
  Kt("html-card", (e) => {
    e.innerHTML = `
    <div style="font-family: ui-sans-serif, system-ui, sans-serif; padding: 14px; background: linear-gradient(135deg, #fff 0%, #f0f4ff 100%); border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); height: 100%; box-sizing: border-box; overflow: auto;">
      <h3 style="margin: 0 0 6px; font-size: 14px; color: #1a1a2e;">Real DOM card</h3>
      <p style="margin: 0 0 10px; font-size: 12px; color: #4a4a5e; line-height: 1.4;">
        This whole panel is HTML rendered <strong>inside</strong> the Flutter canvas. Try to
        <em>select this text</em> with your mouse \u2014 selection works because the
        DOM is real, not a screenshot.
      </p>
      <button id="html-card-btn" style="padding: 6px 12px; border-radius: 6px; border: 0; background: #0a84ff; color: white; font-weight: 600; cursor: pointer; font-size: 12px;">
        Click me \u2014 0
      </button>
      <input type="date" style="margin-left: 8px; padding: 4px 6px; border-radius: 6px; border: 1px solid #ccc; font-size: 12px;" />
    </div>
  `;
    let r = 0;
    e.querySelector("#html-card-btn").addEventListener("click", (n) => {
      r++, n.target.textContent = `Click me \u2014 ${r}`;
    });
  }), Kt("youtube-embed", (e) => {
    const r = document.createElement("iframe");
    r.src = "https://www.youtube.com/embed/dQw4w9WgXcQ", r.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"), r.setAttribute("allowfullscreen", ""), r.style.cssText = "width:100%;height:100%;border:0;border-radius:8px;display:block;", e.appendChild(r);
  });
  function pt(e, r, ...n) {
    const i = et(e);
    if (r)
      for (const a in r) {
        const l = r[a];
        typeof l == "function" && a !== "onClick" && a !== "onChange" && a !== "onTap" ? xt(() => de(i, a, l())) : de(i, a, l);
      }
    for (const a of n.flat())
      a == null || a === false || a === true || ut(i, typeof a == "object" && a.nodeType ? a : Ga(String(a)));
    return i;
  }
  Kt("skal-jsx-counter", (e) => {
    Ti(() => ms(), e);
  }), Kt("skal-counter", (e) => {
    yt(() => {
      const [r, n] = K(0);
      Ti(() => pt("column", { gap: 8, padding: 12, background: "#FFF8FAFC", cornerRadius: 10 }, pt("text", { label: () => `Skal <column>+<text>+<button> rendered as DOM inside Flutter \u2014 n = ${r()}`, fontSize: 13, fontWeight: 600, color: "#FF1A1A2E" }), pt("row", { gap: 8 }, pt("button", { label: "+1", onClick: () => n((i) => i + 1) }), pt("button", { label: "-1", onClick: () => n((i) => i - 1) }), pt("button", { label: "reset", onClick: () => n(0) })), pt("text", { label: "These widgets reach Shape D via the same JSX `<Column>` / `<Button>` you write in App.jsx \u2014 just compiled against skal/renderer-web (Shape B DOM target) instead of the bridge. Pointer events, hover, focus, ARIA all stay live.", fontSize: 11, color: "#FF4A4A5E" })), e);
    });
  }), Kt("solid-counter", (e) => {
    yt(() => {
      const [r, n] = K(0), i = Vt(() => r() % 2 === 0 ? "even" : "odd");
      e.innerHTML = `
      <div style="font-family:ui-sans-serif,system-ui,sans-serif;padding:14px;background:#f8fafc;border-radius:10px;height:100%;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;">
        <h3 style="margin:0;font-size:14px;color:#1a1a2e;">Solid signals \u2192 DOM inside Flutter</h3>
        <p style="margin:0;font-size:11px;color:#4a4a5e;line-height:1.4;">
          Same <code>createSignal</code> + <code>createMemo</code> Skal uses for the outer app \u2014 but bound to DOM via <code>createEffect</code> instead of the bridge renderer. Click the buttons; the DOM updates reactively, no manual diffing.
        </p>
        <div style="display:flex;gap:8px;align-items:center;">
          <button data-act="dec" style="padding:4px 10px;border-radius:6px;border:0;background:#ef4444;color:white;font-weight:600;cursor:pointer;font-size:12px;">\u22121</button>
          <button data-act="inc" style="padding:4px 10px;border-radius:6px;border:0;background:#22c55e;color:white;font-weight:600;cursor:pointer;font-size:12px;">+1</button>
          <span data-out="n" style="font-family:ui-monospace,monospace;font-size:13px;color:#1a1a2e;font-weight:600;"></span>
          <span data-out="parity" style="font-size:11px;padding:2px 8px;border-radius:999px;background:#e5e7eb;color:#4a4a5e;"></span>
        </div>
      </div>
    `;
      const a = e.querySelector('[data-out="n"]'), l = e.querySelector('[data-out="parity"]');
      e.querySelector('[data-act="inc"]').addEventListener("click", () => n((c) => c + 1)), e.querySelector('[data-act="dec"]').addEventListener("click", () => n((c) => c - 1)), xt(() => {
        a.textContent = `n = ${r()}`;
      }), xt(() => {
        l.textContent = i();
      });
    });
  });
  function Y(e) {
    return (() => {
      var r = s("column"), n = s("text");
      return _(r, n), t(r, "background", Te), t(r, "cornerRadius", 14), t(r, "padding", 16), t(r, "gap", 12), t(r, "borderWidth", 1), t(r, "borderColor", Se), t(n, "fontSize", 15), t(n, "fontWeight", 800), t(n, "color", Q), B(r, () => e.children, null), q((i) => t(n, "label", e.title, i)), r;
    })();
  }
  function ys(e) {
    const r = ["Inbox", "Starred", "Drafts", "Archive"];
    return [(() => {
      var n = s("column");
      return t(n, "background", ke), t(n, "padding", 16), t(n, "gap", 8), t(n, "height", "fill"), B(n, L(ce, { each: r, children: (i) => (() => {
        var a = s("box"), l = s("text");
        return _(a, l), t(a, "background", Te), t(a, "cornerRadius", 8), t(a, "padding", 12), t(a, "onTap", () => e.router.navigate("detail", { name: i }, { title: i })), t(l, "label", `${i}   \u203A`), t(l, "fontSize", 14), t(l, "color", Q), a;
      })() })), n;
    })(), (() => {
      var n = s("drawer"), i = s("box"), a = s("text");
      return _(n, i), t(n, "background", Te), _(i, a), t(i, "padding", 20), t(i, "background", se), t(a, "label", "Mail"), t(a, "fontSize", 20), t(a, "fontWeight", 800), t(a, "color", "#FFFFFF"), B(n, L(ce, { each: r, children: (l) => (() => {
        var c = s("box"), p = s("text");
        return _(c, p), t(c, "padding", 14), t(p, "label", l), t(p, "fontSize", 14), t(p, "color", Q), c;
      })() }), null), n;
    })()];
  }
  function xs(e) {
    return (() => {
      var r = s("column"), n = s("text"), i = s("text");
      return _(r, n), _(r, i), t(r, "background", ke), t(r, "padding", 16), t(r, "gap", 10), t(r, "height", "fill"), t(n, "fontSize", 20), t(n, "fontWeight", 800), t(n, "color", Q), t(i, "label", "The AppBar's \u2039 back button (and the system back / swipe gesture) all pop this route. The list screen behind stayed mounted \u2014 back is instant, no re-render, scroll preserved."), t(i, "fontSize", 13), t(i, "color", W), q((a) => t(n, "label", e.name, a)), r;
    })();
  }
  var ks = [se, ye, Ce, Fe];
  function Ts() {
    const [e, r] = K(false), [n, i] = K(false), [a, l] = K(false), [c, p] = K(0), [h, v] = K("0, 0"), [E, y] = K(false), [A, g] = K(["Alpha", "Beta", "Gamma"]);
    let z = 3;
    const T = dn({ gallery: (F) => (() => {
      var N = s("column"), x = s("text"), P = s("row");
      return _(N, x), _(N, P), t(N, "background", ke), t(N, "padding", 16), t(N, "gap", 12), t(N, "height", "fill"), t(x, "label", "Tap a swatch \u2014 it flies to the detail screen."), t(x, "fontSize", 13), t(x, "color", W), t(P, "gap", 12), B(P, L(ce, { each: ks, children: (f) => (() => {
        var S = s("hero"), k = s("box");
        return _(S, k), t(S, "tag", `hero-${f}`), t(k, "width", 56), t(k, "height", 56), t(k, "background", f), t(k, "cornerRadius", 12), t(k, "onTap", () => F.router.navigate("detail", { color: f })), S;
      })() })), N;
    })(), detail: { component: (F) => (() => {
      var N = s("column"), x = s("hero"), P = s("box"), f = s("text");
      return _(N, x), _(N, f), t(N, "background", ke), t(N, "padding", 16), t(N, "gap", 12), t(N, "height", "fill"), _(x, P), t(P, "width", "fill"), t(P, "height", 180), t(P, "cornerRadius", 20), t(f, "label", "The swatch flew here from the gallery \u2014 a shared-element transition, GPU-composited host-side."), t(f, "fontSize", 13), t(f, "color", W), q((S) => {
        var k = `hero-${F.params.color}`, D = F.params.color;
        return k !== S.e && (S.e = t(x, "tag", k, S.e)), D !== S.t && (S.t = t(P, "background", D, S.t)), S;
      }, { e: undefined, t: undefined }), N;
    })(), title: "Detail", transition: "fade" } }, "gallery");
    return (() => {
      var F = s("scrollView"), N = s("text"), x = s("text"), P = s("text");
      return _(F, N), _(F, x), _(F, P), t(F, "background", ke), t(F, "padding", 16), t(F, "gap", 14), t(N, "label", "Animations"), t(N, "fontSize", 24), t(N, "fontWeight", 800), t(N, "color", Q), t(x, "label", "Host-side motion \u2014 JS flips one signal, Flutter runs the whole tween. Zero per-frame bridge traffic. See ANIMATION.md for the full plan."), t(x, "fontSize", 13), t(x, "color", W), B(F, L(Y, { title: "Implicit hot-prop tween \u2014 the animate prop", get children() {
        return [(() => {
          var f = s("row"), S = s("box");
          return _(f, S), t(f, "gap", 8), t(S, "width", 64), t(S, "height", 64), t(S, "background", se), t(S, "cornerRadius", 14), t(S, "animate", { duration: 450, curve: "easeInOut" }), q((k) => {
            var D = e() ? 0.3 : 1, M = e() ? 1.4 : 1, j = e() ? 1.4 : 1, fe = e() ? 0.5 : 0, oe = e() ? 70 : 0;
            return D !== k.e && (k.e = t(S, "opacity", D, k.e)), M !== k.t && (k.t = t(S, "scaleX", M, k.t)), j !== k.a && (k.a = t(S, "scaleY", j, k.a)), fe !== k.o && (k.o = t(S, "rotation", fe, k.o)), oe !== k.i && (k.i = t(S, "translationX", oe, k.i)), k;
          }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined }), f;
        })(), (() => {
          var f = s("button");
          return t(f, "onClick", () => r(!e())), q((S) => t(f, "label", e() ? "Reset" : "Animate", S)), f;
        })(), (() => {
          var f = s("text");
          return t(f, "label", "opacity + scale + rotation + translation tween together \u2014 JS only flips one signal; the whole tween runs host-side."), t(f, "fontSize", 11), t(f, "color", W), f;
        })()];
      } }), P), B(F, L(Y, { title: "Cold-prop tween \u2014 colour \xB7 radius \xB7 padding", get children() {
        return [(() => {
          var f = s("box"), S = s("text");
          return _(f, S), t(f, "animate", { duration: 400, curve: "easeInOut" }), t(f, "width", "fill"), t(S, "label", "AnimatedContainer tweens these host-side"), t(S, "fontSize", 12), t(S, "color", "#FFFFFFFF"), q((k) => {
            var D = n() ? gt : se, M = n() ? 32 : 8, j = n() ? 28 : 12;
            return D !== k.e && (k.e = t(f, "background", D, k.e)), M !== k.t && (k.t = t(f, "cornerRadius", M, k.t)), j !== k.a && (k.a = t(f, "padding", j, k.a)), k;
          }, { e: undefined, t: undefined, a: undefined }), f;
        })(), (() => {
          var f = s("button");
          return t(f, "onClick", () => i(!n())), q((S) => t(f, "label", n() ? "Reset" : "Animate", S)), f;
        })(), (() => {
          var f = s("text");
          return t(f, "label", "background, cornerRadius and padding are cold props \u2014 the host's AnimatedContainer tweens them; JS writes each value once."), t(f, "fontSize", 11), t(f, "color", W), f;
        })()];
      } }), P), B(F, L(Y, { title: "Looping \u2014 repeat \xB7 reverse", get children() {
        return [(() => {
          var f = s("row"), S = s("box"), k = s("box"), D = s("box");
          return _(f, S), _(f, k), _(f, D), t(f, "gap", 20), t(S, "width", 44), t(S, "height", 44), t(S, "background", Fe), t(S, "cornerRadius", 22), t(S, "animate", { duration: 800, curve: "easeInOut", repeat: true, reverse: true }), t(S, "scaleX", 1.35), t(S, "scaleY", 1.35), t(k, "width", 44), t(k, "height", 44), t(k, "background", ye), t(k, "cornerRadius", 10), t(k, "animate", { duration: 1400, repeat: true }), t(k, "rotation", 6.2832), t(D, "width", 44), t(D, "height", 44), t(D, "background", Ce), t(D, "cornerRadius", 22), t(D, "animate", { duration: 900, curve: "easeInOut", repeat: true, reverse: true }), t(D, "opacity", 0.25), f;
        })(), (() => {
          var f = s("text");
          return t(f, "label", "A pulse, a spin and a breathe \u2014 each loops forever host-side; JS set the endpoints once and never touches them again."), t(f, "fontSize", 11), t(f, "color", W), f;
        })()];
      } }), P), B(F, L(Y, { title: "Spring physics \u2014 animate.spring", get children() {
        return [(() => {
          var f = s("column"), S = s("box"), k = s("box"), D = s("box");
          return _(f, S), _(f, k), _(f, D), t(f, "gap", 10), t(S, "width", 48), t(S, "height", 48), t(S, "background", se), t(S, "cornerRadius", 10), t(S, "animate", { duration: 700, spring: "gentle" }), t(k, "width", 48), t(k, "height", 48), t(k, "background", ye), t(k, "cornerRadius", 10), t(k, "animate", { duration: 700, spring: "bouncy" }), t(D, "width", 48), t(D, "height", 48), t(D, "background", Ce), t(D, "cornerRadius", 10), t(D, "animate", { duration: 700, spring: "stiff" }), q((M) => {
            var j = a() ? 150 : 0, fe = a() ? 150 : 0, oe = a() ? 150 : 0;
            return j !== M.e && (M.e = t(S, "translationX", j, M.e)), fe !== M.t && (M.t = t(k, "translationX", fe, M.t)), oe !== M.a && (M.a = t(D, "translationX", oe, M.a)), M;
          }, { e: undefined, t: undefined, a: undefined }), f;
        })(), (() => {
          var f = s("button");
          return t(f, "onClick", () => l(!a())), q((S) => t(f, "label", a() ? "Back" : "Spring", S)), f;
        })(), (() => {
          var f = s("text");
          return t(f, "label", "gentle \xB7 bouncy \xB7 stiff \u2014 three spring-like curves; bouncy overshoots and wobbles into place."), t(f, "fontSize", 11), t(f, "color", W), f;
        })()];
      } }), P), B(F, L(Y, { title: "Physics \u2014 real SpringSimulation (spring)", get children() {
        return [(() => {
          var f = s("column"), S = s("box"), k = s("box"), D = s("box");
          return _(f, S), _(f, k), _(f, D), t(f, "gap", 12), t(S, "width", 52), t(S, "height", 52), t(S, "background", se), t(S, "cornerRadius", 12), t(S, "spring", "gentle"), t(k, "width", 52), t(k, "height", 52), t(k, "background", ye), t(k, "cornerRadius", 12), t(k, "spring", "bouncy"), t(D, "width", 52), t(D, "height", 52), t(D, "background", Ce), t(D, "cornerRadius", 12), t(D, "spring", "stiff"), q((M) => {
            var j = c(), fe = c(), oe = c();
            return j !== M.e && (M.e = t(S, "translationX", j, M.e)), fe !== M.t && (M.t = t(k, "translationX", fe, M.t)), oe !== M.a && (M.a = t(D, "translationX", oe, M.a)), M;
          }, { e: undefined, t: undefined, a: undefined }), f;
        })(), (() => {
          var f = s("button");
          return t(f, "onClick", () => p(c() === 0 ? 175 : 0)), q((S) => t(f, "label", c() === 0 ? "Spring" : "Back", S)), f;
        })(), (() => {
          var f = s("text");
          return t(f, "label", "A real SpringSimulation drives these \u2014 not a curve. Tap fast: the box retargets from its CURRENT position and velocity mid-flight, with no dead-stop restart. gentle settles, bouncy overshoots, stiff snaps."), t(f, "fontSize", 11), t(f, "color", W), f;
        })()];
      } }), P), B(F, L(Y, { title: "Physics \u2014 release momentum (draggable + release)", get children() {
        return [(() => {
          var f = s("box"), S = s("box"), k = s("text");
          return _(f, S), t(f, "height", 150), t(f, "background", me), t(f, "cornerRadius", 12), _(S, k), t(S, "draggable", true), t(S, "release", "glide"), t(S, "width", 60), t(S, "height", 60), t(S, "background", se), t(S, "cornerRadius", 14), t(S, "onPanEnd", (D, M) => v(`${D.toFixed(0)}, ${M.toFixed(0)}`)), t(k, "label", "glide"), t(k, "fontSize", 11), t(k, "color", "#FFFFFFFF"), f;
        })(), (() => {
          var f = s("text");
          return t(f, "fontSize", 11), t(f, "color", W), q((S) => t(f, "label", `Throw the blue box \u2014 friction carries it on after you let go and decelerates it to rest. Resting at ${h()}.`, S)), f;
        })(), (() => {
          var f = s("box"), S = s("box"), k = s("text");
          return _(f, S), t(f, "height", 150), t(f, "background", me), t(f, "cornerRadius", 12), _(S, k), t(S, "draggable", true), t(S, "release", "springBack"), t(S, "width", 60), t(S, "height", 60), t(S, "background", Fe), t(S, "cornerRadius", 14), t(k, "label", "spring"), t(k, "fontSize", 11), t(k, "color", "#FFFFFFFF"), f;
        })(), (() => {
          var f = s("text");
          return t(f, "label", "Throw the purple box \u2014 a SpringSimulation springs it home to the origin, seeded with your fling velocity (throw harder \u2192 springs back harder). All host-side: zero per-frame bridge traffic."), t(f, "fontSize", 11), t(f, "color", W), f;
        })()];
      } }), P), B(F, L(Y, { title: "Cross-fade \u2014 CrossFade", get children() {
        return [(() => {
          var f = s("box"), S = s("crossFade");
          return _(f, S), t(f, "height", 92), B(S, (() => {
            var k = nn(() => !!E());
            return () => k() ? (() => {
              var D = s("box"), M = s("text");
              return _(D, M), t(D, "width", "fill"), t(D, "height", 92), t(D, "background", Fe), t(D, "cornerRadius", 12), t(D, "padding", 16), t(M, "label", "Panel B"), t(M, "fontSize", 16), t(M, "fontWeight", 800), t(M, "color", "#FFFFFFFF"), D;
            })() : (() => {
              var D = s("box"), M = s("text");
              return _(D, M), t(D, "width", "fill"), t(D, "height", 92), t(D, "background", se), t(D, "cornerRadius", 12), t(D, "padding", 16), t(M, "label", "Panel A"), t(M, "fontSize", 16), t(M, "fontWeight", 800), t(M, "color", "#FFFFFFFF"), D;
            })();
          })()), f;
        })(), (() => {
          var f = s("button");
          return t(f, "label", "Swap panel"), t(f, "onClick", () => y(!E())), f;
        })(), (() => {
          var f = s("text");
          return t(f, "label", "AnimatedSwitcher fades the old child out as the new fades in \u2014 the outgoing element is retained through the fade."), t(f, "fontSize", 11), t(f, "color", W), f;
        })()];
      } }), P), B(F, L(Y, { title: "Animated list \u2014 AnimatedList", get children() {
        return [(() => {
          var f = s("animatedList");
          return t(f, "gap", 8), B(f, L(ce, { get each() {
            return A();
          }, children: (S) => (() => {
            var k = s("box"), D = s("text");
            return _(k, D), t(k, "background", me), t(k, "cornerRadius", 8), t(k, "padding", 12), t(D, "label", S), t(D, "fontSize", 13), t(D, "color", Q), k;
          })() })), f;
        })(), (() => {
          var f = s("row"), S = s("button"), k = s("button");
          return _(f, S), _(f, k), t(f, "gap", 8), t(S, "label", "Add"), t(S, "onClick", () => g([...A(), `Item ${++z}`])), t(k, "label", "Remove"), t(k, "onClick", () => g(A().slice(0, -1))), f;
        })(), (() => {
          var f = s("text");
          return t(f, "label", "Add \u2192 a row fades + expands in; Remove \u2192 it collapses + fades out. Both host-side, via deferred teardown."), t(f, "fontSize", 11), t(f, "color", W), f;
        })()];
      } }), P), B(F, L(Y, { title: "Shared element \u2014 Hero", get children() {
        return [(() => {
          var f = s("box");
          return t(f, "height", 300), t(f, "borderWidth", 1), t(f, "borderColor", Se), t(f, "cornerRadius", 8), B(f, L(T.View, {})), f;
        })(), (() => {
          var f = s("text");
          return t(f, "label", "A Hero with a matching tag on each screen flies between them across the navigator push \u2014 the navigator is a real Flutter Navigator."), t(f, "fontSize", 11), t(f, "color", W), f;
        })()];
      } }), P), t(P, "label", "\u2014 end of animations \u2014"), t(P, "fontSize", 12), t(P, "color", W), F;
    })();
  }
  function Es() {
    const [e, r] = K("material"), [n, i] = K(false), [a, l] = K(true), [c, p] = K(false), [h, v] = K(40), [E, y] = K(""), [A, g] = K("none yet"), [z, T] = K(0), [F, N] = K(["Item one", "Item two", "Item three", "Item four"]);
    let x = 0;
    const [P, f] = K([]), [S, k] = K([]), [D, M] = K("M"), [j, fe] = K([]), [oe, Ee] = K(0), [le, $e] = K(false), [bt, zt] = K(0), [$r, _t] = K(0), [er, wn] = K(false), [xe, tr] = K("\u2014"), [rr, Sn] = K("0, 0"), [yn, Dt] = K("\u2014"), [rt, He] = K(1);
    let Rr = 1;
    const [Pr, ze] = K("\u2014 try a dialog button \u2014"), [vt, Nt] = K("\u2014 no date / time picked \u2014"), [Ar, xn] = K(["First item", "Second item", "Third item", "Fourth item"]), Fr = dn({ list: { component: (m) => L(ys, { get router() {
      return m.router;
    } }), title: "Mailboxes" }, detail: (m) => L(xs, { get name() {
      return m.params.name;
    }, get router() {
      return m.router;
    } }) }, "list"), [nr, ir] = K(0), Lt = (m, w) => {
      r(m), i(w), Vo(m, w ? 1 : 0);
    }, kn = dn({ home: { component: (m) => R(m.router) }, animations: { component: () => L(Ts, {}), title: "Animations" } }, "home");
    function R(m) {
      return (() => {
        var w = s("scrollView"), C = s("text"), I = s("text"), O = s("text");
        return _(w, C), _(w, I), _(w, O), t(w, "background", ke), t(w, "padding", 16), t(w, "gap", 14), t(w, "scrollbar", true), t(C, "label", "Skal \u2014 Component Demo"), t(C, "testID", "home-title"), t(C, "fontSize", 24), t(C, "fontWeight", 800), t(C, "color", Q), t(I, "label", "Every fast-path widget, plus animation, the design system, and dialogs."), t(I, "fontSize", 13), t(I, "color", W), B(w, L(Y, { title: "Design system \u2014 setDesign()", get children() {
          return [(() => {
            var o = s("text");
            return t(o, "fontSize", 13), t(o, "color", W), q((u) => t(o, "label", `active: ${e()} \xB7 ${n() ? "dark" : "light"}`, u)), o;
          })(), (() => {
            var o = s("row"), u = s("button"), d = s("button"), b = s("button");
            return _(o, u), _(o, d), _(o, b), t(o, "gap", 8), t(u, "label", "Material"), t(u, "onClick", () => Lt("material", n())), t(d, "label", "Cupertino"), t(d, "onClick", () => Lt("cupertino", n())), t(b, "onClick", () => Lt(e(), !n())), q(($) => t(b, "label", n() ? "Light mode" : "Dark mode", $)), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "Buttons, switches, sliders, the text field & spinner all swap Material\u2194Cupertino."), t(o, "fontSize", 11), t(o, "color", W), o;
          })()];
        } }), O), B(w, L(Y, { title: "Layout \u2014 box \xB7 row \xB7 wrap", get children() {
          return [(() => {
            var o = s("row"), u = s("box"), d = s("box"), b = s("box");
            return _(o, u), _(o, d), _(o, b), t(o, "gap", 8), t(u, "width", 56), t(u, "height", 56), t(u, "background", se), t(u, "cornerRadius", 10), t(d, "width", 56), t(d, "height", 56), t(d, "background", ye), t(d, "cornerRadius", 10), t(b, "width", 56), t(b, "height", 56), t(b, "background", Ce), t(b, "cornerRadius", 10), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "Wrap \u2014 children flow onto new runs:"), t(o, "fontSize", 11), t(o, "color", W), o;
          })(), (() => {
            var o = s("wrap");
            return t(o, "gap", 6), B(o, L(ce, { each: ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa"], children: (u) => (() => {
              var d = s("box"), b = s("text");
              return _(d, b), t(d, "background", me), t(d, "cornerRadius", 12), t(d, "paddingLeft", 10), t(d, "paddingRight", 10), t(d, "paddingTop", 6), t(d, "paddingBottom", 6), t(b, "label", u), t(b, "fontSize", 12), t(b, "color", Q), d;
            })() })), o;
          })()];
        } }), O), B(w, L(Y, { title: "Stack \u2014 overlap + positioned children", get children() {
          var o = s("stack"), u = s("box"), d = s("box"), b = s("text"), $ = s("box");
          return _(o, u), _(o, d), _(o, $), t(o, "width", "fill"), t(o, "height", 120), t(u, "width", "fill"), t(u, "height", 120), t(u, "background", Fe), t(u, "cornerRadius", 12), _(d, b), t(d, "top", 10), t(d, "left", 10), t(d, "background", Te), t(d, "cornerRadius", 8), t(d, "paddingLeft", 10), t(d, "paddingRight", 10), t(d, "paddingTop", 4), t(d, "paddingBottom", 4), t(b, "label", "top \xB7 left"), t(b, "fontSize", 11), t(b, "color", Q), t($, "bottom", 10), t($, "right", 10), t($, "width", 30), t($, "height", 30), t($, "background", gt), t($, "cornerRadius", 15), o;
        } }), O), B(w, L(Y, { title: "Text & RichText", get children() {
          return [(() => {
            var o = s("text");
            return t(o, "label", "Styled text \u2014 18sp, weight 700."), t(o, "fontSize", 18), t(o, "fontWeight", 700), t(o, "color", Q), o;
          })(), (() => {
            var o = s("richText"), u = s("text"), d = s("text"), b = s("text"), $ = s("text"), H = s("text");
            return _(o, u), _(o, d), _(o, b), _(o, $), _(o, H), t(u, "label", "Rich text "), t(u, "fontSize", 16), t(u, "color", Q), t(d, "label", "mixes "), t(d, "fontSize", 16), t(d, "color", se), t(d, "fontWeight", 800), t(b, "label", "size, "), t(b, "fontSize", 22), t(b, "color", gt), t(b, "fontWeight", 700), t($, "label", "weight "), t($, "fontSize", 16), t($, "color", ye), t($, "fontWeight", 800), t(H, "label", "and colour inline."), t(H, "fontSize", 16), t(H, "color", Q), o;
          })()];
        } }), O), B(w, L(Y, { title: "Image \u2014 network \xB7 BoxFit \xB7 rounded", get children() {
          return [(() => {
            var o = s("image");
            return t(o, "src", "https://picsum.photos/seed/skal/640/360"), t(o, "width", "fill"), t(o, "height", 160), t(o, "contentScale", 1), t(o, "cornerRadius", 12), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "contentScale=1 (cover); cornerRadius clips the pixels. Requires network."), t(o, "fontSize", 11), t(o, "color", W), o;
          })()];
        } }), O), B(w, L(Y, { title: "Scrolling \u2014 horizontal list \xB7 lazy grid \xB7 reorderable", get children() {
          return [(() => {
            var o = s("text");
            return t(o, "label", "listView axis=1 (horizontal, virtualized):"), t(o, "fontSize", 11), t(o, "color", W), o;
          })(), (() => {
            var o = s("listView");
            return t(o, "axis", 1), t(o, "height", 66), t(o, "gap", 8), B(o, L(ce, { each: [se, ye, Ce, Fe, gt, "#FF00C7BE", "#FFAF52DE", "#FFFFD60A"], children: (u) => (() => {
              var d = s("box");
              return t(d, "width", 66), t(d, "height", 50), t(d, "background", u), t(d, "cornerRadius", 10), d;
            })() })), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "lazyGrid \u2014 crossAxisCount=4:"), t(o, "fontSize", 11), t(o, "color", W), o;
          })(), (() => {
            var o = s("lazyGrid");
            return t(o, "crossAxisCount", 4), t(o, "aspectRatio", 1), t(o, "gap", 8), t(o, "height", 150), B(o, L(ce, { get each() {
              return Array.from({ length: 12 }, (u, d) => d);
            }, children: (u) => (() => {
              var d = s("box");
              return t(d, "background", u % 3 === 0 ? se : u % 3 === 1 ? ye : Ce), t(d, "cornerRadius", 8), d;
            })() })), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "reorderableListView \u2014 drag a row to reorder:"), t(o, "fontSize", 11), t(o, "color", W), o;
          })(), (() => {
            var o = s("reorderableListView");
            return t(o, "height", 200), t(o, "gap", 6), t(o, "onReorder", (u, d) => {
              const b = Ar().slice(), [$] = b.splice(u, 1);
              b.splice(d, 0, $), xn(b);
            }), B(o, L(ce, { get each() {
              return Ar();
            }, children: (u) => (() => {
              var d = s("box"), b = s("text");
              return _(d, b), t(d, "background", me), t(d, "cornerRadius", 8), t(d, "padding", 12), t(b, "label", u), t(b, "fontSize", 13), t(b, "color", Q), d;
            })() })), o;
          })()];
        } }), O), B(w, L(Y, { title: "Controls \u2014 switch \xB7 checkbox \xB7 slider \xB7 text field", get children() {
          return [(() => {
            var o = s("row"), u = s("switch"), d = s("text");
            return _(o, u), _(o, d), t(o, "gap", 12), t(u, "onChange", (b) => l(b)), t(d, "fontSize", 13), t(d, "color", Q), q((b) => {
              var $ = a(), H = a() ? "switch: on" : "switch: off";
              return $ !== b.e && (b.e = t(u, "checked", $, b.e)), H !== b.t && (b.t = t(d, "label", H, b.t)), b;
            }, { e: undefined, t: undefined }), o;
          })(), (() => {
            var o = s("row"), u = s("checkbox"), d = s("text");
            return _(o, u), _(o, d), t(o, "gap", 12), t(u, "onChange", (b) => p(b)), t(d, "fontSize", 13), t(d, "color", Q), q((b) => {
              var $ = c(), H = c() ? "checkbox: checked" : "checkbox: unchecked";
              return $ !== b.e && (b.e = t(u, "checked", $, b.e)), H !== b.t && (b.t = t(d, "label", H, b.t)), b;
            }, { e: undefined, t: undefined }), o;
          })(), (() => {
            var o = s("slider");
            return t(o, "min", 0), t(o, "max", 100), t(o, "onChange", (u) => v(u)), q((u) => t(o, "value", h(), u)), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 13), t(o, "color", Q), q((u) => t(o, "label", `slider: ${Math.round(h())}`, u)), o;
          })(), (() => {
            var o = s("textInput");
            return t(o, "placeholder", "Type your name\u2026"), t(o, "onChange", (u) => y(u)), t(o, "onSubmit", (u) => ci(`Submitted: ${u}`)), q((u) => t(o, "value", E(), u)), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 13), t(o, "color", W), q((u) => t(o, "label", E() ? `Hello, ${E()}!` : "\u2014 type above; press Enter to submit \u2014", u)), o;
          })()];
        } }), O), B(w, L(Y, { title: "Indicators \u2014 spinner \xB7 progress bar", get children() {
          return [(() => {
            var o = s("row"), u = s("activityIndicator"), d = s("text");
            return _(o, u), _(o, d), t(o, "gap", 12), t(u, "color", se), t(d, "label", "CircularProgressIndicator"), t(d, "fontSize", 13), t(d, "color", Q), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "determinate \u2014 tracks the slider above:"), t(o, "fontSize", 11), t(o, "color", W), o;
          })(), (() => {
            var o = s("progressBar");
            return t(o, "color", se), q((u) => t(o, "progress", h() / 100, u)), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "indeterminate:"), t(o, "fontSize", 11), t(o, "color", W), o;
          })(), (() => {
            var o = s("progressBar");
            return t(o, "color", ye), o;
          })()];
        } }), O), B(w, L(Y, { title: "Animation", get children() {
          return [(() => {
            var o = s("text");
            return t(o, "label", "Implicit tweens, looping, list enter/exit, Hero \u2014 all host-side, zero per-frame bridge traffic. Opens a dedicated page."), t(o, "fontSize", 11), t(o, "color", W), o;
          })(), (() => {
            var o = s("button");
            return t(o, "label", "Open Animations \u2192"), t(o, "onClick", () => m.navigate("animations")), o;
          })()];
        } }), O), B(w, L(Y, { title: "ListTile \u2014 structured rows", get children() {
          return [(() => {
            var o = s("box"), u = s("column"), d = s("listTile"), b = s("listTile"), $ = s("listTile");
            return _(o, u), t(o, "background", Te), t(o, "cornerRadius", 12), t(o, "borderWidth", 1), t(o, "borderColor", Se), _(u, d), _(u, b), _(u, $), t(u, "padding", 0), t(u, "gap", 0), t(d, "leadingIcon", "person"), t(d, "title", "Profile"), t(d, "subtitle", "Name, photo, bio"), t(d, "trailingIcon", "explore"), t(d, "onClick", () => g("tapped Profile")), t(b, "leadingIcon", "bell"), t(b, "title", "Notifications"), t(b, "subtitle", "Sounds, badges, alerts"), t(b, "trailingIcon", "explore"), t(b, "onClick", () => g("tapped Notifications")), t($, "leadingIcon", "settings"), t($, "title", "Settings"), t($, "trailingIcon", "explore"), t($, "onClick", () => g("tapped Settings")), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 11), t(o, "color", W), q((u) => t(o, "label", `last row: ${A()}`, u)), o;
          })()];
        } }), O), B(w, L(Y, { title: "PageView \u2014 swipe between pages", get children() {
          return [(() => {
            var o = s("box"), u = s("pageView"), d = s("box"), b = s("text"), $ = s("box"), H = s("text"), G = s("box"), J = s("text");
            return _(o, u), t(o, "height", 140), _(u, d), _(u, $), _(u, G), t(u, "onChange", (X) => T(X)), _(d, b), t(d, "width", "fill"), t(d, "height", 140), t(d, "background", se), t(d, "cornerRadius", 12), t(d, "padding", 20), t(b, "label", "Page 1 \u2014 swipe \u2192"), t(b, "fontSize", 16), t(b, "fontWeight", 800), t(b, "color", "#FFFFFFFF"), _($, H), t($, "width", "fill"), t($, "height", 140), t($, "background", ye), t($, "cornerRadius", 12), t($, "padding", 20), t(H, "label", "Page 2"), t(H, "fontSize", 16), t(H, "fontWeight", 800), t(H, "color", "#FFFFFFFF"), _(G, J), t(G, "width", "fill"), t(G, "height", 140), t(G, "background", Ce), t(G, "cornerRadius", 12), t(G, "padding", 20), t(J, "label", "Page 3"), t(J, "fontSize", 16), t(J, "fontWeight", 800), t(J, "color", "#FFFFFFFF"), q((X) => t(u, "activeTab", z(), X)), o;
          })(), (() => {
            var o = s("row"), u = s("button"), d = s("button");
            return _(o, u), _(o, d), t(o, "gap", 8), t(u, "label", "\u25C0 Prev"), t(u, "onClick", () => T(Math.max(0, z() - 1))), t(d, "label", "Next \u25B6"), t(d, "onClick", () => T(Math.min(2, z() + 1))), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 11), t(o, "color", W), q((u) => t(o, "label", `page ${z() + 1} of 3 \u2014 swipe or use the buttons`, u)), o;
          })()];
        } }), O), B(w, L(Y, { title: "Pull-to-refresh + swipe-to-dismiss", get children() {
          return [(() => {
            var o = s("box"), u = s("listView");
            return _(o, u), t(o, "height", 210), t(o, "borderWidth", 1), t(o, "borderColor", Se), t(o, "cornerRadius", 8), t(u, "onRefresh", async () => {
              await new Promise((d) => setTimeout(d, 900)), N([`Fresh item ${++x}`, ...F()]);
            }), B(u, L(ce, { get each() {
              return F();
            }, children: (d) => (() => {
              var b = s("dismissible"), $ = s("box"), H = s("text");
              return _(b, $), t(b, "onDismiss", () => N(F().filter((G) => G !== d))), _($, H), t($, "width", "fill"), t($, "background", me), t($, "cornerRadius", 8), t($, "padding", 14), t(H, "label", d), t(H, "fontSize", 13), t(H, "color", Q), b;
            })() })), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "Pull the list down to refresh (a 900ms async task \u2014 the spinner waits for it); swipe any row sideways to dismiss it."), t(o, "fontSize", 11), t(o, "color", W), o;
          })()];
        } }), O), B(w, L(Y, { title: "Slivers \u2014 collapsing header (CustomScrollView)", get children() {
          return [(() => {
            var o = s("box"), u = s("customScrollView"), d = s("sliverAppBar"), b = s("box"), $ = s("text"), H = s("sliverList"), G = s("sliverGrid");
            return _(o, u), t(o, "height", 340), t(o, "borderWidth", 1), t(o, "borderColor", Se), t(o, "cornerRadius", 8), _(u, d), _(u, H), _(u, G), _(d, b), t(d, "title", "Collapsing header"), t(d, "height", 170), t(d, "sliverMode", "pinned"), t(d, "background", se), _(b, $), t(b, "width", "fill"), t(b, "height", 170), t(b, "background", Fe), t(b, "padding", 20), t($, "label", "Parallax background"), t($, "fontSize", 18), t($, "fontWeight", 800), t($, "color", "#FFFFFFFF"), B(H, L(ce, { each: ["One", "Two", "Three", "Four", "Five"], children: (J) => (() => {
              var X = s("box"), te = s("text");
              return _(X, te), t(X, "width", "fill"), t(X, "background", Te), t(X, "padding", 16), t(X, "borderWidth", 1), t(X, "borderColor", Se), t(te, "label", `Row ${J}`), t(te, "fontSize", 14), t(te, "color", Q), X;
            })() })), t(G, "crossAxisCount", 3), t(G, "aspectRatio", 1), t(G, "gap", 8), B(G, L(ce, { each: [se, ye, Ce, Fe, gt, se, ye, Ce, Fe], children: (J) => (() => {
              var X = s("box");
              return t(X, "background", J), t(X, "cornerRadius", 10), X;
            })() })), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "Scroll the panel up \u2014 the purple header collapses into a pinned blue bar. The SliverList builds rows lazily; non-sliver children would auto-wrap in a SliverToBoxAdapter."), t(o, "fontSize", 11), t(o, "color", W), o;
          })()];
        } }), O), B(w, L(Y, { title: "Canvas \u2014 CustomPaint 2-D drawing", get children() {
          return [(() => {
            var o = s("box"), u = s("canvas");
            return _(o, u), t(o, "background", Te), t(o, "cornerRadius", 12), t(o, "borderWidth", 1), t(o, "borderColor", Se), t(o, "padding", 10), t(u, "width", 300), t(u, "height", 170), t(u, "draw", (d) => {
              d.strokeStyle(Se).lineWidth(2).beginPath().moveTo(16, 150).lineTo(284, 150).stroke(), [50, 95, 70, h() + 10, 80].forEach((b, $) => {
                d.fillStyle($ === 3 ? se : Fe).fillRect(28 + $ * 52, 150 - b, 34, b);
              }), d.fillStyle(ye).beginPath().circle(252, 44, 22).fill(), d.fillStyle(Q).fontSize(12).fillText("bars \xB7 circle \xB7 path \xB7 text", 18, 22), P().forEach((b) => {
                d.fillStyle(b.color).beginPath().circle(b.x, b.y, b.r).fill();
              });
            }), o;
          })(), (() => {
            var o = s("row"), u = s("button"), d = s("button");
            return _(o, u), _(o, d), t(o, "gap", 8), t(u, "label", "Draw a shape"), t(u, "onClick", () => f([...P(), { x: 24 + Math.random() * 252, y: 16 + Math.random() * 120, r: 8 + Math.random() * 20, color: [se, ye, Ce, gt, Fe][Math.floor(Math.random() * 5)] }])), t(d, "label", "Clear"), t(d, "onClick", () => f([])), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "Bars, a circle, a stroked path, text. The 4th bar tracks the Controls slider; the buttons append/clear circles \u2014 each click flips the canvasShapes signal, so the draw callback re-records and the host repaints. Static drawings cross the bridge exactly once."), t(o, "fontSize", 11), t(o, "color", W), o;
          })()];
        } }), O), B(w, L(Y, { title: "Drag-and-drop \u2014 DragItem onto DropZone", get children() {
          return [(() => {
            var o = s("row");
            return t(o, "gap", 8), B(o, L(ce, { each: ["Apple", "Banana", "Cherry"], children: (u) => (() => {
              var d = s("dragItem"), b = s("box"), $ = s("text");
              return _(d, b), t(d, "dragData", u), _(b, $), t(b, "background", Fe), t(b, "cornerRadius", 20), t(b, "padding", 12), t($, "label", u), t($, "fontSize", 13), t($, "color", "#FFFFFFFF"), d;
            })() })), o;
          })(), (() => {
            var o = s("dropZone"), u = s("box"), d = s("text");
            return _(o, u), t(o, "onDrop", (b) => k([...S(), b])), _(u, d), t(u, "width", "fill"), t(u, "height", 90), t(u, "background", me), t(u, "cornerRadius", 12), t(u, "padding", 16), t(d, "fontSize", 13), t(d, "color", Q), q((b) => t(d, "label", S().length ? `Basket: ${S().join(", ")}` : "Drag a chip into this zone", b)), o;
          })(), (() => {
            var o = s("row"), u = s("button");
            return _(o, u), t(o, "gap", 8), t(u, "label", "Clear basket"), t(u, "onClick", () => k([])), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "Drag a fruit chip onto the zone \u2014 it highlights host-side while you hover; on release onDrop fires with the chip's dragData string. The whole drag is host-side; only the drop crosses the bridge."), t(o, "fontSize", 11), t(o, "color", W), o;
          })()];
        } }), O), B(w, L(Y, { title: "More controls \u2014 radio \xB7 chip \xB7 segmented \xB7 accordion", get children() {
          return [(() => {
            var o = s("row");
            return t(o, "gap", 16), B(o, L(ce, { each: ["S", "M", "L"], children: (u) => (() => {
              var d = s("row"), b = s("radio"), $ = s("text");
              return _(d, b), _(d, $), t(d, "gap", 2), t(b, "onChange", () => M(u)), t($, "label", u), t($, "fontSize", 13), t($, "color", Q), q((H) => t(b, "checked", D() === u, H)), d;
            })() })), o;
          })(), (() => {
            var o = s("row");
            return t(o, "gap", 8), B(o, L(ce, { each: ["Red", "Green", "Blue"], children: (u) => (() => {
              var d = s("chip");
              return t(d, "label", u), t(d, "onChange", (b) => fe(b ? [...j(), u] : j().filter(($) => $ !== u))), q((b) => t(d, "checked", j().includes(u), b)), d;
            })() })), o;
          })(), (() => {
            var o = s("segmentedButton"), u = s("text"), d = s("text"), b = s("text");
            return _(o, u), _(o, d), _(o, b), t(o, "onChange", ($) => Ee($)), t(u, "label", "Day"), t(u, "fontSize", 13), t(d, "label", "Week"), t(d, "fontSize", 13), t(b, "label", "Month"), t(b, "fontSize", 13), q(($) => t(o, "activeTab", oe(), $)), o;
          })(), (() => {
            var o = s("row"), u = s("text"), d = s("dropdown"), b = s("text"), $ = s("text"), H = s("text");
            return _(o, u), _(o, d), t(o, "gap", 8), t(u, "label", "Priority"), t(u, "fontSize", 13), t(u, "color", Q), _(d, b), _(d, $), _(d, H), t(d, "onChange", (G) => zt(G)), t(b, "label", "Low"), t(b, "fontSize", 13), t($, "label", "Medium"), t($, "fontSize", 13), t(H, "label", "High"), t(H, "fontSize", 13), q((G) => t(d, "activeTab", bt(), G)), o;
          })(), (() => {
            var o = s("box"), u = s("expansionTile"), d = s("box"), b = s("text");
            return _(o, u), t(o, "background", Te), t(o, "cornerRadius", 8), t(o, "borderWidth", 1), t(o, "borderColor", Se), _(u, d), t(u, "title", "Details"), t(u, "onChange", ($) => $e($)), _(d, b), t(d, "padding", 14), t(d, "background", me), t(b, "label", "Body content revealed by the accordion \u2014 host-owned open state, host-side expand animation."), t(b, "fontSize", 12), t(b, "color", W), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 11), t(o, "color", W), q((u) => t(o, "label", `size ${D()} \xB7 chips ${j().join("/") || "\u2014"} \xB7 segment ${["Day", "Week", "Month"][oe()]} \xB7 priority ${["Low", "Medium", "High"][bt()]} \xB7 details ${le() ? "open" : "closed"}`, u)), o;
          })()];
        } }), O), B(w, L(Y, { title: "Stepper \u2014 multi-step flow", get children() {
          return [(() => {
            var o = s("stepper"), u = s("step"), d = s("text"), b = s("step"), $ = s("text"), H = s("step"), G = s("text");
            return _(o, u), _(o, b), _(o, H), t(o, "onChange", (J) => _t(J)), _(u, d), t(u, "title", "Account"), t(d, "label", "Create your account \u2014 name, email, password."), t(d, "fontSize", 12), t(d, "color", W), _(b, $), t(b, "title", "Profile"), t($, "label", "Add a photo and a short bio."), t($, "fontSize", 12), t($, "color", W), _(H, G), t(H, "title", "Done"), t(G, "label", "All set \u2014 review and finish."), t(G, "fontSize", 12), t(G, "color", W), q((J) => t(o, "activeTab", $r(), J)), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 11), t(o, "color", W), q((u) => t(o, "label", `current step: ${$r() + 1} of 3`, u)), o;
          })()];
        } }), O), B(w, L(Y, { title: "BottomSheet \u2014 draggable / expandable", get children() {
          var o = s("box"), u = s("stack"), d = s("box"), b = s("text"), $ = s("bottomSheet"), H = s("box"), G = s("text");
          return _(o, u), t(o, "height", 300), t(o, "cornerRadius", 12), t(o, "background", me), _(u, d), _(u, $), _(d, b), t(d, "width", "fill"), t(d, "height", "fill"), t(d, "padding", 16), t(b, "label", "A DraggableScrollableSheet \u2014 drag the sheet up, or scroll its list past the edge to expand it."), t(b, "fontSize", 12), t(b, "color", W), _($, H), t($, "initialSize", 0.4), t($, "minSize", 0.18), t($, "maxSize", 0.95), t($, "background", Te), _(H, G), t(H, "padding", 16), t(G, "label", "Sheet content \u2014 drag or scroll"), t(G, "fontSize", 15), t(G, "fontWeight", 700), t(G, "color", Q), B($, L(ce, { each: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta"], children: (J) => (() => {
            var X = s("box"), te = s("text");
            return _(X, te), t(X, "padding", 14), t(te, "label", J), t(te, "fontSize", 14), t(te, "color", Q), X;
          })() }), null), o;
        } }), O), B(w, L(Y, { title: "Effects \u2014 BackdropFilter \xB7 InteractiveViewer", get children() {
          return [(() => {
            var o = s("stack"), u = s("image"), d = s("box"), b = s("backdropFilter"), $ = s("box");
            return _(o, u), _(o, d), t(u, "src", "https://picsum.photos/seed/skalblur/300/160"), t(u, "width", 300), t(u, "height", 160), t(u, "contentScale", 1), t(u, "cornerRadius", 10), _(d, b), t(d, "top", 0), t(d, "left", 150), t(d, "width", 150), t(d, "height", 160), _(b, $), t(b, "blurRadius", 12), t($, "width", 150), t($, "height", 160), t($, "background", "#33FFFFFF"), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "The right half is frosted by a BackdropFilter."), t(o, "fontSize", 11), t(o, "color", W), o;
          })(), (() => {
            var o = s("box"), u = s("interactiveViewer"), d = s("image");
            return _(o, u), t(o, "height", 200), t(o, "cornerRadius", 12), t(o, "background", me), _(u, d), t(u, "minScale", 1), t(u, "maxScale", 4), t(d, "src", "https://picsum.photos/seed/skalzoom/320/200"), t(d, "width", 320), t(d, "height", 200), t(d, "contentScale", 1), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "Pinch / scroll-wheel to zoom the image, drag to pan."), t(o, "fontSize", 11), t(o, "color", W), o;
          })()];
        } }), O), B(w, L(Y, { title: "Hover \u2014 onHover \xB7 semanticLabel", get children() {
          return [(() => {
            var o = s("box"), u = s("text");
            return _(o, u), t(o, "padding", 16), t(o, "cornerRadius", 10), t(o, "borderWidth", 1), t(o, "borderColor", Se), t(o, "onHover", (d) => wn(d)), t(o, "semanticLabel", "A hoverable demo card"), t(u, "fontSize", 14), q((d) => {
              var b = er() ? se : Te, $ = er() ? "Hovering \u2014 pointer is over the card" : "Move the pointer over this card", H = er() ? "#FFFFFF" : Q;
              return b !== d.e && (d.e = t(o, "background", b, d.e)), $ !== d.t && (d.t = t(u, "label", $, d.t)), H !== d.a && (d.a = t(u, "color", H, d.a)), d;
            }, { e: undefined, t: undefined, a: undefined }), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "onHover fires on pointer enter/exit (desktop/web). semanticLabel wraps the card in a Semantics node for screen readers."), t(o, "fontSize", 11), t(o, "color", W), o;
          })()];
        } }), O), B(w, L(Y, { title: "Keyboard \u2014 onKey", get children() {
          return [(() => {
            var o = s("box"), u = s("text");
            return _(o, u), t(o, "padding", 16), t(o, "cornerRadius", 10), t(o, "background", Te), t(o, "borderWidth", 1), t(o, "borderColor", Se), t(o, "onKey", (d) => tr(d)), t(u, "fontSize", 14), t(u, "color", Q), q((d) => t(u, "label", `last key: ${xe()}`, d)), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "Click the card to focus it, then press keys (\u2318S, Escape, arrows). onKey reports a normalized combo string; build any shortcut layer on it."), t(o, "fontSize", 11), t(o, "color", W), o;
          })()];
        } }), O), B(w, L(Y, { title: "Gestures \u2014 onTap \xB7 onLongPress \xB7 onDoubleTap", get children() {
          return [(() => {
            var o = s("box"), u = s("text");
            return _(o, u), t(o, "background", me), t(o, "cornerRadius", 12), t(o, "padding", 22), t(o, "onTap", () => g("onTap")), t(o, "onLongPress", () => g("onLongPress")), t(o, "onDoubleTap", () => g("onDoubleTap")), t(u, "label", "Tap / long-press / double-tap this box"), t(u, "fontSize", 13), t(u, "color", Q), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 12), t(o, "color", W), q((u) => t(o, "label", `last gesture: ${A()}`, u)), o;
          })()];
        } }), O), B(w, L(Y, { title: "Drag \u2014 draggable (zero per-frame bridge traffic)", get children() {
          return [(() => {
            var o = s("box"), u = s("box"), d = s("text");
            return _(o, u), t(o, "height", 150), t(o, "background", me), t(o, "cornerRadius", 12), _(u, d), t(u, "draggable", true), t(u, "width", 64), t(u, "height", 64), t(u, "background", se), t(u, "cornerRadius", 14), t(u, "onPanEnd", (b, $) => Sn(`${b.toFixed(0)}, ${$.toFixed(0)}`)), t(d, "label", "drag"), t(d, "fontSize", 12), t(d, "color", "#FFFFFFFF"), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 11), t(o, "color", W), q((u) => t(o, "label", `Drag the blue box \u2014 the host moves it itself, no event per frame. Resting offset: ${rr()}`, u)), o;
          })()];
        } }), O), B(w, L(Y, { title: "Pan \u2014 onPanUpdate delta stream", get children() {
          return [(() => {
            var o = s("box"), u = s("text");
            return _(o, u), t(o, "height", 70), t(o, "background", me), t(o, "cornerRadius", 12), t(o, "padding", 16), t(o, "onPanStart", () => Dt("drag started")), t(o, "onPanUpdate", (d, b) => Dt(`dx ${d.toFixed(1)}  dy ${b.toFixed(1)}`)), t(o, "onPanEnd", (d, b) => Dt(`fling v ${d.toFixed(0)}, ${b.toFixed(0)} dp/s`)), t(u, "label", "Drag anywhere on this strip"), t(u, "fontSize", 13), t(u, "color", Q), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 11), t(o, "color", W), q((u) => t(o, "label", `onPanUpdate: ${yn()}`, u)), o;
          })()];
        } }), O), B(w, L(Y, { title: "Scale \u2014 onScaleUpdate (pinch / rotate)", get children() {
          return [(() => {
            var o = s("box"), u = s("box"), d = s("text");
            return _(o, u), t(o, "height", 170), t(o, "background", me), t(o, "cornerRadius", 12), _(u, d), t(u, "width", 96), t(u, "height", 96), t(u, "background", Fe), t(u, "cornerRadius", 16), t(u, "onScaleStart", () => {
              Rr = rt();
            }), t(u, "onScaleUpdate", (b) => He(Math.max(0.3, Rr * b))), t(d, "label", "pinch"), t(d, "fontSize", 13), t(d, "color", "#FFFFFFFF"), q((b) => {
              var $ = rt(), H = rt();
              return $ !== b.e && (b.e = t(u, "scaleX", $, b.e)), H !== b.t && (b.t = t(u, "scaleY", H, b.t)), b;
            }, { e: undefined, t: undefined }), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 11), t(o, "color", W), q((u) => t(o, "label", `Pinch the purple box (two pointers / trackpad). Scale \xD7${rt().toFixed(2)}`, u)), o;
          })()];
        } }), O), B(w, L(Y, { title: "Dialogs \u2014 imperative JS API", get children() {
          return [(() => {
            var o = s("row"), u = s("button"), d = s("button");
            return _(o, u), _(o, d), t(o, "gap", 8), t(u, "label", "Alert"), t(u, "onClick", async () => {
              await li({ title: "Heads up", message: "A plain alert dialog.", actions: [{ label: "OK", value: "ok" }] }), ze("alert: dismissed");
            }), t(d, "label", "Confirm"), t(d, "onClick", async () => {
              ze(`confirm \u2192 ${await li({ title: "Delete file?", message: "This cannot be undone.", actions: [{ label: "Cancel", value: "cancel" }, { label: "Delete", value: "delete", style: "destructive" }] }) ?? "dismissed"}`);
            }), o;
          })(), (() => {
            var o = s("row"), u = s("button"), d = s("button");
            return _(o, u), _(o, d), t(o, "gap", 8), t(u, "label", "Action sheet"), t(u, "onClick", async () => {
              ze(`sheet \u2192 ${await Ho({ title: "Choose an action", actions: [{ label: "Copy", value: "copy" }, { label: "Share", value: "share" }, { label: "Delete", value: "delete", style: "destructive" }] }) ?? "cancelled"}`);
            }), t(d, "label", "Snackbar"), t(d, "onClick", () => {
              ci("Hello from a snackbar \uD83D\uDC4B"), ze("snackbar: shown");
            }), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 12), t(o, "color", W), q((u) => t(o, "label", Pr(), u)), o;
          })()];
        } }), O), B(w, L(Y, { title: "Pickers \u2014 date \xB7 time", get children() {
          return [(() => {
            var o = s("row"), u = s("button"), d = s("button");
            return _(o, u), _(o, d), t(o, "gap", 8), t(u, "label", "Pick a date"), t(u, "onClick", async () => {
              Nt(`date \u2192 ${await Uo({ initialDate: "2026-05-17" }) ?? "dismissed"}`);
            }), t(d, "label", "Pick a time"), t(d, "onClick", async () => {
              Nt(`time \u2192 ${await Go({ initialHour: 9, initialMinute: 30 }) ?? "dismissed"}`);
            }), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 12), t(o, "color", W), q((u) => t(o, "label", vt(), u)), o;
          })()];
        } }), O), B(w, L(Y, { title: "Navigation \u2014 push / pop with keep-alive", get children() {
          return [(() => {
            var o = s("text");
            return t(o, "label", "Tap a mailbox to push a screen; the AppBar back button (or system back) pops. Native transition; the screen behind stays mounted."), t(o, "fontSize", 11), t(o, "color", W), o;
          })(), (() => {
            var o = s("box");
            return t(o, "height", 320), t(o, "borderWidth", 1), t(o, "borderColor", Se), B(o, L(Fr.View, {})), o;
          })()];
        } }), O), B(w, L(Y, { title: "Tabs \u2014 bottom bar with keep-alive", get children() {
          return [(() => {
            var o = s("text");
            return t(o, "label", "Every tab subtree is built once and kept alive (IndexedStack) \u2014 switching never re-mounts; scroll & state survive."), t(o, "fontSize", 11), t(o, "color", W), o;
          })(), (() => {
            var o = s("box"), u = s("tabs"), d = s("tab"), b = s("column"), $ = s("text"), H = s("text"), G = s("tab"), J = s("column"), X = s("text"), te = s("textInput"), re = s("tab"), pe = s("column"), Re = s("text"), mt = s("text");
            return _(o, u), t(o, "height", 280), t(o, "borderWidth", 1), t(o, "borderColor", Se), t(o, "cornerRadius", 8), _(u, d), _(u, G), _(u, re), t(u, "onChange", ir), t(u, "height", "fill"), _(d, b), t(d, "title", "Home"), t(d, "icon", "home"), _(b, $), _(b, H), t(b, "background", ke), t(b, "padding", 16), t(b, "gap", 8), t(b, "height", "fill"), t($, "label", "Home"), t($, "fontSize", 20), t($, "fontWeight", 800), t($, "color", Q), t(H, "label", "Switch tabs and come back \u2014 this tab was never torn down."), t(H, "fontSize", 13), t(H, "color", W), _(G, J), t(G, "title", "Search"), t(G, "icon", "search"), _(J, X), _(J, te), t(J, "background", ke), t(J, "padding", 16), t(J, "gap", 8), t(J, "height", "fill"), t(X, "label", "Search"), t(X, "fontSize", 20), t(X, "fontWeight", 800), t(X, "color", Q), t(te, "placeholder", "Type to search\u2026"), _(re, pe), t(re, "title", "Profile"), t(re, "icon", "person"), _(pe, Re), _(pe, mt), t(pe, "background", ke), t(pe, "padding", 16), t(pe, "gap", 8), t(pe, "height", "fill"), t(Re, "label", "Profile"), t(Re, "fontSize", 20), t(Re, "fontWeight", 800), t(Re, "color", Q), t(mt, "fontSize", 13), t(mt, "color", W), q((wt) => {
              var qi = nr(), Xi = `active tab index: ${nr()}`;
              return qi !== wt.e && (wt.e = t(u, "activeTab", qi, wt.e)), Xi !== wt.t && (wt.t = t(mt, "label", Xi, wt.t)), wt;
            }, { e: undefined, t: undefined }), o;
          })()];
        } }), O), B(w, L(Y, { title: "SafeArea", get children() {
          var o = s("safeArea"), u = s("box"), d = s("text");
          return _(o, u), _(u, d), t(u, "background", me), t(u, "cornerRadius", 8), t(u, "padding", 14), t(d, "label", "Insets past notches & system bars. (No visible effect here \u2014 the app root already applies one.)"), t(d, "fontSize", 12), t(d, "color", Q), o;
        } }), O), t(O, "label", "\u2014 end of UI demo \u2014"), t(O, "fontSize", 12), t(O, "color", W), w;
      })();
    }
    return L(kn.View, {});
  }
  var Bi = ["Just shipped a new feature, feeling great about how it turned out \uD83D\uDE80", "Hot take: the best APIs are the ones you don't have to read docs for", "Spent the morning refactoring legacy code \u2014 so much cleaner now", "There's no such thing as 'just a small change' in production code", "If your tests are slow, that's a smell. Fast tests = good tests", "Bun's startup time keeps surprising me, even after a year", "Why is naming things still the hardest part of programming?", "Found a 10\xD7 speedup in a critical path today. Profilers, not guesses", "Reading 'The Art of Unix Programming' for the third time", "Premature abstraction is somehow worse than premature optimization", "Latency is a feature, throughput is an artifact of how you measure", "Half of debugging is admitting your assumption was wrong", "You don't ship the codebase you have. You ship the codebase you understand", "Cache invalidation, naming things, off-by-one. The classics", "Every config file format eventually grows a turing-complete templating layer"], $s = Array.from({ length: 15000 }, (e, r) => ({ author: `@user${r * 2654435761 >>> 17}`, body: Bi[r % Bi.length], num: r + 1 })), Rs = [50, 200, 500, 1000, 2000, 5000, 1e4], Vi = "#FFF1F5F9", Wi = "#FF475569", Ps = "#FF22C55E", As = "#FFEF4444", Hi = "#FFFFFFFF";
  function Fs(e) {
    const [r, n] = K(0), [i, a] = K(false), [l, c] = K(0), [p, h] = K(false);
    return (() => {
      var v = s("column"), E = s("text"), y = s("text"), A = s("row"), g = s("button"), z = s("button");
      return _(v, E), _(v, y), _(v, A), t(v, "background", Te), t(v, "padding", 12), t(v, "cornerRadius", 10), t(v, "borderWidth", 1), t(v, "borderColor", Se), t(v, "gap", 6), t(E, "fontWeight", 700), t(E, "fontSize", 14), t(E, "color", "#FF1DA1F2"), t(y, "fontSize", 14), t(y, "color", "#FF1F2937"), t(y, "maxLines", 3), t(y, "textOverflow", 1), _(A, g), _(A, z), t(A, "gap", 10), t(g, "fontSize", 12), t(g, "padding", 6), t(g, "cornerRadius", 16), t(g, "onClick", () => {
        const T = !i();
        a(T), n(r() + (T ? 1 : -1));
      }), t(z, "fontSize", 12), t(z, "padding", 6), t(z, "cornerRadius", 16), t(z, "onClick", () => {
        const T = !p();
        h(T), c(l() + (T ? 1 : -1));
      }), q((T) => {
        var F = `#${e.num} \xB7 ${e.author}`, N = e.body, x = `\u2665 ${r()}`, P = i() ? Ps : Vi, f = i() ? Hi : Wi, S = `\u21A9 ${l()}`, k = p() ? As : Vi, D = p() ? Hi : Wi;
        return F !== T.e && (T.e = t(E, "label", F, T.e)), N !== T.t && (T.t = t(y, "label", N, T.t)), x !== T.a && (T.a = t(g, "label", x, T.a)), P !== T.o && (T.o = t(g, "background", P, T.o)), f !== T.i && (T.i = t(g, "color", f, T.i)), S !== T.n && (T.n = t(z, "label", S, T.n)), k !== T.s && (T.s = t(z, "background", k, T.s)), D !== T.h && (T.h = t(z, "color", D, T.h)), T;
      }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined, n: undefined, s: undefined, h: undefined }), v;
    })();
  }
  function Os() {
    const [e, r] = K(50), [n, i] = K(""), a = Vt(() => $s.slice(0, e()));
    return (() => {
      var l = s("listView"), c = s("text"), p = s("text"), h = s("wrap"), v = s("text");
      return _(l, c), _(l, p), _(l, h), _(l, v), t(l, "background", ke), t(l, "padding", 16), t(l, "gap", 12), t(c, "label", "Tweet feed \u2014 virtualized"), t(c, "fontSize", 24), t(c, "fontWeight", 800), t(c, "color", Q), t(p, "label", "ListView.builder materializes only the visible window; the source pool is 15 000 items. Tap a count to mount N."), t(p, "fontSize", 13), t(p, "color", W), t(h, "gap", 6), B(h, L(ce, { each: Rs, children: (E) => (() => {
        var y = s("button");
        return t(y, "label", `${E}`), t(y, "onClick", () => {
          const A = performance.now();
          try {
            r(E), i(`mounted ${E} in ${(performance.now() - A).toFixed(2)} ms`);
          } catch (g) {
            i(`ERROR @ ${E}: ${g && (g.message || String(g)) || "unknown"}`);
          }
        }), y;
      })() })), t(v, "fontSize", 12), t(v, "color", W), B(l, L(ce, { get each() {
        return a();
      }, children: (E) => L(Fs, { get author() {
        return E.author;
      }, get body() {
        return E.body;
      }, get num() {
        return E.num;
      } }) }), null), q((E) => t(v, "label", n() || `showing ${e()} tweets`, E)), l;
    })();
  }
  function Cs() {
    const [e, r] = K("\u2014 waiting for counter events \u2014"), n = ja(), [i, a] = K("\u2014 tap a button to RPC the Ticker \u2014"), [l, c] = K(null), [p, h] = K(false);
    return (() => {
      var v = s("scrollView"), E = s("text"), y = s("text"), A = s("text");
      return _(v, E), _(v, y), _(v, A), t(v, "background", ke), t(v, "padding", 16), t(v, "gap", 14), t(E, "label", "Libraries \u2014 codegen-wrapped widgets"), t(E, "fontSize", 24), t(E, "fontWeight", 800), t(E, "color", Q), t(y, "label", "Custom adapters + real pub.dev packages, brought into JSX by skal_codegen. Imported from 'skal-flutter'."), t(y, "fontSize", 13), t(y, "color", W), B(v, Mi && L(Y, { title: "FlutterEmbed \u2014 Shape C, real Flutter rendering", get children() {
        return [(() => {
          var g = s("text");
          return t(g, "label", "A multi-view Flutter Web view rendered inside a DOM region (lazy-loaded ~3 MB on first appearance). Click the button \u2014 the counter state lives in Dart, the +1 increment is a Flutter setState, not JS."), t(g, "fontSize", 11), t(g, "color", "#FF8E8E93"), g;
        })(), (() => {
          var g = s("flutterEmbed");
          return t(g, "widget", "counter"), t(g, "props", { initial: 0 }), t(g, "height", 120), t(g, "background", "#FFF7F7F8"), t(g, "cornerRadius", 8), g;
        })(), (() => {
          var g = s("flutterEmbed");
          return t(g, "widget", "greeting"), t(g, "props", { name: "Skal" }), t(g, "height", 60), t(g, "background", "#FFF7F7F8"), t(g, "cornerRadius", 8), g;
        })()];
      } }), A), B(v, L(Y, { title: "HtmlEmbed \u2014 Flutter with DOM holes", get children() {
        return [(() => {
          var g = s("text");
          return t(g, "label", "Each panel below is a real <div> hosted inside Flutter Web's render tree via HtmlElementView. Pointer events + text selection + keyboard input stay live. On native, falls back to a sized placeholder."), t(g, "fontSize", 11), t(g, "color", W), g;
        })(), (() => {
          var g = s("htmlEmbed");
          return t(g, "viewType", "html-card"), t(g, "height", 150), t(g, "background", "#FFFFFFFF"), t(g, "cornerRadius", 10), g;
        })(), (() => {
          var g = s("htmlEmbed");
          return t(g, "viewType", "solid-counter"), t(g, "height", 140), t(g, "background", "#FFF8FAFC"), t(g, "cornerRadius", 10), g;
        })(), (() => {
          var g = s("htmlEmbed");
          return t(g, "viewType", "skal-counter"), t(g, "height", 200), t(g, "background", "#FFF8FAFC"), t(g, "cornerRadius", 10), g;
        })(), (() => {
          var g = s("htmlEmbed");
          return t(g, "viewType", "skal-jsx-counter"), t(g, "height", 200), t(g, "background", "#FFF8FAFC"), t(g, "cornerRadius", 10), g;
        })(), (() => {
          var g = s("htmlEmbed");
          return t(g, "viewType", "youtube-embed"), t(g, "height", 220), t(g, "background", "#FF000000"), t(g, "cornerRadius", 8), g;
        })()];
      } }), A), B(v, L(Y, { title: "Greeting \u2014 hand-written adapter", get children() {
        var g = s("greeting");
        return t(g, "name", "Skal"), t(g, "color", "#FF1DA1F2"), t(g, "fontSize", 20), g;
      } }), A), B(v, L(Y, { title: "Shimmer \u2014 pub.dev, named-ctor wrap", get children() {
        return [(() => {
          var g = s("text");
          return t(g, "label", "ShimmerFromColors \u2014 codegen-synthesized from the Shimmer.fromColors named constructor."), t(g, "fontSize", 11), t(g, "color", W), g;
        })(), (() => {
          var g = s("shimmerFromColors"), z = s("greeting");
          return _(g, z), t(g, "baseColor", 4290624957), t(g, "highlightColor", 4292927712), t(g, "period", 1500), t(z, "name", "loading\u2026"), t(z, "color", "#FF333333"), t(z, "fontSize", 28), g;
        })()];
      } }), A), B(v, L(Y, { title: "QR code \u2014 qr_flutter, pub.dev wrap", get children() {
        return [(() => {
          var g = s("qrImageView");
          return t(g, "data", "https://skal.dev"), t(g, "size", 200), g;
        })(), (() => {
          var g = s("text");
          return t(g, "label", "QrImageView, generated against qr_flutter's class."), t(g, "fontSize", 11), t(g, "color", W), g;
        })()];
      } }), A), B(v, L(Y, { title: "Camera \u2014 host-pattern wrap (controller lifecycle)", get children() {
        return [(() => {
          var g = s("text");
          return t(g, "label", "A synthesized _CameraHost owns the CameraController (init in initState, dispose on unmount). The controller initializes only once Start mounts <Camera> \u2014 no camera / permission \u2192 an inline error banner."), t(g, "fontSize", 11), t(g, "color", W), g;
        })(), (() => {
          var g = s("button");
          return t(g, "onClick", () => h(!p())), q((z) => t(g, "label", p() ? "Stop camera" : "Start camera", z)), g;
        })(), nn(() => nn(() => !!p())() && (() => {
          var g = s("box"), z = s("camera");
          return _(g, z), t(g, "background", "#FF000000"), t(g, "padding", 4), t(g, "cornerRadius", 8), t(z, "resolutionIndex", 1), g;
        })())];
      } }), A), B(v, L(Y, { title: "Counter \u2014 typed callbacks back to JSX", get children() {
        return [(() => {
          var g = s("counter");
          return t(g, "initial", 0), t(g, "onChanged", (z) => r(`onChanged(${z})`)), t(g, "onReset", () => r("onReset()")), g;
        })(), (() => {
          var g = s("text");
          return t(g, "fontSize", 13), t(g, "color", Q), q((z) => t(g, "label", e(), z)), g;
        })()];
      } }), A), B(v, L(Y, { title: "Ticker \u2014 JS \u2192 Dart imperative RPC", get children() {
        return [(() => {
          var g = s("ticker");
          return ga(n, g), t(g, "intervalMs", 500), g;
        })(), (() => {
          var g = s("wrap"), z = s("button"), T = s("button"), F = s("button"), N = s("button"), x = s("button"), P = s("button"), f = s("button"), S = s("button");
          return _(g, z), _(g, T), _(g, F), _(g, N), _(g, x), _(g, P), _(g, f), _(g, S), t(g, "gap", 6), t(z, "label", "pause"), t(z, "onClick", async () => {
            await n.pause(), a("pause() \u2713");
          }), t(T, "label", "resume"), t(T, "onClick", async () => {
            await n.resume(), a("resume() \u2713");
          }), t(F, "label", "reset"), t(F, "onClick", async () => {
            await n.reset(), a("reset() \u2713");
          }), t(N, "label", "+10"), t(N, "onClick", async () => {
            await n.bump(10), a(`bump(10), now getValue() \u2192 ${await n.getValue()}`);
          }), t(x, "label", "read"), t(x, "onClick", async () => {
            a(`getValue() \u2192 ${await n.getValue()}, isPaused() \u2192 ${await n.isPaused()}`);
          }), t(P, "label", "describe"), t(P, "onClick", async () => {
            a(`describe() \u2192 ${await n.describe("hello from JSX")}`);
          }), t(f, "label", "snapshot"), t(f, "onClick", async () => {
            const k = await n.snapshot();
            a(`snapshot() \u2192 value=${k.value} paused=${k.paused} ts=${k.timestamp}`);
          }), t(S, "label", "sub/unsub"), t(S, "onClick", () => {
            if (l())
              l()(), c(() => null), a("unsubscribed from ticks$");
            else {
              const k = n.ticks$((D) => {
                a(`stream tick: ${D}`);
              });
              c(() => k), a("subscribed to ticks$ \u2014 wait for emissions\u2026");
            }
          }), g;
        })(), (() => {
          var g = s("text");
          return t(g, "fontSize", 13), t(g, "color", Q), q((z) => t(g, "label", i(), z)), g;
        })()];
      } }), A), B(v, L(Y, { title: "Stickers \u2014 List<Widget> children + gradient prop", get children() {
        var g = s("stickers"), z = s("greeting"), T = s("greeting"), F = s("greeting");
        return _(g, z), _(g, T), _(g, F), t(g, "gap", 6), t(g, "padding", 10), t(g, "gradient", { type: "linear", colors: ["#FFFFE082", "#FFB0F0D0", "#FFB0E0FF"], stops: [0, 0.5, 1], begin: "topLeft", end: "bottomRight" }), t(z, "name", "multi-child A"), t(z, "color", "#FF6B4F00"), t(z, "fontSize", 14), t(T, "name", "multi-child B"), t(T, "color", "#FF6B4F00"), t(T, "fontSize", 14), t(F, "name", "multi-child C"), t(F, "color", "#FF6B4F00"), t(F, "fontSize", 14), g;
      } }), A), t(A, "label", "\u2014 end of Libs demo \u2014"), t(A, "fontSize", 12), t(A, "color", W), v;
    })();
  }
  var Ui = (e) => Array.from(e, (r) => r.toString(16).padStart(2, "0")).join(""), Is = new Function("m", "return import(m);"), tt = (e) => Is(e), Ie = (e, r) => e && e[r] || e && e.default && e.default[r] || undefined, Gi = [...Mi ? [{ title: "Web plugin bridge \u2014 geolocator (B.5, web only)", probes: [{ label: "geolocator.getCurrentPosition \u2014 lat/lon via hidden Flutter Web", run: async () => {
    const e = performance.now(), r = await ws(), n = (performance.now() - e).toFixed(0);
    return `${r.lat.toFixed(4)}, ${r.lon.toFixed(4)} (\xB1${r.accuracy.toFixed(0)}m, ${n}ms \u2014 includes Flutter Web cold boot on first call)`;
  } }] }] : [], { title: "Web Crypto \u2014 crypto.subtle (global, native)", probes: [{ label: "crypto.randomUUID()", run: () => crypto.randomUUID() }, { label: "crypto.getRandomValues \u2014 16 bytes", run: () => {
    const e = new Uint8Array(16);
    return crypto.getRandomValues(e), Ui(e);
  } }, { label: "crypto.subtle.digest \u2014 SHA-256 of 64 KB", run: async () => {
    const e = new Uint8Array(65536);
    crypto.getRandomValues(e);
    const r = await crypto.subtle.digest("SHA-256", e);
    return Ui(new Uint8Array(r)).slice(0, 32) + "\u2026";
  } }, { label: "crypto.subtle \u2014 AES-GCM encrypt + decrypt", run: async () => {
    const e = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]), r = crypto.getRandomValues(new Uint8Array(12)), n = new TextEncoder().encode("hello from skal"), i = await crypto.subtle.encrypt({ name: "AES-GCM", iv: r }, e, n), a = await crypto.subtle.decrypt({ name: "AES-GCM", iv: r }, e, i);
    return `${i.byteLength}-byte ct \u2192 "${new TextDecoder().decode(a)}"`;
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
    const e = new Bun.CryptoHasher("sha256");
    return e.update("hello from skal"), e.digest("hex").slice(0, 32) + "\u2026";
  } }, { label: "bun:sqlite \u2014 in-memory query", run: async () => {
    const e = await tt("bun:sqlite"), r = Ie(e, "Database") || e.default;
    if (typeof r != "function")
      throw new Error("bun:sqlite imported, but no Database constructor");
    const n = new r(":memory:");
    n.run("CREATE TABLE t (id INTEGER, name TEXT)"), n.run("INSERT INTO t VALUES (1, 'skal')");
    const i = n.query("SELECT name FROM t WHERE id = ?").get(1);
    return n.close(), `select \u2192 ${JSON.stringify(i)}`;
  } }] }, { title: "Node compatibility \u2014 node: builtins", probes: [{ label: "process \u2014 platform / arch / version", run: () => {
    if (typeof process > "u")
      throw new Error("process global not present");
    return `${process.platform} ${process.arch} \xB7 ${process.version || "(no version)"}`;
  } }, { label: "node:crypto \u2014 createHash('sha256')", run: async () => {
    const e = Ie(await tt("node:crypto"), "createHash");
    if (!e)
      throw new Error("node:crypto has no createHash");
    return e("sha256").update("hello from skal").digest("hex").slice(0, 32) + "\u2026";
  } }, { label: "node:crypto \u2014 randomBytes(16)", run: async () => {
    const e = Ie(await tt("node:crypto"), "randomBytes");
    if (!e)
      throw new Error("node:crypto has no randomBytes");
    return e(16).toString("hex");
  } }, { label: "node:os \u2014 platform / arch / cpus", run: async () => {
    const e = await tt("node:os"), r = Ie(e, "platform"), n = Ie(e, "arch"), i = Ie(e, "cpus");
    if (!r)
      throw new Error("node:os has no platform()");
    return `${r()} ${n()} \xB7 ${i().length} cpus`;
  } }, { label: "node:path \u2014 join + normalize", run: async () => {
    const e = Ie(await tt("node:path"), "join");
    if (!e)
      throw new Error("node:path has no join");
    return e("/a/b", "..", "c", "./d.txt");
  } }, { label: "Buffer \u2014 from / toString", run: () => {
    if (typeof Buffer > "u")
      throw new Error("Buffer global not present");
    return `hex = ${Buffer.from("skal", "utf8").toString("hex")}`;
  } }, { label: "node:fs \u2014 temp write + read", run: async () => {
    const e = await tt("node:fs"), r = await tt("node:os"), n = await tt("node:path"), i = Ie(e, "writeFileSync"), a = Ie(e, "readFileSync"), l = Ie(e, "unlinkSync"), c = Ie(r, "tmpdir"), p = Ie(n, "join");
    if (!i || !a || !c || !p)
      throw new Error("node:fs / os / path missing an expected member");
    const h = p(c(), `skal-probe-${Date.now()}.txt`);
    i(h, "skal fs probe");
    const v = a(h, "utf8");
    try {
      l && l(h);
    } catch {}
    return `wrote + read back "${v}"`;
  } }] }, { title: "Standard JS & Web APIs", probes: [{ label: "JSON stringify + parse \u2014 1000-object array", run: () => {
    const e = Array.from({ length: 1000 }, (i, a) => ({ id: a, name: "item" + a, ok: a % 2 === 0 })), r = JSON.stringify(e), n = JSON.parse(r);
    return `${r.length} bytes \xB7 ${n.length} items round-tripped`;
  } }, { label: "TextEncoder / TextDecoder round-trip", run: () => {
    const e = new TextEncoder().encode("skal \uD83D\uDE80 unicode \u2713");
    return `${e.length} bytes \u2192 "${new TextDecoder().decode(e)}"`;
  } }, { label: "structuredClone \u2014 nested object", run: () => {
    if (typeof structuredClone > "u")
      throw new Error("structuredClone not present");
    const e = structuredClone({ a: 1, nested: { b: [1, 2, 3] } });
    return `cloned \u2192 nested.b = ${JSON.stringify(e.nested.b)}`;
  } }, { label: "setTimeout \u2014 20 ms timer (see duration)", run: async () => {
    if (typeof setTimeout > "u")
      throw new Error("setTimeout not present");
    return await new Promise((e) => setTimeout(e, 20)), "timer fired \u2014 measured duration \u2248 requested 20 ms";
  } }, { label: "tight compute loop \u2014 5,000,000 iterations", run: () => {
    let e = 0;
    for (let r = 0;r < 5000000; r++)
      e += r % 7;
    return `sum = ${e}`;
  } }] }], ji = 3000;
  function zs(e) {
    let r;
    const n = new Promise((i, a) => {
      r = setTimeout(() => a(new Error(`timed out after ${ji} ms`)), ji);
    });
    return Promise.race([Promise.resolve().then(() => e.run()), n]).finally(() => clearTimeout(r));
  }
  function Ds() {
    const [e, r] = K({}), [n, i] = K(false), a = () => typeof performance < "u" && performance.now ? performance.now() : Date.now();
    async function l() {
      if (!n()) {
        i(true), r({});
        for (const c of Gi)
          for (const p of c.probes) {
            const h = a();
            let v, E = true;
            try {
              v = String(await zs(p));
            } catch (A) {
              v = A && A.message ? A.message : String(A), E = false;
            }
            const y = a() - h;
            r((A) => ({ ...A, [p.label]: { ms: y, response: v, ok: E } }));
          }
        i(false);
      }
    }
    return An(() => {
      l();
    }), (() => {
      var c = s("scrollView"), p = s("text"), h = s("text"), v = s("button");
      return _(c, p), _(c, h), _(c, v), t(c, "background", ke), t(c, "padding", 16), t(c, "gap", 14), t(c, "scrollbar", true), t(p, "label", "JS runtime \u2014 probes & timings"), t(p, "fontSize", 24), t(p, "fontWeight", 800), t(p, "color", Q), t(h, "label", "Each function runs in the embedded bun + JSC runtime; its duration and response are logged. Bun / bun:sqlite probes report an error (not a crash) if the runtime doesn't expose them."), t(h, "fontSize", 13), t(h, "color", W), t(v, "onClick", l), B(c, L(ce, { each: Gi, children: (E) => L(Y, { get title() {
        return E.title;
      }, get children() {
        return L(ce, { get each() {
          return E.probes;
        }, children: (y) => {
          const A = () => e()[y.label], g = () => {
            const z = A();
            return z ? z.response.length > 110 ? z.response.slice(0, 110) + "\u2026" : z.response : "not run yet";
          };
          return (() => {
            var z = s("column"), T = s("text"), F = s("text"), N = s("text");
            return _(z, T), _(z, F), _(z, N), t(z, "gap", 2), t(T, "fontSize", 13), t(T, "fontWeight", 700), t(T, "color", Q), t(F, "fontSize", 11), t(F, "fontWeight", 700), t(F, "color", se), t(N, "fontSize", 12), t(N, "maxLines", 3), q((x) => {
              var P = y.label, f = A() ? `${A().ms.toFixed(3)} ms` : "\u2014", S = g(), k = A() ? A().ok ? W : gt : W;
              return P !== x.e && (x.e = t(T, "label", P, x.e)), f !== x.t && (x.t = t(F, "label", f, x.t)), S !== x.a && (x.a = t(N, "label", S, x.a)), k !== x.o && (x.o = t(N, "color", k, x.o)), x;
            }, { e: undefined, t: undefined, a: undefined, o: undefined }), z;
          })();
        } });
      } }) }), null), q((E) => t(v, "label", n() ? "Running\u2026" : "Re-run all probes", E)), c;
    })();
  }
  var ue = vs({ counter: 0, note: "", scratch: "", settings: { theme: "dark" }, todos: [], archive: [] }, { version: 1, paths: { scratch: { persist: false }, archive: { lazy: true } } });
  function Ns() {
    const e = ue[_n], r = () => e.backendKind() === "native" || e.backendKind() === "mmap" || e.backendKind() === "fs", n = () => {
      const a = e.engineStats();
      return `${a ? `${a.records} records \xB7 ${a.segments} segments` : "engine: \u2026"} \xB7 ${e.pending()} pending \xB7 ${e.flushes()} flushes`;
    }, i = () => {
      const a = e.initTiming();
      return a ? `init total ${a.total}ms \u2014 dir-RPC ${a.dir} \xB7 open ${a.open} \xB7 migrate ${a.migrate} \xB7 hydrate ${a.hydrate} (${a.records} records)` : "init: running\u2026";
    };
    return (() => {
      var a = s("scrollView"), l = s("text"), c = s("text"), p = s("text");
      return _(a, l), _(a, c), _(a, p), t(a, "background", ke), t(a, "padding", 16), t(a, "gap", 14), t(a, "scrollbar", true), t(l, "label", "createSkalStore \u2014 reactive \xB7 persistent \xB7 deep-object"), t(l, "testID", "store-title"), t(l, "fontSize", 23), t(l, "fontWeight", 800), t(l, "color", Q), t(c, "fontSize", 14), t(c, "fontWeight", 800), t(p, "fontSize", 12), t(p, "color", W), B(a, L(Y, { title: "Values \u2014 mutate the object directly", get children() {
        return [(() => {
          var h = s("row"), v = s("button"), E = s("text");
          return _(h, v), _(h, E), t(h, "gap", 10), t(v, "label", "counter + 1"), t(v, "onClick", () => {
            ue.counter = ue.counter + 1;
          }), t(E, "fontSize", 16), t(E, "fontWeight", 800), t(E, "color", se), q((y) => t(E, "label", `db.counter = ${ue.counter}`, y)), h;
        })(), (() => {
          var h = s("row"), v = s("button"), E = s("text");
          return _(h, v), _(h, E), t(h, "gap", 10), t(v, "label", "toggle theme"), t(v, "onClick", () => {
            ue.settings.theme = ue.settings.theme === "dark" ? "light" : "dark";
          }), t(E, "fontSize", 14), t(E, "fontWeight", 700), t(E, "color", Q), q((y) => t(E, "label", `db.settings.theme = ${ue.settings.theme}`, y)), h;
        })(), (() => {
          var h = s("text");
          return t(h, "label", "note \u2014 persisted; each change writes one tiny per-leaf frame"), t(h, "fontSize", 11), t(h, "color", W), h;
        })(), (() => {
          var h = s("textInput");
          return t(h, "placeholder", "persisted text\u2026"), t(h, "onChange", (v) => {
            ue.note = v;
          }), q((v) => t(h, "value", ue.note, v)), h;
        })(), (() => {
          var h = s("text");
          return t(h, "label", "scratch \u2014 config persist:false, so memory only (gone on restart)"), t(h, "fontSize", 11), t(h, "color", W), h;
        })(), (() => {
          var h = s("textInput");
          return t(h, "placeholder", "memory-only text\u2026"), t(h, "onChange", (v) => {
            ue.scratch = v;
          }), q((v) => t(h, "value", ue.scratch, v)), h;
        })()];
      } }), null), B(a, L(Y, { title: "Collection \u2014 todos (array of objects)", get children() {
        return [(() => {
          var h = s("row"), v = s("button"), E = s("button"), y = s("button"), A = s("button");
          return _(h, v), _(h, E), _(h, y), _(h, A), t(h, "gap", 8), t(v, "label", "Add"), t(v, "onClick", () => ue.todos.push({ text: "todo " + Date.now() })), t(E, "label", "Add 100"), t(E, "onClick", () => Pn(() => {
            for (let g = 0;g < 100; g++)
              ue.todos.push({ text: "bulk " + Date.now() + " #" + g });
          })), t(y, "label", "Remove first"), t(y, "onClick", () => {
            ue.todos.length && ue.todos.shift();
          }), t(A, "label", "Clear"), t(A, "onClick", () => {
            ue.todos.splice(0, ue.todos.length);
          }), h;
        })(), (() => {
          var h = s("text");
          return t(h, "fontSize", 12), t(h, "fontWeight", 700), t(h, "color", se), q((v) => t(h, "label", `${ue.todos.length} todos \u2014 add/remove writes one element frame + the index, never the whole list`, v)), h;
        })(), (() => {
          var h = s("box"), v = s("listView");
          return _(h, v), t(h, "height", 220), t(h, "cornerRadius", 10), t(h, "background", me), t(v, "scrollbar", true), B(v, L(ce, { get each() {
            return ue.todos;
          }, children: (E) => (() => {
            var y = s("box"), A = s("text");
            return _(y, A), t(y, "padding", 8), t(y, "background", Te), t(y, "cornerRadius", 6), t(y, "borderWidth", 1), t(y, "borderColor", Se), t(A, "fontSize", 12), t(A, "color", Q), q((g) => t(A, "label", E.text, g)), y;
          })() })), h;
        })()];
      } }), null), B(a, L(Y, { title: "Lazy \u2014 archive (config lazy:true)", get children() {
        return [(() => {
          var h = s("row"), v = s("button");
          return _(h, v), t(h, "gap", 8), t(v, "label", "Add to archive"), t(v, "onClick", () => ue.archive.push({ text: "archived " + Date.now() })), h;
        })(), (() => {
          var h = s("text");
          return t(h, "fontSize", 12), t(h, "color", W), q((v) => t(h, "label", `${ue.archive.length} records \u2014 not loaded at open; faults in from disk on first access`, v)), h;
        })()];
      } }), null), B(a, L(Y, { title: "Engine", get children() {
        return [(() => {
          var h = s("text");
          return t(h, "fontSize", 11), t(h, "color", W), t(h, "maxLines", 2), q((v) => t(h, "label", n(), v)), h;
        })(), (() => {
          var h = s("text");
          return t(h, "fontSize", 11), t(h, "color", W), t(h, "maxLines", 2), q((v) => t(h, "label", i(), v)), h;
        })(), (() => {
          var h = s("button");
          return t(h, "label", "Flush now"), t(h, "onClick", () => e.flushNow()), h;
        })(), (() => {
          var h = s("text");
          return t(h, "label", "Writes are debounced + batched into one engine flush; reads are pure in-memory."), t(h, "fontSize", 11), t(h, "color", W), h;
        })()];
      } }), null), q((h) => {
        var v = `Backend: ${e.backendKind()} \xB7 schema v${e.version()}`, E = r() ? ye : Ce, y = r() ? "Persisted \u2014 change values, quit, and re-run to verify they survive a restart." : "In-memory fallback \u2014 no writable backend, so data resets on restart.";
        return v !== h.e && (h.e = t(c, "label", v, h.e)), E !== h.t && (h.t = t(c, "color", E, h.t)), y !== h.a && (h.a = t(p, "label", y, h.a)), h;
      }, { e: undefined, t: undefined, a: undefined }), a;
    })();
  }
  function Ls() {
    const [e, r] = Ka(0, "appTab");
    return (() => {
      var n = s("tabs"), i = s("tab"), a = s("tab"), l = s("tab"), c = s("tab"), p = s("tab");
      return _(n, i), _(n, a), _(n, l), _(n, c), _(n, p), t(n, "onChange", r), t(n, "height", "fill"), t(i, "title", "UI"), t(i, "icon", "grid"), B(i, L(Es, {})), t(a, "title", "List"), t(a, "icon", "list"), B(a, L(Os, {})), t(l, "title", "Libs"), t(l, "icon", "explore"), B(l, L(Cs, {})), t(c, "title", "JS"), t(c, "icon", "code"), B(c, L(Ds, {})), t(p, "title", "Store"), t(p, "icon", "storage"), B(p, L(Ns, {})), q((h) => t(n, "activeTab", e(), h)), n;
    })();
  }
  var Ms = ".".repeat(1500);
  function Bs(e) {
    const r = e.count || 1500, n = Array.from({ length: r }, (a, l) => l), i = Math.max(1, Math.round(r * 1.5 / 768));
    return An(() => {
      console.log(`[skal-stress] mounted ${r} rows (~1.5 KB each); overflow resets = ${globalThis.__skal_opRingResets | 0}`);
    }), (() => {
      var a = s("scrollView"), l = s("text");
      return _(a, l), t(a, "background", ke), t(a, "padding", 16), t(a, "gap", 6), t(a, "scrollbar", true), t(l, "label", `Skal overflow stress \u2014 ${r} rows \xD7 ~1.5 KB \u2192 overflows the 768 KiB string heap ~${i}\xD7 in one mount`), t(l, "fontSize", 15), t(l, "fontWeight", 800), t(l, "color", Q), B(a, L(ce, { each: n, children: (c) => (() => {
        var p = s("box"), h = s("text");
        return _(p, h), t(p, "background", Te), t(p, "cornerRadius", 6), t(p, "padding", 8), t(h, "label", `Row ${c}: ${Ms}`), t(h, "fontSize", 12), t(h, "maxLines", 1), t(h, "textOverflow", 1), t(h, "color", Ss), p;
      })() }), null), a;
    })();
  }
  var mn = 0;
  if (typeof location < "u" && location.search) {
    const e = new URLSearchParams(location.search).get("stress");
    e && (mn = Math.min(20000, Math.max(0, parseInt(e, 10) || 0)));
  }
  if (mn > 0)
    rn(() => L(Bs, { count: mn }), on);
  else {
    const e = () => L(Ls, {});
    globalThis.__skalHot ? globalThis.__skalHot.mount(e) : rn(e, on);
  }
})();
})
