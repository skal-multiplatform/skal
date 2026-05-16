// @bun @bytecode @bun-cjs
(function(exports, require, module, __filename, __dirname) {// ../flutter/skal_flutter/assets/skal-app.js
(function() {
  var q = { context: undefined, registry: undefined, effects: undefined, done: false, getContextId() {
    return Wt(this.context.count);
  }, getNextContextId() {
    return Wt(this.context.count++);
  } };
  function Wt(t) {
    const r = String(t), n = r.length - 1;
    return q.context.id + (n ? String.fromCharCode(96 + n) : "") + r;
  }
  function dt(t) {
    q.context = t;
  }
  function kr() {
    return { ...q.context, id: q.getNextContextId(), count: 0 };
  }
  var Ir = (t, r) => t === r, gt = Symbol("solid-proxy"), Nr = typeof Proxy == "function", Dr = Symbol("solid-track"), Je = { equals: Ir }, Bt = null, Ht = jt, oe = 1, Ne = 2, Gt = { owned: null, cleanups: null, context: null, owner: null }, H = null, O = null, De = null, Pe = null, X = null, j = null, Q = null, je = 0;
  function qe(t, r) {
    const n = X, l = H, s = t.length === 0, f = r === undefined ? l : r, S = s ? Gt : { owned: null, cleanups: null, context: f ? f.context : null, owner: f }, E = s ? t : () => t(() => Te(() => Fe(S)));
    H = S, X = null;
    try {
      return fe(E, true);
    } finally {
      X = n, H = l;
    }
  }
  function V(t, r) {
    r = r ? Object.assign({}, Je, r) : Je;
    const n = { value: t, observers: null, observerSlots: null, comparator: r.equals || undefined }, l = (s) => (typeof s == "function" && (O && O.running && O.sources.has(n) ? s = s(n.tValue) : s = s(n.value)), Yt(n, s));
    return [Xt.bind(n), l];
  }
  function he(t, r, n) {
    const l = Ft(t, r, false, oe);
    De && O && O.running ? j.push(l) : Le(l);
  }
  function Lr(t, r, n) {
    Ht = Hr;
    const l = Ft(t, r, false, oe), s = ht && Vr(ht);
    s && (l.suspense = s), (!n || !n.render) && (l.user = true), Q ? Q.push(l) : Le(l);
  }
  function Ke(t, r, n) {
    n = n ? Object.assign({}, Je, n) : Je;
    const l = Ft(t, r, true, 0);
    return l.observers = null, l.observerSlots = null, l.comparator = n.equals || undefined, De && O && O.running ? (l.tState = oe, j.push(l)) : Le(l), Xt.bind(l);
  }
  function Te(t) {
    if (!Pe && X === null)
      return t();
    const r = X;
    X = null;
    try {
      return Pe ? Pe.untrack(t) : t();
    } finally {
      X = r;
    }
  }
  function Mt(t) {
    return H === null || (H.cleanups === null ? H.cleanups = [t] : H.cleanups.push(t)), t;
  }
  function zr(t) {
    if (O && O.running)
      return t(), O.done;
    const r = X, n = H;
    return Promise.resolve().then(() => {
      X = r, H = n;
      let l;
      return (De || ht) && (l = O || (O = { sources: new Set, effects: [], promises: new Set, disposed: new Set, queue: new Set, running: true }), l.done || (l.done = new Promise((s) => l.resolve = s)), l.running = true), fe(t, false), X = H = null, l ? l.done : undefined;
    });
  }
  var [Oi, Ut] = V(false);
  function Vr(t) {
    let r;
    return H && H.context && (r = H.context[t.id]) !== undefined ? r : t.defaultValue;
  }
  var ht;
  function Xt() {
    const t = O && O.running;
    if (this.sources && (t ? this.tState : this.state))
      if ((t ? this.tState : this.state) === oe)
        Le(this);
      else {
        const r = j;
        j = null, fe(() => Qe(this), false), j = r;
      }
    if (X) {
      const r = this.observers ? this.observers.length : 0;
      X.sources ? (X.sources.push(this), X.sourceSlots.push(r)) : (X.sources = [this], X.sourceSlots = [r]), this.observers ? (this.observers.push(X), this.observerSlots.push(X.sources.length - 1)) : (this.observers = [X], this.observerSlots = [X.sources.length - 1]);
    }
    return t && O.sources.has(this) ? this.tValue : this.value;
  }
  function Yt(t, r, n) {
    let l = O && O.running && O.sources.has(t) ? t.tValue : t.value;
    if (!t.comparator || !t.comparator(l, r)) {
      if (O) {
        const s = O.running;
        (s || !n && O.sources.has(t)) && (O.sources.add(t), t.tValue = r), s || (t.value = r);
      } else
        t.value = r;
      t.observers && t.observers.length && fe(() => {
        for (let s = 0;s < t.observers.length; s += 1) {
          const f = t.observers[s], S = O && O.running;
          S && O.disposed.has(f) || ((S ? !f.tState : !f.state) && (f.pure ? j.push(f) : Q.push(f), f.observers && qt(f)), S ? f.tState = oe : f.state = oe);
        }
        if (j.length > 1e6)
          throw j = [], new Error;
      }, false);
    }
    return r;
  }
  function Le(t) {
    if (!t.fn)
      return;
    Fe(t);
    const r = je;
    Jt(t, O && O.running && O.sources.has(t) ? t.tValue : t.value, r), O && !O.running && O.sources.has(t) && queueMicrotask(() => {
      fe(() => {
        O && (O.running = true), X = H = t, Jt(t, t.tValue, r), X = H = null;
      }, false);
    });
  }
  function Jt(t, r, n) {
    let l;
    const s = H, f = X;
    X = H = t;
    try {
      l = t.fn(r);
    } catch (S) {
      return t.pure && (O && O.running ? (t.tState = oe, t.tOwned && t.tOwned.forEach(Fe), t.tOwned = undefined) : (t.state = oe, t.owned && t.owned.forEach(Fe), t.owned = null)), t.updatedAt = n + 1, _t(S);
    } finally {
      X = f, H = s;
    }
    (!t.updatedAt || t.updatedAt <= n) && (t.updatedAt != null && ("observers" in t) ? Yt(t, l, true) : O && O.running && t.pure ? (O.sources.has(t) || (t.value = l), O.sources.add(t), t.tValue = l) : t.value = l, t.updatedAt = n);
  }
  function Ft(t, r, n, l = oe, s) {
    const f = { fn: t, state: l, updatedAt: null, owned: null, sources: null, sourceSlots: null, cleanups: null, value: r, owner: H, context: H ? H.context : null, pure: n };
    if (O && O.running && (f.state = 0, f.tState = l), H === null || H !== Gt && (O && O.running && H.pure ? H.tOwned ? H.tOwned.push(f) : H.tOwned = [f] : H.owned ? H.owned.push(f) : H.owned = [f]), Pe && f.fn) {
      const S = f.fn, [E, A] = V(undefined, { equals: false }), x = Pe.factory(S, A);
      Mt(() => x.dispose());
      let T;
      const R = () => zr(A).then(() => {
        T && (T.dispose(), T = undefined);
      });
      f.fn = ($) => (E(), O && O.running ? (T || (T = Pe.factory(S, R)), T.track($)) : x.track($));
    }
    return f;
  }
  function ze(t) {
    const r = O && O.running;
    if ((r ? t.tState : t.state) === 0)
      return;
    if ((r ? t.tState : t.state) === Ne)
      return Qe(t);
    if (t.suspense && Te(t.suspense.inFallback))
      return t.suspense.effects.push(t);
    const n = [t];
    for (;(t = t.owner) && (!t.updatedAt || t.updatedAt < je); ) {
      if (r && O.disposed.has(t))
        return;
      (r ? t.tState : t.state) && n.push(t);
    }
    for (let l = n.length - 1;l >= 0; l--) {
      if (t = n[l], r) {
        let s = t, f = n[l + 1];
        for (;(s = s.owner) && s !== f; )
          if (O.disposed.has(s))
            return;
      }
      if ((r ? t.tState : t.state) === oe)
        Le(t);
      else if ((r ? t.tState : t.state) === Ne) {
        const s = j;
        j = null, fe(() => Qe(t, n[0]), false), j = s;
      }
    }
  }
  function fe(t, r) {
    if (j)
      return t();
    let n = false;
    r || (j = []), Q ? n = true : Q = [], je++;
    try {
      const l = t();
      return Wr(n), l;
    } catch (l) {
      n || (Q = null), j = null, _t(l);
    }
  }
  function Wr(t) {
    if (j && (De && O && O.running ? Br(j) : jt(j), j = null), t)
      return;
    let r;
    if (O) {
      if (!O.promises.size && !O.queue.size) {
        const { sources: l, disposed: s } = O;
        Q.push.apply(Q, O.effects), r = O.resolve;
        for (const f of Q)
          "tState" in f && (f.state = f.tState), delete f.tState;
        O = null, fe(() => {
          for (const f of s)
            Fe(f);
          for (const f of l) {
            if (f.value = f.tValue, f.owned)
              for (let S = 0, E = f.owned.length;S < E; S++)
                Fe(f.owned[S]);
            f.tOwned && (f.owned = f.tOwned), delete f.tValue, delete f.tOwned, f.tState = 0;
          }
          Ut(false);
        }, false);
      } else if (O.running) {
        O.running = false, O.effects.push.apply(O.effects, Q), Q = null, Ut(true);
        return;
      }
    }
    const n = Q;
    Q = null, n.length && fe(() => Ht(n), false), r && r();
  }
  function jt(t) {
    for (let r = 0;r < t.length; r++)
      ze(t[r]);
  }
  function Br(t) {
    for (let r = 0;r < t.length; r++) {
      const n = t[r], l = O.queue;
      l.has(n) || (l.add(n), De(() => {
        l.delete(n), fe(() => {
          O.running = true, ze(n);
        }, false), O && (O.running = false);
      }));
    }
  }
  function Hr(t) {
    let r, n = 0;
    for (r = 0;r < t.length; r++) {
      const l = t[r];
      l.user ? t[n++] = l : ze(l);
    }
    if (q.context) {
      if (q.count) {
        q.effects || (q.effects = []), q.effects.push(...t.slice(0, n));
        return;
      }
      dt();
    }
    for (q.effects && (q.done || !q.count) && (t = [...q.effects, ...t], n += q.effects.length, delete q.effects), r = 0;r < n; r++)
      ze(t[r]);
  }
  function Qe(t, r) {
    const n = O && O.running;
    n ? t.tState = 0 : t.state = 0;
    for (let l = 0;l < t.sources.length; l += 1) {
      const s = t.sources[l];
      if (s.sources) {
        const f = n ? s.tState : s.state;
        f === oe ? s !== r && (!s.updatedAt || s.updatedAt < je) && ze(s) : f === Ne && Qe(s, r);
      }
    }
  }
  function qt(t) {
    const r = O && O.running;
    for (let n = 0;n < t.observers.length; n += 1) {
      const l = t.observers[n];
      (r ? !l.tState : !l.state) && (r ? l.tState = Ne : l.state = Ne, l.pure ? j.push(l) : Q.push(l), l.observers && qt(l));
    }
  }
  function Fe(t) {
    let r;
    if (t.sources)
      for (;t.sources.length; ) {
        const n = t.sources.pop(), l = t.sourceSlots.pop(), s = n.observers;
        if (s && s.length) {
          const f = s.pop(), S = n.observerSlots.pop();
          l < s.length && (f.sourceSlots[S] = l, s[l] = f, n.observerSlots[l] = S);
        }
      }
    if (t.tOwned) {
      for (r = t.tOwned.length - 1;r >= 0; r--)
        Fe(t.tOwned[r]);
      delete t.tOwned;
    }
    if (O && O.running && t.pure)
      Kt(t, true);
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
  function Kt(t, r) {
    if (r || (t.tState = 0, O.disposed.add(t)), t.owned)
      for (let n = 0;n < t.owned.length; n++)
        Kt(t.owned[n]);
  }
  function Gr(t) {
    return t instanceof Error ? t : new Error(typeof t == "string" ? t : "Unknown error", { cause: t });
  }
  function Qt(t, r, n) {
    try {
      for (const l of r)
        l(t);
    } catch (l) {
      _t(l, n && n.owner || null);
    }
  }
  function _t(t, r = H) {
    const n = Bt && r && r.context && r.context[Bt], l = Gr(t);
    if (!n)
      throw l;
    Q ? Q.push({ fn() {
      Qt(l, n, r);
    }, state: oe }) : Qt(l, n, r);
  }
  var Mr = Symbol("fallback");
  function Zt(t) {
    for (let r = 0;r < t.length; r++)
      t[r]();
  }
  function Ur(t, r, n = {}) {
    let l = [], s = [], f = [], S = 0, E = r.length > 1 ? [] : null;
    return Mt(() => Zt(f)), () => {
      let A = t() || [], x = A.length, T, R;
      return A[Dr], Te(() => {
        let h, _, b, y, L, p, v, o, c;
        if (x === 0)
          S !== 0 && (Zt(f), f = [], l = [], s = [], S = 0, E && (E = [])), n.fallback && (l = [Mr], s[0] = qe((d) => (f[0] = d, n.fallback())), S = 1);
        else if (S === 0) {
          for (s = new Array(x), R = 0;R < x; R++)
            l[R] = A[R], s[R] = qe($);
          S = x;
        } else {
          for (b = new Array(x), y = new Array(x), E && (L = new Array(x)), p = 0, v = Math.min(S, x);p < v && l[p] === A[p]; p++)
            ;
          for (v = S - 1, o = x - 1;v >= p && o >= p && l[v] === A[o]; v--, o--)
            b[o] = s[v], y[o] = f[v], E && (L[o] = E[v]);
          for (h = new Map, _ = new Array(o + 1), R = o;R >= p; R--)
            c = A[R], T = h.get(c), _[R] = T === undefined ? -1 : T, h.set(c, R);
          for (T = p;T <= v; T++)
            c = l[T], R = h.get(c), R !== undefined && R !== -1 ? (b[R] = s[T], y[R] = f[T], E && (L[R] = E[T]), R = _[R], h.set(c, R)) : f[T]();
          for (R = p;R < x; R++)
            R in b ? (s[R] = b[R], f[R] = y[R], E && (E[R] = L[R], E[R](R))) : s[R] = qe($);
          s = s.slice(0, S = x), l = A.slice(0);
        }
        return s;
      });
      function $(h) {
        if (f[R] = h, E) {
          const [_, b] = V(R);
          return E[R] = b, r(A[R], _);
        }
        return r(A[R]);
      }
    };
  }
  var Xr = false;
  function Yr(t, r) {
    if (Xr && q.context) {
      const n = q.context;
      dt(kr());
      const l = Te(() => t(r || {}));
      return dt(n), l;
    }
    return Te(() => t(r || {}));
  }
  function Ze() {
    return true;
  }
  var Jr = { get(t, r, n) {
    return r === gt ? n : t.get(r);
  }, has(t, r) {
    return r === gt ? true : t.has(r);
  }, set: Ze, deleteProperty: Ze, getOwnPropertyDescriptor(t, r) {
    return { configurable: true, enumerable: true, get() {
      return t.get(r);
    }, set: Ze, deleteProperty: Ze };
  }, ownKeys(t) {
    return t.keys();
  } };
  function bt(t) {
    return (t = typeof t == "function" ? t() : t) ? t : {};
  }
  function jr() {
    for (let t = 0, r = this.length;t < r; ++t) {
      const n = this[t]();
      if (n !== undefined)
        return n;
    }
  }
  function er(...t) {
    let r = false;
    for (let S = 0;S < t.length; S++) {
      const E = t[S];
      r = r || !!E && gt in E, t[S] = typeof E == "function" ? (r = true, Ke(E)) : E;
    }
    if (Nr && r)
      return new Proxy({ get(S) {
        for (let E = t.length - 1;E >= 0; E--) {
          const A = bt(t[E])[S];
          if (A !== undefined)
            return A;
        }
      }, has(S) {
        for (let E = t.length - 1;E >= 0; E--)
          if (S in bt(t[E]))
            return true;
        return false;
      }, keys() {
        const S = [];
        for (let E = 0;E < t.length; E++)
          S.push(...Object.keys(bt(t[E])));
        return [...new Set(S)];
      } }, Jr);
    const n = {}, l = Object.create(null);
    for (let S = t.length - 1;S >= 0; S--) {
      const E = t[S];
      if (!E)
        continue;
      const A = Object.getOwnPropertyNames(E);
      for (let x = A.length - 1;x >= 0; x--) {
        const T = A[x];
        if (T === "__proto__" || T === "constructor")
          continue;
        const R = Object.getOwnPropertyDescriptor(E, T);
        if (!l[T])
          l[T] = R.get ? { enumerable: true, configurable: true, get: jr.bind(n[T] = [R.get.bind(E)]) } : R.value !== undefined ? R : undefined;
        else {
          const $ = n[T];
          $ && (R.get ? $.push(R.get.bind(E)) : R.value !== undefined && $.push(() => R.value));
        }
      }
    }
    const s = {}, f = Object.keys(l);
    for (let S = f.length - 1;S >= 0; S--) {
      const E = f[S], A = l[E];
      A && A.get ? Object.defineProperty(s, E, A) : s[E] = A ? A.value : undefined;
    }
    return s;
  }
  function ae(t) {
    const r = "fallback" in t && { fallback: () => t.fallback };
    return Ke(Ur(() => t.each, t.children, r || undefined));
  }
  var qr = (t) => Ke(() => t());
  function Kr({ createElement: t, createTextNode: r, isTextNode: n, replaceText: l, insertNode: s, removeNode: f, setProperty: S, getParentNode: E, getFirstChild: A, getNextSibling: x }) {
    function T(p, v, o, c) {
      if (o !== undefined && !c && (c = []), typeof v != "function")
        return R(p, v, c, o);
      he((d) => R(p, v(), d, o), c);
    }
    function R(p, v, o, c, d) {
      for (;typeof o == "function"; )
        o = o();
      if (v === o)
        return o;
      const w = typeof v, P = c !== undefined;
      if (w === "string" || w === "number")
        if (w === "number" && (v = v.toString()), P) {
          let k = o[0];
          k && n(k) ? l(k, v) : k = r(v), o = _(p, o, c, k);
        } else
          o !== "" && typeof o == "string" ? l(A(p), o = v) : (_(p, o, c, r(v)), o = v);
      else if (v == null || w === "boolean")
        o = _(p, o, c);
      else {
        if (w === "function")
          return he(() => {
            let k = v();
            for (;typeof k == "function"; )
              k = k();
            o = R(p, k, o, c);
          }), () => o;
        if (Array.isArray(v)) {
          const k = [];
          if ($(k, v, d))
            return he(() => o = R(p, k, o, c, true)), () => o;
          if (k.length === 0) {
            const K = _(p, o, c);
            if (P)
              return o = K;
          } else
            Array.isArray(o) ? o.length === 0 ? b(p, k, c) : h(p, o, k) : o == null || o === "" ? b(p, k) : h(p, P && o || [A(p)], k);
          o = k;
        } else {
          if (Array.isArray(o)) {
            if (P)
              return o = _(p, o, c, v);
            _(p, o, null, v);
          } else
            o == null || o === "" || !A(p) ? s(p, v) : y(p, v, A(p));
          o = v;
        }
      }
      return o;
    }
    function $(p, v, o) {
      let c = false;
      for (let d = 0, w = v.length;d < w; d++) {
        let P = v[d], k;
        if (!(P == null || P === true || P === false))
          if (Array.isArray(P))
            c = $(p, P) || c;
          else if ((k = typeof P) == "string" || k === "number")
            p.push(r(P));
          else if (k === "function")
            if (o) {
              for (;typeof P == "function"; )
                P = P();
              c = $(p, Array.isArray(P) ? P : [P]) || c;
            } else
              p.push(P), c = true;
          else
            p.push(P);
      }
      return c;
    }
    function h(p, v, o) {
      let c = o.length, d = v.length, w = c, P = 0, k = 0, K = x(v[d - 1]), J = null;
      for (;P < d || k < w; ) {
        if (v[P] === o[k]) {
          P++, k++;
          continue;
        }
        for (;v[d - 1] === o[w - 1]; )
          d--, w--;
        if (d === P) {
          const ne = w < c ? k ? x(o[k - 1]) : o[w - k] : K;
          for (;k < w; )
            s(p, o[k++], ne);
        } else if (w === k)
          for (;P < d; )
            (!J || !J.has(v[P])) && f(p, v[P]), P++;
        else if (v[P] === o[w - 1] && o[k] === v[d - 1]) {
          const ne = x(v[--d]);
          s(p, o[k++], x(v[P++])), s(p, o[--w], ne), v[d] = o[w];
        } else {
          if (!J) {
            J = new Map;
            let de = k;
            for (;de < w; )
              J.set(o[de], de++);
          }
          const ne = J.get(v[P]);
          if (ne != null)
            if (k < ne && ne < w) {
              let de = P, Me = 1, Ue;
              for (;++de < d && de < w && !((Ue = J.get(v[de])) == null || Ue !== ne + Me); )
                Me++;
              if (Me > ne - k) {
                const zt = v[P];
                for (;k < ne; )
                  s(p, o[k++], zt);
              } else
                y(p, o[k++], v[P++]);
            } else
              P++;
          else
            f(p, v[P++]);
        }
      }
    }
    function _(p, v, o, c) {
      if (o === undefined) {
        let w;
        for (;w = A(p); )
          f(p, w);
        return c && s(p, c), "";
      }
      const d = c || r("");
      if (v.length) {
        let w = false;
        for (let P = v.length - 1;P >= 0; P--) {
          const k = v[P];
          if (d !== k) {
            const K = E(k) === p;
            !w && !P ? K ? y(p, d, k) : s(p, d, o) : K && f(p, k);
          } else
            w = true;
        }
      } else
        s(p, d, o);
      return [d];
    }
    function b(p, v, o) {
      for (let c = 0, d = v.length;c < d; c++)
        s(p, v[c], o);
    }
    function y(p, v, o) {
      s(p, v, o), f(p, o);
    }
    function L(p, v, o = {}, c) {
      return v || (v = {}), c || he(() => o.children = R(p, v.children, o.children)), he(() => v.ref && v.ref(p)), he(() => {
        for (const d in v) {
          if (d === "children" || d === "ref")
            continue;
          const w = v[d];
          w !== o[d] && (S(p, d, w, o[d]), o[d] = w);
        }
      }), o;
    }
    return { render(p, v) {
      let o;
      return qe((c) => {
        o = c, T(v, p());
      }), o;
    }, insert: T, spread(p, v, o) {
      typeof v == "function" ? he((c) => L(p, v(), c, o)) : L(p, v, undefined, o);
    }, createElement: t, createTextNode: r, insertNode: s, setProp(p, v, o, c) {
      return S(p, v, o, c), o;
    }, mergeProps: er, effect: he, memo: qr, createComponent: Yr, use(p, v, o) {
      return Te(() => p(v, o));
    } };
  }
  function Qr(t) {
    const r = Kr(t);
    return r.mergeProps = er, r;
  }
  var tr = 6 * 1024 * 1024, Zr = 64, xi = Zr, rr = 4 * 1024 * 1024, Oe = 64 + rr, vt = 768 * 1024, Et = Oe + vt, en = 256 * 1024, pt = Et + en, nr = Oe + vt, tn = 0, rn = 8, nn = 12, on = 16, an = 24, ln = 28, sn = 32, cn = 40, un = 44, fn = rn >> 2, dn = nn >> 2, gn = an >> 2, ir = ln >> 2, hn = cn >> 2;
  un >> 2;
  var Fn = tn >> 3, _n = on >> 3, bn = sn >> 3, Ci = 1, Ai = 2, yi = 3, $i = 4, ki = 16, Ii = 17, Ni = 20, Di = 21, Li = 22, zi = 23, Vi = 24, Wi = 25, Bi = 26, Hi = 27, Gi = 28, Mi = 29, Ui = 30, Xi = 31, Yi = 32, Ji = 33, ji = 34, qi = 35, Ki = 36, Qi = 37, Zi = 38, eo = 39, to = 0, ro = 1, no = 2, io = 3, oo = 4, ao = 5, lo = 6, so = 7, co = 9, uo = 10, fo = 11, go = 12, ho = 13, Fo = 14, _o = 15, bo = 16, vo = 17, Eo = 18, po = 19, So = 20, wo = 21, mo = 22, Ro = 23, Po = 24, To = 25, Oo = 26, xo = 27, Co = 28, Ao = 29, yo = 30, $o = 1, ko = 2, Io = 3, No = 4, Do = 5, Lo = 6, zo = 7, Vo = 8, Wo = 9, Bo = 10, Ho = 11, Go = 12, Mo = 13, Uo = 14, Xo = 15, Yo = 16, Jo = 17, jo = 18, qo = 19, Ko = 20, Qo = 0, Zo = 1, ea = 2, ta = 3, ra = 4, na = 5, ia = 6, oa = 7, aa = 0, la = 1, sa = 2, ca = 3, ua = 4, fa = 5, da = 6, ga = 7, ha = 8, Fa = 9, _a = 10, ba = 11, va = 12, Ea = 13, pa = 14, Sa = 15, wa = 16, ma = 32, Ra = 33, Pa = 34, Ta = 35, Oa = 36, xa = 37, Ca = 64, Aa = 65, ya = 66, $a = 67, ka = 68, Ia = 69, Na = 70, Da = 71, La = 72, za = 73, Va = 96, Wa = 97, Ba = 98, Ha = 99, Ga = 128, Ma = 129, Ua = 130, Xa = 131, Ya = 132, Ja = 133, ja = 134, qa = 135, Ka = 136, Qa = 137, Za = 160, el = 161, tl = 162, rl = 163, nl = 164, il = 165, ol = 166, al = 167, ll = 168, sl = 169, cl = 170, ul = 171, fl = 172, dl = 173, gl = 174, hl = -1, vn = 2147483646, En = 2147483645, ve = globalThis.__skal_acquireBridge();
  if (!ve || ve.byteLength !== tr)
    throw new Error(`Skal: bridge buffer not available (got ${ve && ve.byteLength})`);
  var or = new Uint8Array(ve), Z = new Uint32Array(ve), St = new BigInt64Array(ve), pn = new TextEncoder, Ve = 16, Sn = 64 + rr >> 2, wn = 16384, mn = Sn - 4, et = 0n, _e = Ve, xe = Oe, tt = Ve;
  function wt() {
    Z[fn] = _e - Ve << 2, Z[dn] = xe - Oe, et += 1n, Atomics.store(St, Fn, et), tt = _e;
  }
  function ar() {
    wt();
    const t = et, r = performance.now() + 5000;
    for (;!(Atomics.load(St, bn) >= t); )
      if (performance.now() > r) {
        console.warn("Skal: drain spin timeout \u2014 UI thread slow; ring will overwrite");
        break;
      }
    _e = Ve, xe = Oe, tt = Ve;
  }
  function G(t, r, n, l) {
    let s = _e;
    s >= mn && (ar(), s = _e), Z[s] = t >>> 0, Z[s + 1] = r >>> 0, Z[s + 2] = n >>> 0, Z[s + 3] = l >>> 0, _e = s + 4, _e - tt >= wn && wt();
  }
  var Ee = 0, pe = 0;
  function Ce(t) {
    xe + t.length * 3 > nr && ar();
    const r = xe - Oe, n = or.subarray(xe, nr), { read: l, written: s } = pn.encodeInto(t, n);
    if (l !== t.length)
      throw new Error(`Skal: string too large for heap (${t.length} code units > ${vt} bytes)`);
    xe += s, Ee = r, pe = s;
  }
  function mt(t, r) {
    Ce(r), G(20, t, Ee, pe);
  }
  var Rt = false;
  function Rn() {
    Rt = false, _e !== tt && wt();
  }
  function B() {
    Rt || (Rt = true, queueMicrotask(Rn));
  }
  var ce = 1024, C = new Int8Array(256);
  C.fill(-1), C[0] = 0, C[1] = 1, C[2] = 2, C[3] = 3, C[4] = 4, C[5] = 5, C[6] = 6, C[7] = 7, C[8] = 8, C[9] = 9, C[32] = 10, C[33] = 11, C[34] = 12, C[35] = 13, C[36] = 14, C[37] = 15, C[64] = 16, C[65] = 17, C[66] = 18, C[67] = 19, C[68] = 20, C[69] = 21, C[70] = 22, C[96] = 23, C[97] = 24, C[128] = 25, C[129] = 26, C[130] = 27, C[131] = 28, C[160] = 29, C[161] = 30, C[162] = 31, C[10] = 32, C[11] = 33, C[12] = 34, C[13] = 35, C[14] = 36, C[15] = 37, C[16] = 38, C[132] = 39, C[133] = 40, C[134] = 41, C[135] = 42, C[136] = 43, C[163] = 44, C[164] = 45, C[165] = 46, C[166] = 47, C[71] = 48, C[98] = 49, C[137] = 50, C[72] = 51, C[167] = 52, C[168] = 53, C[169] = 54, C[170] = 55, C[171] = 56, C[172] = 57, C[173] = 58, C[174] = 59, C[73] = 60, C[99] = 61;
  var re = 64, rt = new Int32Array(ce * re), We = new Float32Array(ce * re), nt = new Array(ce * re), Be = new Uint8Array(ce * re), Ae = 6, ye = new Float32Array(ce * Ae);
  ye.fill(NaN);
  var it = new Map, lr = [], Pn = 0;
  function Tn() {
    const t = ce * 2, r = ce * re, n = t * re, l = ce * Ae, s = t * Ae, f = new Int32Array(n);
    f.set(rt), rt = f;
    const S = new Uint8Array(n);
    S.set(Be), Be = S;
    const E = new Float32Array(n);
    E.set(We), E.fill(NaN, r), We = E;
    const A = new Float32Array(s);
    A.set(ye), A.fill(NaN, l), ye = A, nt.length = n, ce = t;
  }
  function ot(t) {
    let r = it.get(t);
    if (r === undefined) {
      r = lr.pop(), r === undefined && (r = Pn++), r >= ce && Tn(), it.set(t, r);
      const n = r * re;
      Be.fill(0, n, n + re), We.fill(NaN, n, n + re);
      for (let l = n;l < n + re; l++)
        nt[l] = undefined;
    }
    return r;
  }
  var sr = new Map, cr = new Map, ur = new Map, $e = new Map;
  function On(t) {
    const r = it.get(t);
    if (r !== undefined) {
      it.delete(t), lr.push(r);
      const n = r * Ae;
      ye.fill(NaN, n, n + Ae);
    }
    sr.delete(t), cr.delete(t), ur.delete(t), Mn(t);
  }
  var le = 0, be = 0, ke = new Float32Array(1), He = new Uint32Array(ke.buffer);
  function ee(t, r, n) {
    const l = n | 0, s = C[r];
    if (s < 0) {
      G(16, t, r, l), le++;
      return;
    }
    const f = ot(t) * re + s;
    if (Be[f] !== 0 && rt[f] === l) {
      be++;
      return;
    }
    rt[f] = l, Be[f] = 1, G(16, t, r, l), le++;
  }
  function fr(t, r, n) {
    const l = C[r];
    if (l < 0) {
      ke[0] = n, G(17, t, r, He[0]), le++;
      return;
    }
    const s = ot(t) * re + l;
    if (We[s] === n) {
      be++;
      return;
    }
    We[s] = n, ke[0] = n, G(17, t, r, He[0]), le++;
  }
  function xn(t, r, n) {
    const l = C[r];
    if (l < 0) {
      Ce(n == null ? "" : String(n)), G(22, t, (r & 255) << 24 | Ee & 16777215, pe), le++;
      return;
    }
    const s = ot(t) * re + l;
    if (nt[s] === n) {
      be++;
      return;
    }
    nt[s] = n, Ce(n == null ? "" : String(n)), G(22, t, (r & 255) << 24 | Ee & 16777215, pe), le++;
  }
  function Ie(t, r, n, l) {
    const s = ot(t) * Ae + n;
    if (ye[s] === l) {
      be++;
      return;
    }
    ye[s] = l, ke[0] = l, G(r, t, 0, He[0]), le++;
  }
  function Cn(t, r) {
    Ie(t, 32, 0, r);
  }
  function An(t, r) {
    Ie(t, 33, 1, r);
  }
  function yn(t, r) {
    Ie(t, 34, 2, r);
  }
  function $n(t, r) {
    Ie(t, 35, 3, r);
  }
  function kn(t, r) {
    Ie(t, 36, 4, r);
  }
  function In(t, r) {
    Ie(t, 37, 5, r);
  }
  var Nn = { material: 0, cupertino: 1, adaptive: 2 }, Dn = { light: 0, dark: 1 };
  function Ln(t, r) {
    G(38, typeof t == "string" ? Nn[t] ?? 0 : t | 0, typeof r == "string" ? Dn[r] ?? 0 : r | 0, 0), B();
  }
  function zn(t) {
    G(39, t, 0, 0), B();
  }
  function dr(t) {
    return at(1, "showDialog", [JSON.stringify(t || {})]);
  }
  function Vn(t) {
    return at(1, "showActionSheet", [JSON.stringify(t || {})]);
  }
  function gr(t) {
    return at(1, "showSnackbar", [JSON.stringify(typeof t == "string" ? { message: t } : t || {})]);
  }
  var hr = new Map;
  function Wn(t) {
    let r = 2166136261;
    for (let n = 0;n < t.length; n++)
      r ^= t.charCodeAt(n), r = Math.imul(r, 16777619) >>> 0;
    return r;
  }
  function Se(t) {
    let r = hr.get(t);
    return r !== undefined || (r = Wn(t), Ce(t), G(23, r, Ee, pe), hr.set(t, r)), r;
  }
  function Bn(t, r) {
    G(4, t, Se(r), 0);
  }
  function Pt(t, r) {
    let n = t.get(r);
    return n === undefined && (n = new Map, t.set(r, n)), n;
  }
  function Fr(t, r, n) {
    const l = Se(r), s = n >>> 0, f = Pt(sr, t);
    if (f.get(l) === s) {
      be++;
      return;
    }
    f.set(l, s), G(24, t, l, s), le++;
  }
  function _r(t, r, n) {
    const l = Se(r), s = Pt(cr, t);
    if (s.get(l) === n) {
      be++;
      return;
    }
    s.set(l, n), ke[0] = n, G(25, t, l, He[0]), le++;
  }
  function br(t, r, n) {
    const l = Se(r), s = n == null ? "" : String(n), f = Pt(ur, t);
    if (f.get(l) === s) {
      be++;
      return;
    }
    f.set(l, s), Ce(s);
    const S = Ee & 16777215, E = pe & 255;
    G(26, t, l, S << 8 | E), le++;
  }
  function Hn(t, r, n) {
    G(27, t, Se(r), n);
  }
  var Ge = new Map, ue = new Map, vr = 1;
  function Er(t, r) {
    for (let n = 0;n < r.length; n++) {
      const l = r[n];
      if (typeof l == "number")
        Number.isInteger(l) ? G(29, t, 1, l | 0) : (ke[0] = l, G(29, t, 2, He[0]));
      else if (typeof l == "boolean")
        G(29, t, 3, l ? 1 : 0);
      else if (typeof l == "string") {
        Ce(l);
        const s = Ee >>> 0;
        G(29, t, 4 | (pe & 16777215) << 8, s);
      } else
        G(29, t, 0, 0);
    }
  }
  function at(t, r, n) {
    const l = Se(r), s = vr++;
    return Er(s, n), G(28, t, l, s), B(), new Promise((f, S) => {
      Ge.set(s, { resolve: f, reject: S });
    });
  }
  function Gn(t, r, n, l, s) {
    const f = Se(r), S = vr++;
    Er(S, n), G(30, t, f, S), B(), ue.set(S, { nodeId: t, onValue: l, onError: s && s.onError, onDone: s && s.onDone });
    let E = $e.get(t);
    return E === undefined && (E = new Set, $e.set(t, E)), E.add(S), function() {
      if (!ue.has(S))
        return;
      ue.delete(S);
      const x = $e.get(t);
      x && (x.delete(S), x.size === 0 && $e.delete(t)), G(31, S, 0, 0), B();
    };
  }
  function Mn(t) {
    const r = $e.get(t);
    if (r !== undefined) {
      for (const n of r)
        ue.has(n) && (ue.delete(n), G(31, n, 0, 0));
      $e.delete(t), B();
    }
  }
  var Tt = new Map, Un = 1;
  function Ot(t) {
    const r = Un++;
    return Tt.set(r, t), r;
  }
  function pr(t, r, n) {
    G(21, t, r, n);
  }
  var xt = 0n, we = null, Sr = tr - pt, Ct = pt >> 2, Xn = pt + Sr >> 2, Yn = Sr / 16 | 0, wr = new ArrayBuffer(4), At = new Float32Array(wr), yt = new Uint32Array(wr), Jn = new TextDecoder("utf-8");
  function $t(t, r) {
    return r === 0 ? "" : Jn.decode(or.subarray(Et + t, Et + t + r));
  }
  function kt(t, r) {
    Z[hn] = t + r;
  }
  globalThis.__skal_drainEvents = function() {
    const t = Atomics.load(St, _n);
    if (t === xt)
      return;
    const r = Ct + (Z[gn] >> 2);
    let n = Ct + (Z[ir] >> 2);
    const l = Xn, s = Ct;
    let f = Yn;
    for (;n !== r && f-- > 0; ) {
      const S = Z[n + 0], E = S & 255, A = S >>> 8 & 255, x = Z[n + 1], T = Z[n + 2], R = Z[n + 3];
      let $, h = false;
      if (A === 1)
        $ = T | 0, h = true;
      else if (A === 2)
        yt[0] = T, $ = At[0], h = true;
      else if (A === 3)
        $ = T !== 0, h = true;
      else if (A === 4)
        $ = $t(R, T), h = true, kt(R, T);
      else if (A === 5) {
        const _ = $t(R, T);
        try {
          $ = JSON.parse(_);
        } catch {
          $ = _;
        }
        h = true, kt(R, T);
      } else if (A === 6) {
        const _ = $t(R, T);
        try {
          $ = JSON.parse(_);
        } catch {
          $ = [];
        }
        h = true, kt(R, T);
      } else if (A === 7) {
        yt[0] = T;
        const _ = At[0];
        yt[0] = R, $ = [_, At[0]], h = true;
      }
      if (E === 3) {
        const _ = Ge.get(x);
        if (_) {
          Ge.delete(x);
          try {
            _.resolve(h ? $ : undefined);
          } catch (b) {
            we = b && (b.stack || b.message || String(b)) || "unknown";
          }
        }
      } else if (E === 4) {
        const _ = Ge.get(x);
        if (_) {
          Ge.delete(x);
          try {
            const b = typeof $ == "string" ? $ : `skal RPC error (status ${$})`;
            _.reject(new Error(b));
          } catch (b) {
            we = b && (b.stack || b.message || String(b)) || "unknown";
          }
        }
      } else if (E === 5) {
        const _ = ue.get(x);
        if (_)
          try {
            _.onValue(h ? $ : undefined);
          } catch (b) {
            we = b && (b.stack || b.message || String(b)) || "unknown";
          }
      } else if (E === 6) {
        const _ = ue.get(x);
        if (_) {
          ue.delete(x);
          try {
            _.onDone && _.onDone();
          } catch (b) {
            we = b && (b.stack || b.message || String(b)) || "unknown";
          }
        }
      } else if (E === 7) {
        const _ = ue.get(x);
        if (_) {
          ue.delete(x);
          try {
            _.onError && _.onError(new Error(typeof $ == "string" ? $ : "skal stream error"));
          } catch (b) {
            we = b && (b.stack || b.message || String(b)) || "unknown";
          }
        }
      } else {
        const _ = Tt.get(x);
        if (_)
          try {
            h ? (A === 6 || A === 7) && Array.isArray($) ? _(...$) : _($) : _();
          } catch (b) {
            we = b && (b.stack || b.message || String(b)) || "unknown";
          }
      }
      n += 4, n >= l && (n = s);
    }
    Z[ir] = n - s << 2, xt = t;
  }, globalThis.skalStatus = () => JSON.stringify({ handlerCount: Tt.size, opSeq: Number(et), lastEventSeq: Number(xt), lastHandlerError: we, propWrites: le, propSkips: be });
  var Fl = 1, jn = 2;
  function mr() {
    return jn++;
  }
  var qn = { box: 0, column: 1, scrollView: 5, listView: 6, reorderableListView: 7, row: 2, text: 3, button: 4, image: 9, stack: 10, switch: 11, slider: 12, checkbox: 13, activityIndicator: 14, progressBar: 15, lazyGrid: 16, wrap: 17, safeArea: 18, richText: 19, textInput: 20, navigator: 21, screen: 22, tabs: 23, tab: 24, animatedList: 25, crossFade: 26, hero: 27, listTile: 28, pageView: 29, dismissible: 30 }, Kn = { padding: [0, "u32"], paddingTop: [1, "u32"], paddingRight: [2, "u32"], paddingBottom: [3, "u32"], paddingLeft: [4, "u32"], width: [5, "dim"], height: [6, "dim"], weight: [7, "f32"], alignment: [8, "u32"], gap: [9, "u32"], axis: [10, "u32"], top: [11, "u32"], right: [12, "u32"], bottom: [13, "u32"], left: [14, "u32"], crossAxisCount: [15, "u32"], aspectRatio: [16, "f32"], background: [32, "color"], color: [33, "color"], cornerRadius: [34, "u32"], borderWidth: [35, "u32"], borderColor: [36, "color"], shadow: [37, "u32"], fontSize: [64, "u32"], fontWeight: [65, "u32"], fontFamily: [66, "u32"], textAlign: [67, "u32"], lineHeight: [68, "u32"], maxLines: [69, "u32"], textOverflow: [70, "u32"], src: [96, "str"], contentScale: [97, "u32"], placeholder: [128, "str"], value: [129, "str"], keyboardType: [130, "u32"], secureEntry: [131, "u32"], checked: [132, "u32"], min: [134, "f32"], max: [135, "f32"], progress: [136, "f32"], presentation: [166, "u32"], title: [71, "str"], icon: [98, "str"], leadingIcon: [98, "str"], subtitle: [73, "str"], trailingIcon: [99, "str"], activeTab: [137, "u32"], tag: [72, "str"], transition: [171, "u32"], enabled: [160, "u32"], focusable: [161, "u32"], visible: [162, "u32"], draggable: [172, "u32"], spring: [173, "u32"], release: [174, "u32"] }, Qn = { opacity: Cn, translationX: An, translationY: yn, scaleX: $n, scaleY: kn, rotation: In }, Zn = { onClick: 1, onclick: 1, onTap: 1, onLongPress: 8, onDoubleTap: 9, onChange: 2, onSubmit: 10, onReorder: 11, onPop: 12, onDismiss: 20, onPanStart: 13, onPanUpdate: 14, onPanEnd: 15, onScaleStart: 16, onScaleUpdate: 17, onScaleEnd: 18 }, ei = { linear: 0, easeIn: 1, easeOut: 2, easeInOut: 3, bounce: 4, elastic: 5, fastOutSlowIn: 6 }, ti = { gentle: 1, bouncy: 2, stiff: 3 };
  function ri(t) {
    if (typeof t == "number")
      return t | 0;
    if (typeof t != "string")
      return 0;
    let r = t.trim();
    r.startsWith("#") && (r = r.slice(1));
    let n = 0, l = 0, s = 0, f = 255;
    return r.length === 3 ? (n = parseInt(r[0] + r[0], 16), l = parseInt(r[1] + r[1], 16), s = parseInt(r[2] + r[2], 16)) : r.length === 4 ? (n = parseInt(r[0] + r[0], 16), l = parseInt(r[1] + r[1], 16), s = parseInt(r[2] + r[2], 16), f = parseInt(r[3] + r[3], 16)) : r.length === 6 ? (n = parseInt(r.slice(0, 2), 16), l = parseInt(r.slice(2, 4), 16), s = parseInt(r.slice(4, 6), 16)) : r.length === 8 && (f = parseInt(r.slice(0, 2), 16), n = parseInt(r.slice(2, 4), 16), l = parseInt(r.slice(4, 6), 16), s = parseInt(r.slice(6, 8), 16)), (f & 255) << 24 | (n & 255) << 16 | (l & 255) << 8 | s & 255 | 0;
  }
  function ni(t) {
    return typeof t == "number" ? t | 0 : t === "fill" ? vn : t === "wrap" ? En : -1;
  }
  function ii(t) {
    if (Array.isArray(t))
      return true;
    const r = Object.getPrototypeOf(t);
    return r === Object.prototype || r === null;
  }
  function oi(t, r, n) {
    if (n == null)
      return;
    if (r === "ref" && n && typeof n.__skalBind == "function") {
      n.__skalBind(t.id);
      return;
    }
    const l = typeof n;
    if (l === "object" && ii(n)) {
      br(t.id, r, JSON.stringify(n)), B();
      return;
    }
    if (l === "function") {
      const s = Ot(n);
      Hn(t.id, r, s), B();
      return;
    }
    if (l === "number") {
      Number.isInteger(n) && n >= 0 && n <= 4294967295 && Fr(t.id, r, n | 0), _r(t.id, r, n), B();
      return;
    }
    if (l === "string") {
      br(t.id, r, n), B();
      return;
    }
    if (l === "boolean") {
      Fr(t.id, r, n ? 1 : 0), B();
      return;
    }
  }
  function ai(t) {
    const r = [t];
    for (;r.length > 0; ) {
      const n = r.pop();
      On(n.id);
      let l = n.firstChild;
      for (;l; )
        r.push(l), l = l.nextSibling;
    }
  }
  var lt = class {
    constructor(t, r, n = false, l = false) {
      this.tag = t, this.id = r, this.isText = n, this.isCustom = l, this.parent = null, this.firstChild = null, this.lastChild = null, this.nextSibling = null, this.prevSibling = null, this.text = "";
    }
  }, li = Qr({ createElement(t) {
    const r = mr(), n = qn[t];
    return n !== undefined ? (G(1, r, n, 0), B(), new lt(t, r, false, false)) : (Bn(r, t), B(), new lt(t, r, false, true));
  }, createTextNode(t) {
    const r = mr();
    G(1, r, 3, 0);
    const n = t == null ? "" : String(t);
    n.length > 0 && mt(r, n), B();
    const l = new lt("#text", r, true);
    return l.text = n, l;
  }, replaceText(t, r) {
    const n = r == null ? "" : String(r);
    t.text !== n && (t.text = n, mt(t.id, n), B());
  }, setProperty(t, r, n, l) {
    if (t.isCustom) {
      oi(t, r, n);
      return;
    }
    if (r === "onRefresh") {
      if (typeof n == "function") {
        const E = t.id, A = n, T = Ot(async () => {
          try {
            await A();
          } finally {
            zn(E);
          }
        });
        pr(t.id, 19, T), B();
      }
      return;
    }
    const s = Zn[r];
    if (s !== undefined) {
      if (typeof n == "function") {
        const E = Ot(n);
        pr(t.id, s, E), B();
      }
      return;
    }
    if (r === "value" && t.tag === "slider") {
      fr(t.id, 133, Number(n) || 0), B();
      return;
    }
    if (r === "draggable" && typeof n == "string") {
      ee(t.id, 172, { free: 1, both: 1, horizontal: 2, x: 2, vertical: 3, y: 3 }[n] ?? 0), B();
      return;
    }
    if (r === "spring" && typeof n == "string") {
      ee(t.id, 173, { gentle: 1, bouncy: 2, stiff: 3, wobbly: 2 }[n] ?? 0), B();
      return;
    }
    if (r === "release" && typeof n == "string") {
      ee(t.id, 174, { none: 0, glide: 1, friction: 1, springback: 2, spring: 2 }[n.toLowerCase()] ?? 0), B();
      return;
    }
    if (r === "animate" && n && typeof n == "object") {
      if (ee(t.id, 163, n.duration | 0), n.curve != null) {
        const E = typeof n.curve == "string" ? ei[n.curve] ?? 0 : n.curve | 0;
        ee(t.id, 164, E);
      }
      if (n.delay != null && ee(t.id, 165, n.delay | 0), n.repeat != null && ee(t.id, 167, n.repeat ? 1 : 0), n.reverse != null && ee(t.id, 168, n.reverse ? 1 : 0), n.loop != null && ee(t.id, 169, n.loop | 0), n.spring != null) {
        const E = typeof n.spring == "string" ? ti[n.spring] ?? 0 : n.spring ? 2 : 0;
        ee(t.id, 170, E);
      }
      B();
      return;
    }
    if (r === "label" && (t.tag === "button" || t.tag === "text")) {
      const E = n == null ? "" : String(n);
      mt(t.id, E), B();
      return;
    }
    const f = Qn[r];
    if (f !== undefined) {
      typeof n == "number" && (f(t.id, n), B());
      return;
    }
    const S = Kn[r];
    if (S !== undefined) {
      const [E, A] = S;
      if (n == null)
        return;
      switch (A) {
        case "u32":
          typeof n == "number" ? (ee(t.id, E, n | 0), B()) : typeof n == "boolean" && (ee(t.id, E, n ? 1 : 0), B());
          return;
        case "f32":
          typeof n == "number" && (fr(t.id, E, n), B());
          return;
        case "str":
          xn(t.id, E, String(n)), B();
          return;
        case "color":
          ee(t.id, E, ri(n)), B();
          return;
        case "dim":
          ee(t.id, E, ni(n)), B();
          return;
      }
      return;
    }
    if (r === "style" && n && typeof n == "object") {
      for (const E in n)
        this.setProperty(t, E, n[E]);
      return;
    }
  }, insertNode(t, r, n) {
    if (r === n)
      return;
    if (r.parent) {
      const s = r.parent;
      r.prevSibling ? r.prevSibling.nextSibling = r.nextSibling : s.firstChild === r && (s.firstChild = r.nextSibling), r.nextSibling ? r.nextSibling.prevSibling = r.prevSibling : s.lastChild === r && (s.lastChild = r.prevSibling), r.prevSibling = null, r.nextSibling = null;
    }
    const l = n ? n.id : 0;
    G(3, t.id, r.id, l), B(), r.parent = t, n ? (r.nextSibling = n, r.prevSibling = n.prevSibling, n.prevSibling ? n.prevSibling.nextSibling = r : t.firstChild = r, n.prevSibling = r) : (r.prevSibling = t.lastChild, r.nextSibling = null, t.lastChild ? t.lastChild.nextSibling = r : t.firstChild = r, t.lastChild = r);
  }, removeNode(t, r) {
    G(2, r.id, 0, 0), ai(r), B(), r.prevSibling ? r.prevSibling.nextSibling = r.nextSibling : t.firstChild = r.nextSibling, r.nextSibling ? r.nextSibling.prevSibling = r.prevSibling : t.lastChild = r.prevSibling, r.parent = null, r.prevSibling = null, r.nextSibling = null;
  }, isTextNode(t) {
    return t.isText;
  }, getParentNode(t) {
    return t.parent;
  }, getFirstChild(t) {
    return t.firstChild;
  }, getNextSibling(t) {
    return t.nextSibling;
  } }), { render: si, effect: z, memo: It, createComponent: I, createElement: a, createTextNode: _l, insertNode: g, insert: N, spread: bl, setProp: e, mergeProps: vl, use: ci } = li;
  G(1, 1, 0, 0), B();
  var ui = new lt("box", 1, false);
  function fi() {
    let t = 0;
    const r = function() {};
    return r.__skalBind = (n) => {
      t = n;
    }, new Proxy(r, { apply(n, l, s) {
      const f = s[0];
      f && typeof f.id == "number" && (t = f.id);
    }, get(n, l) {
      if (l === "__skalBind" || typeof l == "symbol")
        return r[l];
      if (typeof l == "string" && l.endsWith("$") && l.length > 1) {
        const s = l.slice(0, -1);
        return (...f) => {
          if (t === 0)
            throw new Error(`skal ref: cannot call .${String(l)}() before the host mounts. Move the call into a JSX event handler.`);
          const S = f[f.length - 1];
          if (typeof S != "function")
            throw new TypeError(`skal ref: .${String(l)}() requires a callback as its last argument (got ${typeof S})`);
          const E = f.slice(0, -1);
          return Gn(t, s, E, S);
        };
      }
      return (...s) => t === 0 ? Promise.reject(new Error(`skal ref: cannot call .${String(l)}() before the host mounts. Move the call into a JSX event handler.`)) : at(t, l, s);
    } });
  }
  function Nt(t, r, n) {
    const l = (_) => {
      const b = t[_];
      return typeof b == "function" ? b : b && b.component || null;
    }, s = (_) => {
      const b = t[_];
      return b && typeof b == "object" ? b.title : undefined;
    }, f = (_) => {
      const b = t[_];
      return b && typeof b == "object" ? b.transition : undefined;
    }, S = (_) => _ === "fade" ? 1 : _ === "none" ? 2 : typeof _ == "number" ? _ : 0, E = !!(n && n.linking), A = typeof window < "u", x = () => {
      if (!A)
        return null;
      const _ = (window.location.hash || "").replace(/^#\/?/, "").split("?")[0];
      return _ && t[_] ? _ : null;
    };
    let T = typeof r == "string" ? r : r && r.name || Object.keys(t)[0];
    if (E) {
      const _ = x();
      _ && (T = _);
    }
    const [R, $] = V([{ name: T, params: {}, title: s(T), transition: f(T) }]), h = { stack: R, navigate(_, b, y) {
      $([...R(), { name: _, params: b || {}, presentation: y && y.presentation, title: (y && y.title) !== undefined ? y.title : s(_), transition: (y && y.transition) !== undefined ? y.transition : f(_) }]);
    }, back() {
      const _ = R();
      _.length > 1 && $(_.slice(0, -1));
    }, replace(_, b, y) {
      $([...R().slice(0, -1), { name: _, params: b || {}, title: (y && y.title) !== undefined ? y.title : s(_), transition: (y && y.transition) !== undefined ? y.transition : f(_) }]);
    }, reset(_, b) {
      $([{ name: _, params: b || {}, title: s(_), transition: f(_) }]);
    }, canGoBack() {
      return R().length > 1;
    } };
    return E && A && Lr(() => {
      const _ = R(), b = "#/" + _[_.length - 1].name;
      window.location.hash !== b && window.history.replaceState({}, "", b);
    }), h.View = () => (() => {
      var _ = a("navigator");
      return e(_, "onPop", () => h.back()), N(_, I(ae, { get each() {
        return R();
      }, children: (b) => {
        const y = l(b.name);
        return (() => {
          var L = a("screen");
          return N(L, y ? I(y, { get params() {
            return b.params || {};
          }, router: h }) : null), z((p) => {
            var v = b.presentation === "modal" ? 1 : 0, o = b.title || "", c = S(b.transition);
            return v !== p.e && (p.e = e(L, "presentation", v, p.e)), o !== p.t && (p.t = e(L, "title", o, p.t)), c !== p.a && (p.a = e(L, "transition", c, p.a)), p;
          }, { e: undefined, t: undefined, a: undefined }), L;
        })();
      } })), _;
    })(), h;
  }
  var st = "#FF0A84FF", Dt = "#FF34C759", Lt = "#FFFF9F0A", Rr = "#FFFF3B30", Pr = "#FF5E5CE6";
  function W(t) {
    return (() => {
      var r = a("column"), n = a("text");
      return g(r, n), e(r, "background", "#FFFFFFFF"), e(r, "cornerRadius", 14), e(r, "padding", 16), e(r, "gap", 12), e(r, "borderWidth", 1), e(r, "borderColor", "#FFE5E5EA"), e(n, "fontSize", 15), e(n, "fontWeight", 800), e(n, "color", "#FF1C1C1E"), N(r, () => t.children, null), z((l) => e(n, "label", t.title, l)), r;
    })();
  }
  function di(t) {
    const r = ["Inbox", "Starred", "Drafts", "Archive"];
    return (() => {
      var n = a("column");
      return e(n, "background", "#FFF2F2F7"), e(n, "padding", 16), e(n, "gap", 8), e(n, "height", "fill"), N(n, I(ae, { each: r, children: (l) => (() => {
        var s = a("box"), f = a("text");
        return g(s, f), e(s, "background", "#FFFFFFFF"), e(s, "cornerRadius", 8), e(s, "padding", 12), e(s, "onTap", () => t.router.navigate("detail", { name: l }, { title: l })), e(f, "label", `${l}   \u203A`), e(f, "fontSize", 14), e(f, "color", "#FF1C1C1E"), s;
      })() })), n;
    })();
  }
  function gi(t) {
    return (() => {
      var r = a("column"), n = a("text"), l = a("text");
      return g(r, n), g(r, l), e(r, "background", "#FFF2F2F7"), e(r, "padding", 16), e(r, "gap", 10), e(r, "height", "fill"), e(n, "fontSize", 20), e(n, "fontWeight", 800), e(n, "color", "#FF1C1C1E"), e(l, "label", "The AppBar's \u2039 back button (and the system back / swipe gesture) all pop this route. The list screen behind stayed mounted \u2014 back is instant, no re-render, scroll preserved."), e(l, "fontSize", 13), e(l, "color", "#FF8E8E93"), z((s) => e(n, "label", t.name, s)), r;
    })();
  }
  var hi = [st, Dt, Lt, Pr];
  function Fi() {
    const [t, r] = V(false), [n, l] = V(false), [s, f] = V(false), [S, E] = V(0), [A, x] = V("0, 0"), [T, R] = V(false), [$, h] = V(["Alpha", "Beta", "Gamma"]);
    let _ = 3;
    const b = Nt({ gallery: (y) => (() => {
      var L = a("column"), p = a("text"), v = a("row");
      return g(L, p), g(L, v), e(L, "background", "#FFF2F2F7"), e(L, "padding", 16), e(L, "gap", 12), e(L, "height", "fill"), e(p, "label", "Tap a swatch \u2014 it flies to the detail screen."), e(p, "fontSize", 13), e(p, "color", "#FF8E8E93"), e(v, "gap", 12), N(v, I(ae, { each: hi, children: (o) => (() => {
        var c = a("hero"), d = a("box");
        return g(c, d), e(c, "tag", `hero-${o}`), e(d, "width", 56), e(d, "height", 56), e(d, "background", o), e(d, "cornerRadius", 12), e(d, "onTap", () => y.router.navigate("detail", { color: o })), c;
      })() })), L;
    })(), detail: { component: (y) => (() => {
      var L = a("column"), p = a("hero"), v = a("box"), o = a("text");
      return g(L, p), g(L, o), e(L, "background", "#FFF2F2F7"), e(L, "padding", 16), e(L, "gap", 12), e(L, "height", "fill"), g(p, v), e(v, "width", "fill"), e(v, "height", 180), e(v, "cornerRadius", 20), e(o, "label", "The swatch flew here from the gallery \u2014 a shared-element transition, GPU-composited host-side."), e(o, "fontSize", 13), e(o, "color", "#FF8E8E93"), z((c) => {
        var d = `hero-${y.params.color}`, w = y.params.color;
        return d !== c.e && (c.e = e(p, "tag", d, c.e)), w !== c.t && (c.t = e(v, "background", w, c.t)), c;
      }, { e: undefined, t: undefined }), L;
    })(), title: "Detail", transition: "fade" } }, "gallery");
    return (() => {
      var y = a("scrollView"), L = a("text"), p = a("text"), v = a("text");
      return g(y, L), g(y, p), g(y, v), e(y, "background", "#FFF2F2F7"), e(y, "padding", 16), e(y, "gap", 14), e(L, "label", "Animations"), e(L, "fontSize", 24), e(L, "fontWeight", 800), e(L, "color", "#FF1C1C1E"), e(p, "label", "Host-side motion \u2014 JS flips one signal, Flutter runs the whole tween. Zero per-frame bridge traffic. See ANIMATION.md for the full plan."), e(p, "fontSize", 13), e(p, "color", "#FF8E8E93"), N(y, I(W, { title: "Implicit hot-prop tween \u2014 the animate prop", get children() {
        return [(() => {
          var o = a("row"), c = a("box");
          return g(o, c), e(o, "gap", 8), e(c, "width", 64), e(c, "height", 64), e(c, "background", "#FF0A84FF"), e(c, "cornerRadius", 14), e(c, "animate", { duration: 450, curve: "easeInOut" }), z((d) => {
            var w = t() ? 0.3 : 1, P = t() ? 1.4 : 1, k = t() ? 1.4 : 1, K = t() ? 0.5 : 0, J = t() ? 70 : 0;
            return w !== d.e && (d.e = e(c, "opacity", w, d.e)), P !== d.t && (d.t = e(c, "scaleX", P, d.t)), k !== d.a && (d.a = e(c, "scaleY", k, d.a)), K !== d.o && (d.o = e(c, "rotation", K, d.o)), J !== d.i && (d.i = e(c, "translationX", J, d.i)), d;
          }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined }), o;
        })(), (() => {
          var o = a("button");
          return e(o, "onClick", () => r(!t())), z((c) => e(o, "label", t() ? "Reset" : "Animate", c)), o;
        })(), (() => {
          var o = a("text");
          return e(o, "label", "opacity + scale + rotation + translation tween together \u2014 JS only flips one signal; the whole tween runs host-side."), e(o, "fontSize", 11), e(o, "color", "#FF8E8E93"), o;
        })()];
      } }), v), N(y, I(W, { title: "Cold-prop tween \u2014 colour \xB7 radius \xB7 padding", get children() {
        return [(() => {
          var o = a("box"), c = a("text");
          return g(o, c), e(o, "animate", { duration: 400, curve: "easeInOut" }), e(o, "width", "fill"), e(c, "label", "AnimatedContainer tweens these host-side"), e(c, "fontSize", 12), e(c, "color", "#FFFFFFFF"), z((d) => {
            var w = n() ? Rr : st, P = n() ? 32 : 8, k = n() ? 28 : 12;
            return w !== d.e && (d.e = e(o, "background", w, d.e)), P !== d.t && (d.t = e(o, "cornerRadius", P, d.t)), k !== d.a && (d.a = e(o, "padding", k, d.a)), d;
          }, { e: undefined, t: undefined, a: undefined }), o;
        })(), (() => {
          var o = a("button");
          return e(o, "onClick", () => l(!n())), z((c) => e(o, "label", n() ? "Reset" : "Animate", c)), o;
        })(), (() => {
          var o = a("text");
          return e(o, "label", "background, cornerRadius and padding are cold props \u2014 the host's AnimatedContainer tweens them; JS writes each value once."), e(o, "fontSize", 11), e(o, "color", "#FF8E8E93"), o;
        })()];
      } }), v), N(y, I(W, { title: "Looping \u2014 repeat \xB7 reverse", get children() {
        return [(() => {
          var o = a("row"), c = a("box"), d = a("box"), w = a("box");
          return g(o, c), g(o, d), g(o, w), e(o, "gap", 20), e(c, "width", 44), e(c, "height", 44), e(c, "background", "#FF5E5CE6"), e(c, "cornerRadius", 22), e(c, "animate", { duration: 800, curve: "easeInOut", repeat: true, reverse: true }), e(c, "scaleX", 1.35), e(c, "scaleY", 1.35), e(d, "width", 44), e(d, "height", 44), e(d, "background", "#FF34C759"), e(d, "cornerRadius", 10), e(d, "animate", { duration: 1400, repeat: true }), e(d, "rotation", 6.2832), e(w, "width", 44), e(w, "height", 44), e(w, "background", "#FFFF9F0A"), e(w, "cornerRadius", 22), e(w, "animate", { duration: 900, curve: "easeInOut", repeat: true, reverse: true }), e(w, "opacity", 0.25), o;
        })(), (() => {
          var o = a("text");
          return e(o, "label", "A pulse, a spin and a breathe \u2014 each loops forever host-side; JS set the endpoints once and never touches them again."), e(o, "fontSize", 11), e(o, "color", "#FF8E8E93"), o;
        })()];
      } }), v), N(y, I(W, { title: "Spring physics \u2014 animate.spring", get children() {
        return [(() => {
          var o = a("column"), c = a("box"), d = a("box"), w = a("box");
          return g(o, c), g(o, d), g(o, w), e(o, "gap", 10), e(c, "width", 48), e(c, "height", 48), e(c, "background", "#FF0A84FF"), e(c, "cornerRadius", 10), e(c, "animate", { duration: 700, spring: "gentle" }), e(d, "width", 48), e(d, "height", 48), e(d, "background", "#FF34C759"), e(d, "cornerRadius", 10), e(d, "animate", { duration: 700, spring: "bouncy" }), e(w, "width", 48), e(w, "height", 48), e(w, "background", "#FFFF9F0A"), e(w, "cornerRadius", 10), e(w, "animate", { duration: 700, spring: "stiff" }), z((P) => {
            var k = s() ? 150 : 0, K = s() ? 150 : 0, J = s() ? 150 : 0;
            return k !== P.e && (P.e = e(c, "translationX", k, P.e)), K !== P.t && (P.t = e(d, "translationX", K, P.t)), J !== P.a && (P.a = e(w, "translationX", J, P.a)), P;
          }, { e: undefined, t: undefined, a: undefined }), o;
        })(), (() => {
          var o = a("button");
          return e(o, "onClick", () => f(!s())), z((c) => e(o, "label", s() ? "Back" : "Spring", c)), o;
        })(), (() => {
          var o = a("text");
          return e(o, "label", "gentle \xB7 bouncy \xB7 stiff \u2014 three spring-like curves; bouncy overshoots and wobbles into place."), e(o, "fontSize", 11), e(o, "color", "#FF8E8E93"), o;
        })()];
      } }), v), N(y, I(W, { title: "Physics \u2014 real SpringSimulation (spring)", get children() {
        return [(() => {
          var o = a("column"), c = a("box"), d = a("box"), w = a("box");
          return g(o, c), g(o, d), g(o, w), e(o, "gap", 12), e(c, "width", 52), e(c, "height", 52), e(c, "background", "#FF0A84FF"), e(c, "cornerRadius", 12), e(c, "spring", "gentle"), e(d, "width", 52), e(d, "height", 52), e(d, "background", "#FF34C759"), e(d, "cornerRadius", 12), e(d, "spring", "bouncy"), e(w, "width", 52), e(w, "height", 52), e(w, "background", "#FFFF9F0A"), e(w, "cornerRadius", 12), e(w, "spring", "stiff"), z((P) => {
            var k = S(), K = S(), J = S();
            return k !== P.e && (P.e = e(c, "translationX", k, P.e)), K !== P.t && (P.t = e(d, "translationX", K, P.t)), J !== P.a && (P.a = e(w, "translationX", J, P.a)), P;
          }, { e: undefined, t: undefined, a: undefined }), o;
        })(), (() => {
          var o = a("button");
          return e(o, "onClick", () => E(S() === 0 ? 175 : 0)), z((c) => e(o, "label", S() === 0 ? "Spring" : "Back", c)), o;
        })(), (() => {
          var o = a("text");
          return e(o, "label", "A real SpringSimulation drives these \u2014 not a curve. Tap fast: the box retargets from its CURRENT position and velocity mid-flight, with no dead-stop restart. gentle settles, bouncy overshoots, stiff snaps."), e(o, "fontSize", 11), e(o, "color", "#FF8E8E93"), o;
        })()];
      } }), v), N(y, I(W, { title: "Physics \u2014 release momentum (draggable + release)", get children() {
        return [(() => {
          var o = a("box"), c = a("box"), d = a("text");
          return g(o, c), e(o, "height", 150), e(o, "background", "#FFEFEFF4"), e(o, "cornerRadius", 12), g(c, d), e(c, "draggable", true), e(c, "release", "glide"), e(c, "width", 60), e(c, "height", 60), e(c, "background", "#FF0A84FF"), e(c, "cornerRadius", 14), e(c, "onPanEnd", (w, P) => x(`${w.toFixed(0)}, ${P.toFixed(0)}`)), e(d, "label", "glide"), e(d, "fontSize", 11), e(d, "color", "#FFFFFFFF"), o;
        })(), (() => {
          var o = a("text");
          return e(o, "fontSize", 11), e(o, "color", "#FF8E8E93"), z((c) => e(o, "label", `Throw the blue box \u2014 friction carries it on after you let go and decelerates it to rest. Resting at ${A()}.`, c)), o;
        })(), (() => {
          var o = a("box"), c = a("box"), d = a("text");
          return g(o, c), e(o, "height", 150), e(o, "background", "#FFEFEFF4"), e(o, "cornerRadius", 12), g(c, d), e(c, "draggable", true), e(c, "release", "springBack"), e(c, "width", 60), e(c, "height", 60), e(c, "background", "#FF5E5CE6"), e(c, "cornerRadius", 14), e(d, "label", "spring"), e(d, "fontSize", 11), e(d, "color", "#FFFFFFFF"), o;
        })(), (() => {
          var o = a("text");
          return e(o, "label", "Throw the purple box \u2014 a SpringSimulation springs it home to the origin, seeded with your fling velocity (throw harder \u2192 springs back harder). All host-side: zero per-frame bridge traffic."), e(o, "fontSize", 11), e(o, "color", "#FF8E8E93"), o;
        })()];
      } }), v), N(y, I(W, { title: "Cross-fade \u2014 CrossFade", get children() {
        return [(() => {
          var o = a("box"), c = a("crossFade");
          return g(o, c), e(o, "height", 92), N(c, (() => {
            var d = It(() => !!T());
            return () => d() ? (() => {
              var w = a("box"), P = a("text");
              return g(w, P), e(w, "width", "fill"), e(w, "height", 92), e(w, "background", "#FF5E5CE6"), e(w, "cornerRadius", 12), e(w, "padding", 16), e(P, "label", "Panel B"), e(P, "fontSize", 16), e(P, "fontWeight", 800), e(P, "color", "#FFFFFFFF"), w;
            })() : (() => {
              var w = a("box"), P = a("text");
              return g(w, P), e(w, "width", "fill"), e(w, "height", 92), e(w, "background", "#FF0A84FF"), e(w, "cornerRadius", 12), e(w, "padding", 16), e(P, "label", "Panel A"), e(P, "fontSize", 16), e(P, "fontWeight", 800), e(P, "color", "#FFFFFFFF"), w;
            })();
          })()), o;
        })(), (() => {
          var o = a("button");
          return e(o, "label", "Swap panel"), e(o, "onClick", () => R(!T())), o;
        })(), (() => {
          var o = a("text");
          return e(o, "label", "AnimatedSwitcher fades the old child out as the new fades in \u2014 the outgoing element is retained through the fade."), e(o, "fontSize", 11), e(o, "color", "#FF8E8E93"), o;
        })()];
      } }), v), N(y, I(W, { title: "Animated list \u2014 AnimatedList", get children() {
        return [(() => {
          var o = a("animatedList");
          return e(o, "gap", 8), N(o, I(ae, { get each() {
            return $();
          }, children: (c) => (() => {
            var d = a("box"), w = a("text");
            return g(d, w), e(d, "background", "#FFEFEFF4"), e(d, "cornerRadius", 8), e(d, "padding", 12), e(w, "label", c), e(w, "fontSize", 13), e(w, "color", "#FF1C1C1E"), d;
          })() })), o;
        })(), (() => {
          var o = a("row"), c = a("button"), d = a("button");
          return g(o, c), g(o, d), e(o, "gap", 8), e(c, "label", "Add"), e(c, "onClick", () => h([...$(), `Item ${++_}`])), e(d, "label", "Remove"), e(d, "onClick", () => h($().slice(0, -1))), o;
        })(), (() => {
          var o = a("text");
          return e(o, "label", "Add \u2192 a row fades + expands in; Remove \u2192 it collapses + fades out. Both host-side, via deferred teardown."), e(o, "fontSize", 11), e(o, "color", "#FF8E8E93"), o;
        })()];
      } }), v), N(y, I(W, { title: "Shared element \u2014 Hero", get children() {
        return [(() => {
          var o = a("box");
          return e(o, "height", 300), e(o, "borderWidth", 1), e(o, "borderColor", "#FFE5E5EA"), e(o, "cornerRadius", 8), N(o, I(b.View, {})), o;
        })(), (() => {
          var o = a("text");
          return e(o, "label", "A Hero with a matching tag on each screen flies between them across the navigator push \u2014 the navigator is a real Flutter Navigator."), e(o, "fontSize", 11), e(o, "color", "#FF8E8E93"), o;
        })()];
      } }), v), e(v, "label", "\u2014 end of animations \u2014"), e(v, "fontSize", 12), e(v, "color", "#FF8E8E93"), y;
    })();
  }
  function _i() {
    const [t, r] = V("material"), [n, l] = V(false), [s, f] = V(true), [S, E] = V(false), [A, x] = V(40), [T, R] = V(""), [$, h] = V("none yet"), [_, b] = V(0), [y, L] = V(["Item one", "Item two", "Item three", "Item four"]);
    let p = 0;
    const [v, o] = V("0, 0"), [c, d] = V("\u2014"), [w, P] = V(1);
    let k = 1;
    const [K, J] = V("\u2014 try a dialog button \u2014"), [ne, de] = V(["First item", "Second item", "Third item", "Fourth item"]), Me = Nt({ list: { component: (se) => I(di, { get router() {
      return se.router;
    } }), title: "Mailboxes" }, detail: (se) => I(gi, { get name() {
      return se.params.name;
    }, get router() {
      return se.router;
    } }) }, "list"), [Ue, zt] = V(0), Vt = (se, M) => {
      r(se), l(M), Ln(se, M ? 1 : 0);
    }, Pi = Nt({ home: { component: (se) => Ti(se.router) }, animations: { component: () => I(Fi, {}), title: "Animations" } }, "home");
    function Ti(se) {
      return (() => {
        var M = a("scrollView"), Xe = a("text"), ct = a("text"), Y = a("text");
        return g(M, Xe), g(M, ct), g(M, Y), e(M, "background", "#FFF2F2F7"), e(M, "padding", 16), e(M, "gap", 14), e(Xe, "label", "Skal \u2014 Component Demo"), e(Xe, "fontSize", 24), e(Xe, "fontWeight", 800), e(Xe, "color", "#FF1C1C1E"), e(ct, "label", "Every fast-path widget, plus animation, the design system, and dialogs."), e(ct, "fontSize", 13), e(ct, "color", "#FF8E8E93"), N(M, I(W, { title: "Design system \u2014 setDesign()", get children() {
          return [(() => {
            var i = a("text");
            return e(i, "fontSize", 13), e(i, "color", "#FF8E8E93"), z((u) => e(i, "label", `active: ${t()} \xB7 ${n() ? "dark" : "light"}`, u)), i;
          })(), (() => {
            var i = a("row"), u = a("button"), F = a("button"), m = a("button");
            return g(i, u), g(i, F), g(i, m), e(i, "gap", 8), e(u, "label", "Material"), e(u, "onClick", () => Vt("material", n())), e(F, "label", "Cupertino"), e(F, "onClick", () => Vt("cupertino", n())), e(m, "onClick", () => Vt(t(), !n())), z((D) => e(m, "label", n() ? "Light mode" : "Dark mode", D)), i;
          })(), (() => {
            var i = a("text");
            return e(i, "label", "Buttons, switches, sliders, the text field & spinner all swap Material\u2194Cupertino."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })()];
        } }), Y), N(M, I(W, { title: "Layout \u2014 box \xB7 row \xB7 wrap", get children() {
          return [(() => {
            var i = a("row"), u = a("box"), F = a("box"), m = a("box");
            return g(i, u), g(i, F), g(i, m), e(i, "gap", 8), e(u, "width", 56), e(u, "height", 56), e(u, "background", "#FF0A84FF"), e(u, "cornerRadius", 10), e(F, "width", 56), e(F, "height", 56), e(F, "background", "#FF34C759"), e(F, "cornerRadius", 10), e(m, "width", 56), e(m, "height", 56), e(m, "background", "#FFFF9F0A"), e(m, "cornerRadius", 10), i;
          })(), (() => {
            var i = a("text");
            return e(i, "label", "Wrap \u2014 children flow onto new runs:"), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = a("wrap");
            return e(i, "gap", 6), N(i, I(ae, { each: ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa"], children: (u) => (() => {
              var F = a("box"), m = a("text");
              return g(F, m), e(F, "background", "#FFEFEFF4"), e(F, "cornerRadius", 12), e(F, "paddingLeft", 10), e(F, "paddingRight", 10), e(F, "paddingTop", 6), e(F, "paddingBottom", 6), e(m, "label", u), e(m, "fontSize", 12), e(m, "color", "#FF1C1C1E"), F;
            })() })), i;
          })()];
        } }), Y), N(M, I(W, { title: "Stack \u2014 overlap + positioned children", get children() {
          var i = a("stack"), u = a("box"), F = a("box"), m = a("text"), D = a("box");
          return g(i, u), g(i, F), g(i, D), e(i, "width", "fill"), e(i, "height", 120), e(u, "width", "fill"), e(u, "height", 120), e(u, "background", "#FF5E5CE6"), e(u, "cornerRadius", 12), g(F, m), e(F, "top", 10), e(F, "left", 10), e(F, "background", "#FFFFFFFF"), e(F, "cornerRadius", 8), e(F, "paddingLeft", 10), e(F, "paddingRight", 10), e(F, "paddingTop", 4), e(F, "paddingBottom", 4), e(m, "label", "top \xB7 left"), e(m, "fontSize", 11), e(m, "color", "#FF1C1C1E"), e(D, "bottom", 10), e(D, "right", 10), e(D, "width", 30), e(D, "height", 30), e(D, "background", "#FFFF3B30"), e(D, "cornerRadius", 15), i;
        } }), Y), N(M, I(W, { title: "Text & RichText", get children() {
          return [(() => {
            var i = a("text");
            return e(i, "label", "Styled text \u2014 18sp, weight 700."), e(i, "fontSize", 18), e(i, "fontWeight", 700), e(i, "color", "#FF1C1C1E"), i;
          })(), (() => {
            var i = a("richText"), u = a("text"), F = a("text"), m = a("text"), D = a("text"), U = a("text");
            return g(i, u), g(i, F), g(i, m), g(i, D), g(i, U), e(u, "label", "Rich text "), e(u, "fontSize", 16), e(u, "color", "#FF1C1C1E"), e(F, "label", "mixes "), e(F, "fontSize", 16), e(F, "color", "#FF0A84FF"), e(F, "fontWeight", 800), e(m, "label", "size, "), e(m, "fontSize", 22), e(m, "color", "#FFFF3B30"), e(m, "fontWeight", 700), e(D, "label", "weight "), e(D, "fontSize", 16), e(D, "color", "#FF34C759"), e(D, "fontWeight", 800), e(U, "label", "and colour inline."), e(U, "fontSize", 16), e(U, "color", "#FF1C1C1E"), i;
          })()];
        } }), Y), N(M, I(W, { title: "Image \u2014 network \xB7 BoxFit \xB7 rounded", get children() {
          return [(() => {
            var i = a("image");
            return e(i, "src", "https://picsum.photos/seed/skal/640/360"), e(i, "width", "fill"), e(i, "height", 160), e(i, "contentScale", 1), e(i, "cornerRadius", 12), i;
          })(), (() => {
            var i = a("text");
            return e(i, "label", "contentScale=1 (cover); cornerRadius clips the pixels. Requires network."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })()];
        } }), Y), N(M, I(W, { title: "Scrolling \u2014 horizontal list \xB7 lazy grid \xB7 reorderable", get children() {
          return [(() => {
            var i = a("text");
            return e(i, "label", "listView axis=1 (horizontal, virtualized):"), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = a("listView");
            return e(i, "axis", 1), e(i, "height", 66), e(i, "gap", 8), N(i, I(ae, { each: [st, Dt, Lt, Pr, Rr, "#FF00C7BE", "#FFAF52DE", "#FFFFD60A"], children: (u) => (() => {
              var F = a("box");
              return e(F, "width", 66), e(F, "height", 50), e(F, "background", u), e(F, "cornerRadius", 10), F;
            })() })), i;
          })(), (() => {
            var i = a("text");
            return e(i, "label", "lazyGrid \u2014 crossAxisCount=4:"), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = a("lazyGrid");
            return e(i, "crossAxisCount", 4), e(i, "aspectRatio", 1), e(i, "gap", 8), e(i, "height", 150), N(i, I(ae, { get each() {
              return Array.from({ length: 12 }, (u, F) => F);
            }, children: (u) => (() => {
              var F = a("box");
              return e(F, "background", u % 3 === 0 ? st : u % 3 === 1 ? Dt : Lt), e(F, "cornerRadius", 8), F;
            })() })), i;
          })(), (() => {
            var i = a("text");
            return e(i, "label", "reorderableListView \u2014 drag a row to reorder:"), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = a("reorderableListView");
            return e(i, "height", 200), e(i, "gap", 6), e(i, "onReorder", (u, F) => {
              const m = ne().slice(), [D] = m.splice(u, 1);
              m.splice(F, 0, D), de(m);
            }), N(i, I(ae, { get each() {
              return ne();
            }, children: (u) => (() => {
              var F = a("box"), m = a("text");
              return g(F, m), e(F, "background", "#FFEFEFF4"), e(F, "cornerRadius", 8), e(F, "padding", 12), e(m, "label", u), e(m, "fontSize", 13), e(m, "color", "#FF1C1C1E"), F;
            })() })), i;
          })()];
        } }), Y), N(M, I(W, { title: "Controls \u2014 switch \xB7 checkbox \xB7 slider \xB7 text field", get children() {
          return [(() => {
            var i = a("row"), u = a("switch"), F = a("text");
            return g(i, u), g(i, F), e(i, "gap", 12), e(u, "onChange", (m) => f(m)), e(F, "fontSize", 13), e(F, "color", "#FF1C1C1E"), z((m) => {
              var D = s(), U = s() ? "switch: on" : "switch: off";
              return D !== m.e && (m.e = e(u, "checked", D, m.e)), U !== m.t && (m.t = e(F, "label", U, m.t)), m;
            }, { e: undefined, t: undefined }), i;
          })(), (() => {
            var i = a("row"), u = a("checkbox"), F = a("text");
            return g(i, u), g(i, F), e(i, "gap", 12), e(u, "onChange", (m) => E(m)), e(F, "fontSize", 13), e(F, "color", "#FF1C1C1E"), z((m) => {
              var D = S(), U = S() ? "checkbox: checked" : "checkbox: unchecked";
              return D !== m.e && (m.e = e(u, "checked", D, m.e)), U !== m.t && (m.t = e(F, "label", U, m.t)), m;
            }, { e: undefined, t: undefined }), i;
          })(), (() => {
            var i = a("slider");
            return e(i, "min", 0), e(i, "max", 100), e(i, "onChange", (u) => x(u)), z((u) => e(i, "value", A(), u)), i;
          })(), (() => {
            var i = a("text");
            return e(i, "fontSize", 13), e(i, "color", "#FF1C1C1E"), z((u) => e(i, "label", `slider: ${Math.round(A())}`, u)), i;
          })(), (() => {
            var i = a("textInput");
            return e(i, "placeholder", "Type your name\u2026"), e(i, "onChange", (u) => R(u)), e(i, "onSubmit", (u) => gr(`Submitted: ${u}`)), z((u) => e(i, "value", T(), u)), i;
          })(), (() => {
            var i = a("text");
            return e(i, "fontSize", 13), e(i, "color", "#FF8E8E93"), z((u) => e(i, "label", T() ? `Hello, ${T()}!` : "\u2014 type above; press Enter to submit \u2014", u)), i;
          })()];
        } }), Y), N(M, I(W, { title: "Indicators \u2014 spinner \xB7 progress bar", get children() {
          return [(() => {
            var i = a("row"), u = a("activityIndicator"), F = a("text");
            return g(i, u), g(i, F), e(i, "gap", 12), e(u, "color", "#FF0A84FF"), e(F, "label", "CircularProgressIndicator"), e(F, "fontSize", 13), e(F, "color", "#FF1C1C1E"), i;
          })(), (() => {
            var i = a("text");
            return e(i, "label", "determinate \u2014 tracks the slider above:"), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = a("progressBar");
            return e(i, "color", "#FF0A84FF"), z((u) => e(i, "progress", A() / 100, u)), i;
          })(), (() => {
            var i = a("text");
            return e(i, "label", "indeterminate:"), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = a("progressBar");
            return e(i, "color", "#FF34C759"), i;
          })()];
        } }), Y), N(M, I(W, { title: "Animation", get children() {
          return [(() => {
            var i = a("text");
            return e(i, "label", "Implicit tweens, looping, list enter/exit, Hero \u2014 all host-side, zero per-frame bridge traffic. Opens a dedicated page."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = a("button");
            return e(i, "label", "Open Animations \u2192"), e(i, "onClick", () => se.navigate("animations")), i;
          })()];
        } }), Y), N(M, I(W, { title: "ListTile \u2014 structured rows", get children() {
          return [(() => {
            var i = a("box"), u = a("column"), F = a("listTile"), m = a("listTile"), D = a("listTile");
            return g(i, u), e(i, "background", "#FFFFFFFF"), e(i, "cornerRadius", 12), e(i, "borderWidth", 1), e(i, "borderColor", "#FFE5E5EA"), g(u, F), g(u, m), g(u, D), e(u, "padding", 0), e(u, "gap", 0), e(F, "leadingIcon", "person"), e(F, "title", "Profile"), e(F, "subtitle", "Name, photo, bio"), e(F, "trailingIcon", "explore"), e(F, "onClick", () => h("tapped Profile")), e(m, "leadingIcon", "bell"), e(m, "title", "Notifications"), e(m, "subtitle", "Sounds, badges, alerts"), e(m, "trailingIcon", "explore"), e(m, "onClick", () => h("tapped Notifications")), e(D, "leadingIcon", "settings"), e(D, "title", "Settings"), e(D, "trailingIcon", "explore"), e(D, "onClick", () => h("tapped Settings")), i;
          })(), (() => {
            var i = a("text");
            return e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), z((u) => e(i, "label", `last row: ${$()}`, u)), i;
          })()];
        } }), Y), N(M, I(W, { title: "PageView \u2014 swipe between pages", get children() {
          return [(() => {
            var i = a("box"), u = a("pageView"), F = a("box"), m = a("text"), D = a("box"), U = a("text"), te = a("box"), ie = a("text");
            return g(i, u), e(i, "height", 140), g(u, F), g(u, D), g(u, te), e(u, "onChange", (ge) => b(ge)), g(F, m), e(F, "width", "fill"), e(F, "height", 140), e(F, "background", "#FF0A84FF"), e(F, "cornerRadius", 12), e(F, "padding", 20), e(m, "label", "Page 1 \u2014 swipe \u2192"), e(m, "fontSize", 16), e(m, "fontWeight", 800), e(m, "color", "#FFFFFFFF"), g(D, U), e(D, "width", "fill"), e(D, "height", 140), e(D, "background", "#FF34C759"), e(D, "cornerRadius", 12), e(D, "padding", 20), e(U, "label", "Page 2"), e(U, "fontSize", 16), e(U, "fontWeight", 800), e(U, "color", "#FFFFFFFF"), g(te, ie), e(te, "width", "fill"), e(te, "height", 140), e(te, "background", "#FFFF9F0A"), e(te, "cornerRadius", 12), e(te, "padding", 20), e(ie, "label", "Page 3"), e(ie, "fontSize", 16), e(ie, "fontWeight", 800), e(ie, "color", "#FFFFFFFF"), z((ge) => e(u, "activeTab", _(), ge)), i;
          })(), (() => {
            var i = a("row"), u = a("button"), F = a("button");
            return g(i, u), g(i, F), e(i, "gap", 8), e(u, "label", "\u25C0 Prev"), e(u, "onClick", () => b(Math.max(0, _() - 1))), e(F, "label", "Next \u25B6"), e(F, "onClick", () => b(Math.min(2, _() + 1))), i;
          })(), (() => {
            var i = a("text");
            return e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), z((u) => e(i, "label", `page ${_() + 1} of 3 \u2014 swipe or use the buttons`, u)), i;
          })()];
        } }), Y), N(M, I(W, { title: "Pull-to-refresh + swipe-to-dismiss", get children() {
          return [(() => {
            var i = a("box"), u = a("listView");
            return g(i, u), e(i, "height", 210), e(i, "borderWidth", 1), e(i, "borderColor", "#FFE5E5EA"), e(i, "cornerRadius", 8), e(u, "onRefresh", async () => {
              await new Promise((F) => setTimeout(F, 900)), L([`Fresh item ${++p}`, ...y()]);
            }), N(u, I(ae, { get each() {
              return y();
            }, children: (F) => (() => {
              var m = a("dismissible"), D = a("box"), U = a("text");
              return g(m, D), e(m, "onDismiss", () => L(y().filter((te) => te !== F))), g(D, U), e(D, "width", "fill"), e(D, "background", "#FFEFEFF4"), e(D, "cornerRadius", 8), e(D, "padding", 14), e(U, "label", F), e(U, "fontSize", 13), e(U, "color", "#FF1C1C1E"), m;
            })() })), i;
          })(), (() => {
            var i = a("text");
            return e(i, "label", "Pull the list down to refresh (a 900ms async task \u2014 the spinner waits for it); swipe any row sideways to dismiss it."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })()];
        } }), Y), N(M, I(W, { title: "Gestures \u2014 onTap \xB7 onLongPress \xB7 onDoubleTap", get children() {
          return [(() => {
            var i = a("box"), u = a("text");
            return g(i, u), e(i, "background", "#FFEFEFF4"), e(i, "cornerRadius", 12), e(i, "padding", 22), e(i, "onTap", () => h("onTap")), e(i, "onLongPress", () => h("onLongPress")), e(i, "onDoubleTap", () => h("onDoubleTap")), e(u, "label", "Tap / long-press / double-tap this box"), e(u, "fontSize", 13), e(u, "color", "#FF1C1C1E"), i;
          })(), (() => {
            var i = a("text");
            return e(i, "fontSize", 12), e(i, "color", "#FF8E8E93"), z((u) => e(i, "label", `last gesture: ${$()}`, u)), i;
          })()];
        } }), Y), N(M, I(W, { title: "Drag \u2014 draggable (zero per-frame bridge traffic)", get children() {
          return [(() => {
            var i = a("box"), u = a("box"), F = a("text");
            return g(i, u), e(i, "height", 150), e(i, "background", "#FFEFEFF4"), e(i, "cornerRadius", 12), g(u, F), e(u, "draggable", true), e(u, "width", 64), e(u, "height", 64), e(u, "background", "#FF0A84FF"), e(u, "cornerRadius", 14), e(u, "onPanEnd", (m, D) => o(`${m.toFixed(0)}, ${D.toFixed(0)}`)), e(F, "label", "drag"), e(F, "fontSize", 12), e(F, "color", "#FFFFFFFF"), i;
          })(), (() => {
            var i = a("text");
            return e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), z((u) => e(i, "label", `Drag the blue box \u2014 the host moves it itself, no event per frame. Resting offset: ${v()}`, u)), i;
          })()];
        } }), Y), N(M, I(W, { title: "Pan \u2014 onPanUpdate delta stream", get children() {
          return [(() => {
            var i = a("box"), u = a("text");
            return g(i, u), e(i, "height", 70), e(i, "background", "#FFEFEFF4"), e(i, "cornerRadius", 12), e(i, "padding", 16), e(i, "onPanStart", () => d("drag started")), e(i, "onPanUpdate", (F, m) => d(`dx ${F.toFixed(1)}  dy ${m.toFixed(1)}`)), e(i, "onPanEnd", (F, m) => d(`fling v ${F.toFixed(0)}, ${m.toFixed(0)} dp/s`)), e(u, "label", "Drag anywhere on this strip"), e(u, "fontSize", 13), e(u, "color", "#FF1C1C1E"), i;
          })(), (() => {
            var i = a("text");
            return e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), z((u) => e(i, "label", `onPanUpdate: ${c()}`, u)), i;
          })()];
        } }), Y), N(M, I(W, { title: "Scale \u2014 onScaleUpdate (pinch / rotate)", get children() {
          return [(() => {
            var i = a("box"), u = a("box"), F = a("text");
            return g(i, u), e(i, "height", 170), e(i, "background", "#FFEFEFF4"), e(i, "cornerRadius", 12), g(u, F), e(u, "width", 96), e(u, "height", 96), e(u, "background", "#FF5E5CE6"), e(u, "cornerRadius", 16), e(u, "onScaleStart", () => {
              k = w();
            }), e(u, "onScaleUpdate", (m) => P(Math.max(0.3, k * m))), e(F, "label", "pinch"), e(F, "fontSize", 13), e(F, "color", "#FFFFFFFF"), z((m) => {
              var D = w(), U = w();
              return D !== m.e && (m.e = e(u, "scaleX", D, m.e)), U !== m.t && (m.t = e(u, "scaleY", U, m.t)), m;
            }, { e: undefined, t: undefined }), i;
          })(), (() => {
            var i = a("text");
            return e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), z((u) => e(i, "label", `Pinch the purple box (two pointers / trackpad). Scale \xD7${w().toFixed(2)}`, u)), i;
          })()];
        } }), Y), N(M, I(W, { title: "Dialogs \u2014 imperative JS API", get children() {
          return [(() => {
            var i = a("row"), u = a("button"), F = a("button");
            return g(i, u), g(i, F), e(i, "gap", 8), e(u, "label", "Alert"), e(u, "onClick", async () => {
              await dr({ title: "Heads up", message: "A plain alert dialog.", actions: [{ label: "OK", value: "ok" }] }), J("alert: dismissed");
            }), e(F, "label", "Confirm"), e(F, "onClick", async () => {
              J(`confirm \u2192 ${await dr({ title: "Delete file?", message: "This cannot be undone.", actions: [{ label: "Cancel", value: "cancel" }, { label: "Delete", value: "delete", style: "destructive" }] }) ?? "dismissed"}`);
            }), i;
          })(), (() => {
            var i = a("row"), u = a("button"), F = a("button");
            return g(i, u), g(i, F), e(i, "gap", 8), e(u, "label", "Action sheet"), e(u, "onClick", async () => {
              J(`sheet \u2192 ${await Vn({ title: "Choose an action", actions: [{ label: "Copy", value: "copy" }, { label: "Share", value: "share" }, { label: "Delete", value: "delete", style: "destructive" }] }) ?? "cancelled"}`);
            }), e(F, "label", "Snackbar"), e(F, "onClick", () => {
              gr("Hello from a snackbar \uD83D\uDC4B"), J("snackbar: shown");
            }), i;
          })(), (() => {
            var i = a("text");
            return e(i, "fontSize", 12), e(i, "color", "#FF8E8E93"), z((u) => e(i, "label", K(), u)), i;
          })()];
        } }), Y), N(M, I(W, { title: "Navigation \u2014 push / pop with keep-alive", get children() {
          return [(() => {
            var i = a("text");
            return e(i, "label", "Tap a mailbox to push a screen; the AppBar back button (or system back) pops. Native transition; the screen behind stays mounted."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = a("box");
            return e(i, "height", 320), e(i, "borderWidth", 1), e(i, "borderColor", "#FFE5E5EA"), N(i, I(Me.View, {})), i;
          })()];
        } }), Y), N(M, I(W, { title: "Tabs \u2014 bottom bar with keep-alive", get children() {
          return [(() => {
            var i = a("text");
            return e(i, "label", "Every tab subtree is built once and kept alive (IndexedStack) \u2014 switching never re-mounts; scroll & state survive."), e(i, "fontSize", 11), e(i, "color", "#FF8E8E93"), i;
          })(), (() => {
            var i = a("box"), u = a("tabs"), F = a("tab"), m = a("column"), D = a("text"), U = a("text"), te = a("tab"), ie = a("column"), ge = a("text"), Ar = a("textInput"), ut = a("tab"), me = a("column"), Ye = a("text"), ft = a("text");
            return g(i, u), e(i, "height", 280), e(i, "borderWidth", 1), e(i, "borderColor", "#FFE5E5EA"), e(i, "cornerRadius", 8), g(u, F), g(u, te), g(u, ut), e(u, "onChange", zt), e(u, "height", "fill"), g(F, m), e(F, "title", "Home"), e(F, "icon", "home"), g(m, D), g(m, U), e(m, "background", "#FFF2F2F7"), e(m, "padding", 16), e(m, "gap", 8), e(m, "height", "fill"), e(D, "label", "Home"), e(D, "fontSize", 20), e(D, "fontWeight", 800), e(D, "color", "#FF1C1C1E"), e(U, "label", "Switch tabs and come back \u2014 this tab was never torn down."), e(U, "fontSize", 13), e(U, "color", "#FF8E8E93"), g(te, ie), e(te, "title", "Search"), e(te, "icon", "search"), g(ie, ge), g(ie, Ar), e(ie, "background", "#FFF2F2F7"), e(ie, "padding", 16), e(ie, "gap", 8), e(ie, "height", "fill"), e(ge, "label", "Search"), e(ge, "fontSize", 20), e(ge, "fontWeight", 800), e(ge, "color", "#FF1C1C1E"), e(Ar, "placeholder", "Type to search\u2026"), g(ut, me), e(ut, "title", "Profile"), e(ut, "icon", "person"), g(me, Ye), g(me, ft), e(me, "background", "#FFF2F2F7"), e(me, "padding", 16), e(me, "gap", 8), e(me, "height", "fill"), e(Ye, "label", "Profile"), e(Ye, "fontSize", 20), e(Ye, "fontWeight", 800), e(Ye, "color", "#FF1C1C1E"), e(ft, "fontSize", 13), e(ft, "color", "#FF8E8E93"), z((Re) => {
              var yr = Ue(), $r = `active tab index: ${Ue()}`;
              return yr !== Re.e && (Re.e = e(u, "activeTab", yr, Re.e)), $r !== Re.t && (Re.t = e(ft, "label", $r, Re.t)), Re;
            }, { e: undefined, t: undefined }), i;
          })()];
        } }), Y), N(M, I(W, { title: "SafeArea", get children() {
          var i = a("safeArea"), u = a("box"), F = a("text");
          return g(i, u), g(u, F), e(u, "background", "#FFEFEFF4"), e(u, "cornerRadius", 8), e(u, "padding", 14), e(F, "label", "Insets past notches & system bars. (No visible effect here \u2014 the app root already applies one.)"), e(F, "fontSize", 12), e(F, "color", "#FF1C1C1E"), i;
        } }), Y), e(Y, "label", "\u2014 end of UI demo \u2014"), e(Y, "fontSize", 12), e(Y, "color", "#FF8E8E93"), M;
      })();
    }
    return I(Pi.View, {});
  }
  var Tr = ["Just shipped a new feature, feeling great about how it turned out \uD83D\uDE80", "Hot take: the best APIs are the ones you don't have to read docs for", "Spent the morning refactoring legacy code \u2014 so much cleaner now", "There's no such thing as 'just a small change' in production code", "If your tests are slow, that's a smell. Fast tests = good tests", "Bun's startup time keeps surprising me, even after a year", "Why is naming things still the hardest part of programming?", "Found a 10\xD7 speedup in a critical path today. Profilers, not guesses", "Reading 'The Art of Unix Programming' for the third time", "Premature abstraction is somehow worse than premature optimization", "Latency is a feature, throughput is an artifact of how you measure", "Half of debugging is admitting your assumption was wrong", "You don't ship the codebase you have. You ship the codebase you understand", "Cache invalidation, naming things, off-by-one. The classics", "Every config file format eventually grows a turing-complete templating layer"], bi = Array.from({ length: 15000 }, (t, r) => ({ author: `@user${r * 2654435761 >>> 17}`, body: Tr[r % Tr.length], num: r + 1 })), vi = [50, 200, 500, 1000, 2000, 5000, 1e4], Or = "#FFF1F5F9", xr = "#FF475569", Ei = "#FF22C55E", pi = "#FFEF4444", Cr = "#FFFFFFFF";
  function Si(t) {
    const [r, n] = V(0), [l, s] = V(false), [f, S] = V(0), [E, A] = V(false);
    return (() => {
      var x = a("column"), T = a("text"), R = a("text"), $ = a("row"), h = a("button"), _ = a("button");
      return g(x, T), g(x, R), g(x, $), e(x, "background", "#FFFFFFFF"), e(x, "padding", 12), e(x, "cornerRadius", 10), e(x, "borderWidth", 1), e(x, "borderColor", "#FFE5E5EA"), e(x, "gap", 6), e(T, "fontWeight", 700), e(T, "fontSize", 14), e(T, "color", "#FF1DA1F2"), e(R, "fontSize", 14), e(R, "color", "#FF1F2937"), e(R, "maxLines", 3), e(R, "textOverflow", 1), g($, h), g($, _), e($, "gap", 10), e(h, "fontSize", 12), e(h, "padding", 6), e(h, "cornerRadius", 16), e(h, "onClick", () => {
        const b = !l();
        s(b), n(r() + (b ? 1 : -1));
      }), e(_, "fontSize", 12), e(_, "padding", 6), e(_, "cornerRadius", 16), e(_, "onClick", () => {
        const b = !E();
        A(b), S(f() + (b ? 1 : -1));
      }), z((b) => {
        var y = `#${t.num} \xB7 ${t.author}`, L = t.body, p = `\u2665 ${r()}`, v = l() ? Ei : Or, o = l() ? Cr : xr, c = `\u21A9 ${f()}`, d = E() ? pi : Or, w = E() ? Cr : xr;
        return y !== b.e && (b.e = e(T, "label", y, b.e)), L !== b.t && (b.t = e(R, "label", L, b.t)), p !== b.a && (b.a = e(h, "label", p, b.a)), v !== b.o && (b.o = e(h, "background", v, b.o)), o !== b.i && (b.i = e(h, "color", o, b.i)), c !== b.n && (b.n = e(_, "label", c, b.n)), d !== b.s && (b.s = e(_, "background", d, b.s)), w !== b.h && (b.h = e(_, "color", w, b.h)), b;
      }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined, n: undefined, s: undefined, h: undefined }), x;
    })();
  }
  function wi() {
    const [t, r] = V(50), [n, l] = V(""), s = Ke(() => bi.slice(0, t()));
    return (() => {
      var f = a("listView"), S = a("text"), E = a("text"), A = a("wrap"), x = a("text");
      return g(f, S), g(f, E), g(f, A), g(f, x), e(f, "background", "#FFF2F2F7"), e(f, "padding", 16), e(f, "gap", 12), e(S, "label", "Tweet feed \u2014 virtualized"), e(S, "fontSize", 24), e(S, "fontWeight", 800), e(S, "color", "#FF1C1C1E"), e(E, "label", "ListView.builder materializes only the visible window; the source pool is 15 000 items. Tap a count to mount N."), e(E, "fontSize", 13), e(E, "color", "#FF8E8E93"), e(A, "gap", 6), N(A, I(ae, { each: vi, children: (T) => (() => {
        var R = a("button");
        return e(R, "label", `${T}`), e(R, "onClick", () => {
          const $ = performance.now();
          try {
            r(T), l(`mounted ${T} in ${(performance.now() - $).toFixed(2)} ms`);
          } catch (h) {
            l(`ERROR @ ${T}: ${h && (h.message || String(h)) || "unknown"}`);
          }
        }), R;
      })() })), e(x, "fontSize", 12), e(x, "color", "#FF8E8E93"), N(f, I(ae, { get each() {
        return s();
      }, children: (T) => I(Si, { get author() {
        return T.author;
      }, get body() {
        return T.body;
      }, get num() {
        return T.num;
      } }) }), null), z((T) => e(x, "label", n() || `showing ${t()} tweets`, T)), f;
    })();
  }
  function mi() {
    const [t, r] = V("\u2014 waiting for counter events \u2014"), n = fi(), [l, s] = V("\u2014 tap a button to RPC the Ticker \u2014"), [f, S] = V(null), [E, A] = V(false);
    return (() => {
      var x = a("scrollView"), T = a("text"), R = a("text"), $ = a("text");
      return g(x, T), g(x, R), g(x, $), e(x, "background", "#FFF2F2F7"), e(x, "padding", 16), e(x, "gap", 14), e(T, "label", "Libraries \u2014 codegen-wrapped widgets"), e(T, "fontSize", 24), e(T, "fontWeight", 800), e(T, "color", "#FF1C1C1E"), e(R, "label", "Custom adapters + real pub.dev packages, brought into JSX by skal_codegen. Imported from 'skal-flutter'."), e(R, "fontSize", 13), e(R, "color", "#FF8E8E93"), N(x, I(W, { title: "Greeting \u2014 hand-written adapter", get children() {
        var h = a("greeting");
        return e(h, "name", "Skal"), e(h, "color", "#FF1DA1F2"), e(h, "fontSize", 20), h;
      } }), $), N(x, I(W, { title: "Shimmer \u2014 pub.dev, named-ctor wrap", get children() {
        return [(() => {
          var h = a("text");
          return e(h, "label", "ShimmerFromColors \u2014 codegen-synthesized from the Shimmer.fromColors named constructor."), e(h, "fontSize", 11), e(h, "color", "#FF8E8E93"), h;
        })(), (() => {
          var h = a("shimmerFromColors"), _ = a("greeting");
          return g(h, _), e(h, "baseColor", 4290624957), e(h, "highlightColor", 4292927712), e(h, "period", 1500), e(_, "name", "loading\u2026"), e(_, "color", "#FF333333"), e(_, "fontSize", 28), h;
        })()];
      } }), $), N(x, I(W, { title: "QR code \u2014 qr_flutter, pub.dev wrap", get children() {
        return [(() => {
          var h = a("qrImageView");
          return e(h, "data", "https://skal.dev"), e(h, "size", 200), h;
        })(), (() => {
          var h = a("text");
          return e(h, "label", "QrImageView, generated against qr_flutter's class."), e(h, "fontSize", 11), e(h, "color", "#FF8E8E93"), h;
        })()];
      } }), $), N(x, I(W, { title: "Camera \u2014 host-pattern wrap (controller lifecycle)", get children() {
        return [(() => {
          var h = a("text");
          return e(h, "label", "A synthesized _CameraHost owns the CameraController (init in initState, dispose on unmount). The controller initializes only once Start mounts <Camera> \u2014 no camera / permission \u2192 an inline error banner."), e(h, "fontSize", 11), e(h, "color", "#FF8E8E93"), h;
        })(), (() => {
          var h = a("button");
          return e(h, "onClick", () => A(!E())), z((_) => e(h, "label", E() ? "Stop camera" : "Start camera", _)), h;
        })(), It(() => It(() => !!E())() && (() => {
          var h = a("box"), _ = a("camera");
          return g(h, _), e(h, "background", "#FF000000"), e(h, "padding", 4), e(h, "cornerRadius", 8), e(_, "resolutionIndex", 1), h;
        })())];
      } }), $), N(x, I(W, { title: "Counter \u2014 typed callbacks back to JSX", get children() {
        return [(() => {
          var h = a("counter");
          return e(h, "initial", 0), e(h, "onChanged", (_) => r(`onChanged(${_})`)), e(h, "onReset", () => r("onReset()")), h;
        })(), (() => {
          var h = a("text");
          return e(h, "fontSize", 13), e(h, "color", "#FF1C1C1E"), z((_) => e(h, "label", t(), _)), h;
        })()];
      } }), $), N(x, I(W, { title: "Ticker \u2014 JS \u2192 Dart imperative RPC", get children() {
        return [(() => {
          var h = a("ticker");
          return ci(n, h), e(h, "intervalMs", 500), h;
        })(), (() => {
          var h = a("wrap"), _ = a("button"), b = a("button"), y = a("button"), L = a("button"), p = a("button"), v = a("button"), o = a("button"), c = a("button");
          return g(h, _), g(h, b), g(h, y), g(h, L), g(h, p), g(h, v), g(h, o), g(h, c), e(h, "gap", 6), e(_, "label", "pause"), e(_, "onClick", async () => {
            await n.pause(), s("pause() \u2713");
          }), e(b, "label", "resume"), e(b, "onClick", async () => {
            await n.resume(), s("resume() \u2713");
          }), e(y, "label", "reset"), e(y, "onClick", async () => {
            await n.reset(), s("reset() \u2713");
          }), e(L, "label", "+10"), e(L, "onClick", async () => {
            await n.bump(10), s(`bump(10), now getValue() \u2192 ${await n.getValue()}`);
          }), e(p, "label", "read"), e(p, "onClick", async () => {
            s(`getValue() \u2192 ${await n.getValue()}, isPaused() \u2192 ${await n.isPaused()}`);
          }), e(v, "label", "describe"), e(v, "onClick", async () => {
            s(`describe() \u2192 ${await n.describe("hello from JSX")}`);
          }), e(o, "label", "snapshot"), e(o, "onClick", async () => {
            const d = await n.snapshot();
            s(`snapshot() \u2192 value=${d.value} paused=${d.paused} ts=${d.timestamp}`);
          }), e(c, "label", "sub/unsub"), e(c, "onClick", () => {
            if (f())
              f()(), S(() => null), s("unsubscribed from ticks$");
            else {
              const d = n.ticks$((w) => {
                s(`stream tick: ${w}`);
              });
              S(() => d), s("subscribed to ticks$ \u2014 wait for emissions\u2026");
            }
          }), h;
        })(), (() => {
          var h = a("text");
          return e(h, "fontSize", 13), e(h, "color", "#FF1C1C1E"), z((_) => e(h, "label", l(), _)), h;
        })()];
      } }), $), N(x, I(W, { title: "Stickers \u2014 List<Widget> children + gradient prop", get children() {
        var h = a("stickers"), _ = a("greeting"), b = a("greeting"), y = a("greeting");
        return g(h, _), g(h, b), g(h, y), e(h, "gap", 6), e(h, "padding", 10), e(h, "gradient", { type: "linear", colors: ["#FFFFE082", "#FFB0F0D0", "#FFB0E0FF"], stops: [0, 0.5, 1], begin: "topLeft", end: "bottomRight" }), e(_, "name", "multi-child A"), e(_, "color", "#FF6B4F00"), e(_, "fontSize", 14), e(b, "name", "multi-child B"), e(b, "color", "#FF6B4F00"), e(b, "fontSize", 14), e(y, "name", "multi-child C"), e(y, "color", "#FF6B4F00"), e(y, "fontSize", 14), h;
      } }), $), e($, "label", "\u2014 end of Libs demo \u2014"), e($, "fontSize", 12), e($, "color", "#FF8E8E93"), x;
    })();
  }
  function Ri() {
    const [t, r] = V(0);
    return (() => {
      var n = a("tabs"), l = a("tab"), s = a("tab"), f = a("tab");
      return g(n, l), g(n, s), g(n, f), e(n, "onChange", r), e(n, "height", "fill"), e(l, "title", "UI"), e(l, "icon", "grid"), N(l, I(_i, {})), e(s, "title", "List"), e(s, "icon", "list"), N(s, I(wi, {})), e(f, "title", "Libs"), e(f, "icon", "explore"), N(f, I(mi, {})), z((S) => e(n, "activeTab", t(), S)), n;
    })();
  }
  si(() => I(Ri, {}), ui);
})();
})
