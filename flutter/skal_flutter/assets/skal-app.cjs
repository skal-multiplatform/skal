// @bun @bytecode @bun-cjs
(function(exports, require, module, __filename, __dirname) {// ../flutter/skal_flutter/assets/skal-app.js
(function() {
  var Y = { context: undefined, registry: undefined, effects: undefined, done: false, getContextId() {
    return Pt(this.context.count);
  }, getNextContextId() {
    return Pt(this.context.count++);
  } };
  function Pt(t) {
    const r = String(t), n = r.length - 1;
    return Y.context.id + (n ? String.fromCharCode(96 + n) : "") + r;
  }
  function it(t) {
    Y.context = t;
  }
  function Sr() {
    return { ...Y.context, id: Y.getNextContextId(), count: 0 };
  }
  var pr = (t, r) => t === r, ot = Symbol("solid-proxy"), wr = typeof Proxy == "function", mr = Symbol("solid-track"), Be = { equals: pr }, Ct = null, At = Dt, Q = 1, Ae = 2, yt = { owned: null, cleanups: null, context: null, owner: null }, L = null, R = null, ye = null, Ee = null, U = null, X = null, J = null, We = 0;
  function He(t, r) {
    const n = U, i = L, l = t.length === 0, u = r === undefined ? i : r, F = l ? yt : { owned: null, cleanups: null, context: u ? u.context : null, owner: u }, v = l ? t : () => t(() => Se(() => se(F)));
    L = F, U = null;
    try {
      return ae(v, true);
    } finally {
      U = n, L = i;
    }
  }
  function z(t, r) {
    r = r ? Object.assign({}, Be, r) : Be;
    const n = { value: t, observers: null, observerSlots: null, comparator: r.equals || undefined }, i = (l) => (typeof l == "function" && (R && R.running && R.sources.has(n) ? l = l(n.tValue) : l = l(n.value)), It(n, l));
    return [$t.bind(n), i];
  }
  function le(t, r, n) {
    const i = lt(t, r, false, Q);
    ye && R && R.running ? X.push(i) : xe(i);
  }
  function Rr(t, r, n) {
    At = Ar;
    const i = lt(t, r, false, Q), l = at && Or(at);
    l && (i.suspense = l), (!n || !n.render) && (i.user = true), J ? J.push(i) : xe(i);
  }
  function Me(t, r, n) {
    n = n ? Object.assign({}, Be, n) : Be;
    const i = lt(t, r, true, 0);
    return i.observers = null, i.observerSlots = null, i.comparator = n.equals || undefined, ye && R && R.running ? (i.tState = Q, X.push(i)) : xe(i), $t.bind(i);
  }
  function Se(t) {
    if (!Ee && U === null)
      return t();
    const r = U;
    U = null;
    try {
      return Ee ? Ee.untrack(t) : t();
    } finally {
      U = r;
    }
  }
  function xt(t) {
    return L === null || (L.cleanups === null ? L.cleanups = [t] : L.cleanups.push(t)), t;
  }
  function Tr(t) {
    if (R && R.running)
      return t(), R.done;
    const r = U, n = L;
    return Promise.resolve().then(() => {
      U = r, L = n;
      let i;
      return (ye || at) && (i = R || (R = { sources: new Set, effects: [], promises: new Set, disposed: new Set, queue: new Set, running: true }), i.done || (i.done = new Promise((l) => i.resolve = l)), i.running = true), ae(t, false), U = L = null, i ? i.done : undefined;
    });
  }
  var [hi, kt] = z(false);
  function Or(t) {
    let r;
    return L && L.context && (r = L.context[t.id]) !== undefined ? r : t.defaultValue;
  }
  var at;
  function $t() {
    const t = R && R.running;
    if (this.sources && (t ? this.tState : this.state))
      if ((t ? this.tState : this.state) === Q)
        xe(this);
      else {
        const r = X;
        X = null, ae(() => Ge(this), false), X = r;
      }
    if (U) {
      const r = this.observers ? this.observers.length : 0;
      U.sources ? (U.sources.push(this), U.sourceSlots.push(r)) : (U.sources = [this], U.sourceSlots = [r]), this.observers ? (this.observers.push(U), this.observerSlots.push(U.sources.length - 1)) : (this.observers = [U], this.observerSlots = [U.sources.length - 1]);
    }
    return t && R.sources.has(this) ? this.tValue : this.value;
  }
  function It(t, r, n) {
    let i = R && R.running && R.sources.has(t) ? t.tValue : t.value;
    if (!t.comparator || !t.comparator(i, r)) {
      if (R) {
        const l = R.running;
        (l || !n && R.sources.has(t)) && (R.sources.add(t), t.tValue = r), l || (t.value = r);
      } else
        t.value = r;
      t.observers && t.observers.length && ae(() => {
        for (let l = 0;l < t.observers.length; l += 1) {
          const u = t.observers[l], F = R && R.running;
          F && R.disposed.has(u) || ((F ? !u.tState : !u.state) && (u.pure ? X.push(u) : J.push(u), u.observers && Lt(u)), F ? u.tState = Q : u.state = Q);
        }
        if (X.length > 1e6)
          throw X = [], new Error;
      }, false);
    }
    return r;
  }
  function xe(t) {
    if (!t.fn)
      return;
    se(t);
    const r = We;
    Nt(t, R && R.running && R.sources.has(t) ? t.tValue : t.value, r), R && !R.running && R.sources.has(t) && queueMicrotask(() => {
      ae(() => {
        R && (R.running = true), U = L = t, Nt(t, t.tValue, r), U = L = null;
      }, false);
    });
  }
  function Nt(t, r, n) {
    let i;
    const l = L, u = U;
    U = L = t;
    try {
      i = t.fn(r);
    } catch (F) {
      return t.pure && (R && R.running ? (t.tState = Q, t.tOwned && t.tOwned.forEach(se), t.tOwned = undefined) : (t.state = Q, t.owned && t.owned.forEach(se), t.owned = null)), t.updatedAt = n + 1, st(F);
    } finally {
      U = u, L = l;
    }
    (!t.updatedAt || t.updatedAt <= n) && (t.updatedAt != null && ("observers" in t) ? It(t, i, true) : R && R.running && t.pure ? (R.sources.has(t) || (t.value = i), R.sources.add(t), t.tValue = i) : t.value = i, t.updatedAt = n);
  }
  function lt(t, r, n, i = Q, l) {
    const u = { fn: t, state: i, updatedAt: null, owned: null, sources: null, sourceSlots: null, cleanups: null, value: r, owner: L, context: L ? L.context : null, pure: n };
    if (R && R.running && (u.state = 0, u.tState = i), L === null || L !== yt && (R && R.running && L.pure ? L.tOwned ? L.tOwned.push(u) : L.tOwned = [u] : L.owned ? L.owned.push(u) : L.owned = [u]), Ee && u.fn) {
      const F = u.fn, [v, A] = z(undefined, { equals: false }), T = Ee.factory(F, A);
      xt(() => T.dispose());
      let O;
      const S = () => Tr(A).then(() => {
        O && (O.dispose(), O = undefined);
      });
      u.fn = (m) => (v(), R && R.running ? (O || (O = Ee.factory(F, S)), O.track(m)) : T.track(m));
    }
    return u;
  }
  function ke(t) {
    const r = R && R.running;
    if ((r ? t.tState : t.state) === 0)
      return;
    if ((r ? t.tState : t.state) === Ae)
      return Ge(t);
    if (t.suspense && Se(t.suspense.inFallback))
      return t.suspense.effects.push(t);
    const n = [t];
    for (;(t = t.owner) && (!t.updatedAt || t.updatedAt < We); ) {
      if (r && R.disposed.has(t))
        return;
      (r ? t.tState : t.state) && n.push(t);
    }
    for (let i = n.length - 1;i >= 0; i--) {
      if (t = n[i], r) {
        let l = t, u = n[i + 1];
        for (;(l = l.owner) && l !== u; )
          if (R.disposed.has(l))
            return;
      }
      if ((r ? t.tState : t.state) === Q)
        xe(t);
      else if ((r ? t.tState : t.state) === Ae) {
        const l = X;
        X = null, ae(() => Ge(t, n[0]), false), X = l;
      }
    }
  }
  function ae(t, r) {
    if (X)
      return t();
    let n = false;
    r || (X = []), J ? n = true : J = [], We++;
    try {
      const i = t();
      return Pr(n), i;
    } catch (i) {
      n || (J = null), X = null, st(i);
    }
  }
  function Pr(t) {
    if (X && (ye && R && R.running ? Cr(X) : Dt(X), X = null), t)
      return;
    let r;
    if (R) {
      if (!R.promises.size && !R.queue.size) {
        const { sources: i, disposed: l } = R;
        J.push.apply(J, R.effects), r = R.resolve;
        for (const u of J)
          "tState" in u && (u.state = u.tState), delete u.tState;
        R = null, ae(() => {
          for (const u of l)
            se(u);
          for (const u of i) {
            if (u.value = u.tValue, u.owned)
              for (let F = 0, v = u.owned.length;F < v; F++)
                se(u.owned[F]);
            u.tOwned && (u.owned = u.tOwned), delete u.tValue, delete u.tOwned, u.tState = 0;
          }
          kt(false);
        }, false);
      } else if (R.running) {
        R.running = false, R.effects.push.apply(R.effects, J), J = null, kt(true);
        return;
      }
    }
    const n = J;
    J = null, n.length && ae(() => At(n), false), r && r();
  }
  function Dt(t) {
    for (let r = 0;r < t.length; r++)
      ke(t[r]);
  }
  function Cr(t) {
    for (let r = 0;r < t.length; r++) {
      const n = t[r], i = R.queue;
      i.has(n) || (i.add(n), ye(() => {
        i.delete(n), ae(() => {
          R.running = true, ke(n);
        }, false), R && (R.running = false);
      }));
    }
  }
  function Ar(t) {
    let r, n = 0;
    for (r = 0;r < t.length; r++) {
      const i = t[r];
      i.user ? t[n++] = i : ke(i);
    }
    if (Y.context) {
      if (Y.count) {
        Y.effects || (Y.effects = []), Y.effects.push(...t.slice(0, n));
        return;
      }
      it();
    }
    for (Y.effects && (Y.done || !Y.count) && (t = [...Y.effects, ...t], n += Y.effects.length, delete Y.effects), r = 0;r < n; r++)
      ke(t[r]);
  }
  function Ge(t, r) {
    const n = R && R.running;
    n ? t.tState = 0 : t.state = 0;
    for (let i = 0;i < t.sources.length; i += 1) {
      const l = t.sources[i];
      if (l.sources) {
        const u = n ? l.tState : l.state;
        u === Q ? l !== r && (!l.updatedAt || l.updatedAt < We) && ke(l) : u === Ae && Ge(l, r);
      }
    }
  }
  function Lt(t) {
    const r = R && R.running;
    for (let n = 0;n < t.observers.length; n += 1) {
      const i = t.observers[n];
      (r ? !i.tState : !i.state) && (r ? i.tState = Ae : i.state = Ae, i.pure ? X.push(i) : J.push(i), i.observers && Lt(i));
    }
  }
  function se(t) {
    let r;
    if (t.sources)
      for (;t.sources.length; ) {
        const n = t.sources.pop(), i = t.sourceSlots.pop(), l = n.observers;
        if (l && l.length) {
          const u = l.pop(), F = n.observerSlots.pop();
          i < l.length && (u.sourceSlots[F] = i, l[i] = u, n.observerSlots[i] = F);
        }
      }
    if (t.tOwned) {
      for (r = t.tOwned.length - 1;r >= 0; r--)
        se(t.tOwned[r]);
      delete t.tOwned;
    }
    if (R && R.running && t.pure)
      zt(t, true);
    else if (t.owned) {
      for (r = t.owned.length - 1;r >= 0; r--)
        se(t.owned[r]);
      t.owned = null;
    }
    if (t.cleanups) {
      for (r = t.cleanups.length - 1;r >= 0; r--)
        t.cleanups[r]();
      t.cleanups = null;
    }
    R && R.running ? t.tState = 0 : t.state = 0;
  }
  function zt(t, r) {
    if (r || (t.tState = 0, R.disposed.add(t)), t.owned)
      for (let n = 0;n < t.owned.length; n++)
        zt(t.owned[n]);
  }
  function yr(t) {
    return t instanceof Error ? t : new Error(typeof t == "string" ? t : "Unknown error", { cause: t });
  }
  function Vt(t, r, n) {
    try {
      for (const i of r)
        i(t);
    } catch (i) {
      st(i, n && n.owner || null);
    }
  }
  function st(t, r = L) {
    const n = Ct && r && r.context && r.context[Ct], i = yr(t);
    if (!n)
      throw i;
    J ? J.push({ fn() {
      Vt(i, n, r);
    }, state: Q }) : Vt(i, n, r);
  }
  var xr = Symbol("fallback");
  function Bt(t) {
    for (let r = 0;r < t.length; r++)
      t[r]();
  }
  function kr(t, r, n = {}) {
    let i = [], l = [], u = [], F = 0, v = r.length > 1 ? [] : null;
    return xt(() => Bt(u)), () => {
      let A = t() || [], T = A.length, O, S;
      return A[mr], Se(() => {
        let f, _, d, c, w, s, g, h, C;
        if (T === 0)
          F !== 0 && (Bt(u), u = [], i = [], l = [], F = 0, v && (v = [])), n.fallback && (i = [xr], l[0] = He(($) => (u[0] = $, n.fallback())), F = 1);
        else if (F === 0) {
          for (l = new Array(T), S = 0;S < T; S++)
            i[S] = A[S], l[S] = He(m);
          F = T;
        } else {
          for (d = new Array(T), c = new Array(T), v && (w = new Array(T)), s = 0, g = Math.min(F, T);s < g && i[s] === A[s]; s++)
            ;
          for (g = F - 1, h = T - 1;g >= s && h >= s && i[g] === A[h]; g--, h--)
            d[h] = l[g], c[h] = u[g], v && (w[h] = v[g]);
          for (f = new Map, _ = new Array(h + 1), S = h;S >= s; S--)
            C = A[S], O = f.get(C), _[S] = O === undefined ? -1 : O, f.set(C, S);
          for (O = s;O <= g; O++)
            C = i[O], S = f.get(C), S !== undefined && S !== -1 ? (d[S] = l[O], c[S] = u[O], v && (w[S] = v[O]), S = _[S], f.set(C, S)) : u[O]();
          for (S = s;S < T; S++)
            S in d ? (l[S] = d[S], u[S] = c[S], v && (v[S] = w[S], v[S](S))) : l[S] = He(m);
          l = l.slice(0, F = T), i = A.slice(0);
        }
        return l;
      });
      function m(f) {
        if (u[S] = f, v) {
          const [_, d] = z(S);
          return v[S] = d, r(A[S], _);
        }
        return r(A[S]);
      }
    };
  }
  var $r = false;
  function Ir(t, r) {
    if ($r && Y.context) {
      const n = Y.context;
      it(Sr());
      const i = Se(() => t(r || {}));
      return it(n), i;
    }
    return Se(() => t(r || {}));
  }
  function Ue() {
    return true;
  }
  var Nr = { get(t, r, n) {
    return r === ot ? n : t.get(r);
  }, has(t, r) {
    return r === ot ? true : t.has(r);
  }, set: Ue, deleteProperty: Ue, getOwnPropertyDescriptor(t, r) {
    return { configurable: true, enumerable: true, get() {
      return t.get(r);
    }, set: Ue, deleteProperty: Ue };
  }, ownKeys(t) {
    return t.keys();
  } };
  function ct(t) {
    return (t = typeof t == "function" ? t() : t) ? t : {};
  }
  function Dr() {
    for (let t = 0, r = this.length;t < r; ++t) {
      const n = this[t]();
      if (n !== undefined)
        return n;
    }
  }
  function Wt(...t) {
    let r = false;
    for (let F = 0;F < t.length; F++) {
      const v = t[F];
      r = r || !!v && ot in v, t[F] = typeof v == "function" ? (r = true, Me(v)) : v;
    }
    if (wr && r)
      return new Proxy({ get(F) {
        for (let v = t.length - 1;v >= 0; v--) {
          const A = ct(t[v])[F];
          if (A !== undefined)
            return A;
        }
      }, has(F) {
        for (let v = t.length - 1;v >= 0; v--)
          if (F in ct(t[v]))
            return true;
        return false;
      }, keys() {
        const F = [];
        for (let v = 0;v < t.length; v++)
          F.push(...Object.keys(ct(t[v])));
        return [...new Set(F)];
      } }, Nr);
    const n = {}, i = Object.create(null);
    for (let F = t.length - 1;F >= 0; F--) {
      const v = t[F];
      if (!v)
        continue;
      const A = Object.getOwnPropertyNames(v);
      for (let T = A.length - 1;T >= 0; T--) {
        const O = A[T];
        if (O === "__proto__" || O === "constructor")
          continue;
        const S = Object.getOwnPropertyDescriptor(v, O);
        if (!i[O])
          i[O] = S.get ? { enumerable: true, configurable: true, get: Dr.bind(n[O] = [S.get.bind(v)]) } : S.value !== undefined ? S : undefined;
        else {
          const m = n[O];
          m && (S.get ? m.push(S.get.bind(v)) : S.value !== undefined && m.push(() => S.value));
        }
      }
    }
    const l = {}, u = Object.keys(i);
    for (let F = u.length - 1;F >= 0; F--) {
      const v = u[F], A = i[v];
      A && A.get ? Object.defineProperty(l, v, A) : l[v] = A ? A.value : undefined;
    }
    return l;
  }
  function ne(t) {
    const r = "fallback" in t && { fallback: () => t.fallback };
    return Me(kr(() => t.each, t.children, r || undefined));
  }
  var Lr = (t) => Me(() => t());
  function zr({ createElement: t, createTextNode: r, isTextNode: n, replaceText: i, insertNode: l, removeNode: u, setProperty: F, getParentNode: v, getFirstChild: A, getNextSibling: T }) {
    function O(s, g, h, C) {
      if (h !== undefined && !C && (C = []), typeof g != "function")
        return S(s, g, C, h);
      le(($) => S(s, g(), $, h), C);
    }
    function S(s, g, h, C, $) {
      for (;typeof h == "function"; )
        h = h();
      if (g === h)
        return h;
      const D = typeof g, k = C !== undefined;
      if (D === "string" || D === "number")
        if (D === "number" && (g = g.toString()), k) {
          let P = h[0];
          P && n(P) ? i(P, g) : P = r(g), h = _(s, h, C, P);
        } else
          h !== "" && typeof h == "string" ? i(A(s), h = g) : (_(s, h, C, r(g)), h = g);
      else if (g == null || D === "boolean")
        h = _(s, h, C);
      else {
        if (D === "function")
          return le(() => {
            let P = g();
            for (;typeof P == "function"; )
              P = P();
            h = S(s, P, h, C);
          }), () => h;
        if (Array.isArray(g)) {
          const P = [];
          if (m(P, g, $))
            return le(() => h = S(s, P, h, C, true)), () => h;
          if (P.length === 0) {
            const Z = _(s, h, C);
            if (k)
              return h = Z;
          } else
            Array.isArray(h) ? h.length === 0 ? d(s, P, C) : f(s, h, P) : h == null || h === "" ? d(s, P) : f(s, k && h || [A(s)], P);
          h = P;
        } else {
          if (Array.isArray(h)) {
            if (k)
              return h = _(s, h, C, g);
            _(s, h, null, g);
          } else
            h == null || h === "" || !A(s) ? l(s, g) : c(s, g, A(s));
          h = g;
        }
      }
      return h;
    }
    function m(s, g, h) {
      let C = false;
      for (let $ = 0, D = g.length;$ < D; $++) {
        let k = g[$], P;
        if (!(k == null || k === true || k === false))
          if (Array.isArray(k))
            C = m(s, k) || C;
          else if ((P = typeof k) == "string" || P === "number")
            s.push(r(k));
          else if (P === "function")
            if (h) {
              for (;typeof k == "function"; )
                k = k();
              C = m(s, Array.isArray(k) ? k : [k]) || C;
            } else
              s.push(k), C = true;
          else
            s.push(k);
      }
      return C;
    }
    function f(s, g, h) {
      let C = h.length, $ = g.length, D = C, k = 0, P = 0, Z = T(g[$ - 1]), ee = null;
      for (;k < $ || P < D; ) {
        if (g[k] === h[P]) {
          k++, P++;
          continue;
        }
        for (;g[$ - 1] === h[D - 1]; )
          $--, D--;
        if ($ === k) {
          const B = D < C ? P ? T(h[P - 1]) : h[D - P] : Z;
          for (;P < D; )
            l(s, h[P++], B);
        } else if (D === P)
          for (;k < $; )
            (!ee || !ee.has(g[k])) && u(s, g[k]), k++;
        else if (g[k] === h[D - 1] && h[P] === g[$ - 1]) {
          const B = T(g[--$]);
          l(s, h[P++], T(g[k++])), l(s, h[--D], B), g[$] = h[D];
        } else {
          if (!ee) {
            ee = new Map;
            let o = P;
            for (;o < D; )
              ee.set(h[o], o++);
          }
          const B = ee.get(g[k]);
          if (B != null)
            if (P < B && B < D) {
              let o = k, E = 1, p;
              for (;++o < $ && o < D && !((p = ee.get(g[o])) == null || p !== B + E); )
                E++;
              if (E > B - P) {
                const y = g[k];
                for (;P < B; )
                  l(s, h[P++], y);
              } else
                c(s, h[P++], g[k++]);
            } else
              k++;
          else
            u(s, g[k++]);
        }
      }
    }
    function _(s, g, h, C) {
      if (h === undefined) {
        let D;
        for (;D = A(s); )
          u(s, D);
        return C && l(s, C), "";
      }
      const $ = C || r("");
      if (g.length) {
        let D = false;
        for (let k = g.length - 1;k >= 0; k--) {
          const P = g[k];
          if ($ !== P) {
            const Z = v(P) === s;
            !D && !k ? Z ? c(s, $, P) : l(s, $, h) : Z && u(s, P);
          } else
            D = true;
        }
      } else
        l(s, $, h);
      return [$];
    }
    function d(s, g, h) {
      for (let C = 0, $ = g.length;C < $; C++)
        l(s, g[C], h);
    }
    function c(s, g, h) {
      l(s, g, h), u(s, h);
    }
    function w(s, g, h = {}, C) {
      return g || (g = {}), C || le(() => h.children = S(s, g.children, h.children)), le(() => g.ref && g.ref(s)), le(() => {
        for (const $ in g) {
          if ($ === "children" || $ === "ref")
            continue;
          const D = g[$];
          D !== h[$] && (F(s, $, D, h[$]), h[$] = D);
        }
      }), h;
    }
    return { render(s, g) {
      let h;
      return He((C) => {
        h = C, O(g, s());
      }), h;
    }, insert: O, spread(s, g, h) {
      typeof g == "function" ? le((C) => w(s, g(), C, h)) : w(s, g, undefined, h);
    }, createElement: t, createTextNode: r, insertNode: l, setProp(s, g, h, C) {
      return F(s, g, h, C), h;
    }, mergeProps: Wt, effect: le, memo: Lr, createComponent: Ir, use(s, g, h) {
      return Se(() => s(g, h));
    } };
  }
  function Vr(t) {
    const r = zr(t);
    return r.mergeProps = Wt, r;
  }
  var Ht = 6 * 1024 * 1024, Br = 64, _i = Br, Mt = 4 * 1024 * 1024, pe = 64 + Mt, ut = 768 * 1024, ft = pe + ut, Wr = 256 * 1024, dt = ft + Wr, Gt = pe + ut, Hr = 0, Mr = 8, Gr = 12, Ur = 16, Xr = 24, Yr = 28, Jr = 32, jr = 40, qr = 44, Kr = Mr >> 2, Qr = Gr >> 2, Zr = Xr >> 2, Ut = Yr >> 2, en = jr >> 2;
  qr >> 2;
  var tn = Hr >> 3, rn = Ur >> 3, nn = Jr >> 3, vi = 1, bi = 2, Fi = 3, Ei = 4, Si = 16, pi = 17, wi = 20, mi = 21, Ri = 22, Ti = 23, Oi = 24, Pi = 25, Ci = 26, Ai = 27, yi = 28, xi = 29, ki = 30, $i = 31, Ii = 32, Ni = 33, Di = 34, Li = 35, zi = 36, Vi = 37, Bi = 38, Wi = 0, Hi = 1, Mi = 2, Gi = 3, Ui = 4, Xi = 5, Yi = 6, Ji = 7, ji = 9, qi = 10, Ki = 11, Qi = 12, Zi = 13, eo = 14, to = 15, ro = 16, no = 17, io = 18, oo = 19, ao = 20, lo = 21, so = 22, co = 23, uo = 24, fo = 25, go = 26, ho = 27, _o = 1, vo = 2, bo = 3, Fo = 4, Eo = 5, So = 6, po = 7, wo = 8, mo = 9, Ro = 10, To = 11, Oo = 12, Po = 0, Co = 1, Ao = 2, yo = 3, xo = 4, ko = 5, $o = 6, Io = 0, No = 1, Do = 2, Lo = 3, zo = 4, Vo = 5, Bo = 6, Wo = 7, Ho = 8, Mo = 9, Go = 10, Uo = 11, Xo = 12, Yo = 13, Jo = 14, jo = 15, qo = 16, Ko = 32, Qo = 33, Zo = 34, ea = 35, ta = 36, ra = 37, na = 64, ia = 65, oa = 66, aa = 67, la = 68, sa = 69, ca = 70, ua = 71, fa = 72, da = 96, ga = 97, ha = 98, _a = 128, va = 129, ba = 130, Fa = 131, Ea = 132, Sa = 133, pa = 134, wa = 135, ma = 136, Ra = 137, Ta = 160, Oa = 161, Pa = 162, Ca = 163, Aa = 164, ya = 165, xa = 166, ka = 167, $a = 168, Ia = 169, Na = 170, Da = 171, La = -1, on = 2147483646, an = 2147483645, fe = globalThis.__skal_acquireBridge();
  if (!fe || fe.byteLength !== Ht)
    throw new Error(`Skal: bridge buffer not available (got ${fe && fe.byteLength})`);
  var Xt = new Uint8Array(fe), q = new Uint32Array(fe), gt = new BigInt64Array(fe), ln = new TextEncoder, $e = 16, sn = 64 + Mt >> 2, cn = 16384, un = sn - 4, Xe = 0n, ce = $e, we = pe, Ye = $e;
  function ht() {
    q[Kr] = ce - $e << 2, q[Qr] = we - pe, Xe += 1n, Atomics.store(gt, tn, Xe), Ye = ce;
  }
  function Yt() {
    ht();
    const t = Xe, r = performance.now() + 5000;
    for (;!(Atomics.load(gt, nn) >= t); )
      if (performance.now() > r) {
        console.warn("Skal: drain spin timeout \u2014 UI thread slow; ring will overwrite");
        break;
      }
    ce = $e, we = pe, Ye = $e;
  }
  function V(t, r, n, i) {
    let l = ce;
    l >= un && (Yt(), l = ce), q[l] = t >>> 0, q[l + 1] = r >>> 0, q[l + 2] = n >>> 0, q[l + 3] = i >>> 0, ce = l + 4, ce - Ye >= cn && ht();
  }
  var de = 0, ge = 0;
  function me(t) {
    we + t.length * 3 > Gt && Yt();
    const r = we - pe, n = Xt.subarray(we, Gt), { read: i, written: l } = ln.encodeInto(t, n);
    if (i !== t.length)
      throw new Error(`Skal: string too large for heap (${t.length} code units > ${ut} bytes)`);
    we += l, de = r, ge = l;
  }
  function _t(t, r) {
    me(r), V(20, t, de, ge);
  }
  var vt = false;
  function fn() {
    vt = false, ce !== Ye && ht();
  }
  function H() {
    vt || (vt = true, queueMicrotask(fn));
  }
  var ie = 1024, x = new Int8Array(256);
  x.fill(-1), x[0] = 0, x[1] = 1, x[2] = 2, x[3] = 3, x[4] = 4, x[5] = 5, x[6] = 6, x[7] = 7, x[8] = 8, x[9] = 9, x[32] = 10, x[33] = 11, x[34] = 12, x[35] = 13, x[36] = 14, x[37] = 15, x[64] = 16, x[65] = 17, x[66] = 18, x[67] = 19, x[68] = 20, x[69] = 21, x[70] = 22, x[96] = 23, x[97] = 24, x[128] = 25, x[129] = 26, x[130] = 27, x[131] = 28, x[160] = 29, x[161] = 30, x[162] = 31, x[10] = 32, x[11] = 33, x[12] = 34, x[13] = 35, x[14] = 36, x[15] = 37, x[16] = 38, x[132] = 39, x[133] = 40, x[134] = 41, x[135] = 42, x[136] = 43, x[163] = 44, x[164] = 45, x[165] = 46, x[166] = 47, x[71] = 48, x[98] = 49, x[137] = 50, x[72] = 51, x[167] = 52, x[168] = 53, x[169] = 54, x[170] = 55, x[171] = 56;
  var K = 64, Je = new Int32Array(ie * K), Ie = new Float32Array(ie * K), je = new Array(ie * K), Ne = new Uint8Array(ie * K), Re = 6, Te = new Float32Array(ie * Re);
  Te.fill(NaN);
  var qe = new Map, Jt = [], dn = 0;
  function gn() {
    const t = ie * 2, r = ie * K, n = t * K, i = ie * Re, l = t * Re, u = new Int32Array(n);
    u.set(Je), Je = u;
    const F = new Uint8Array(n);
    F.set(Ne), Ne = F;
    const v = new Float32Array(n);
    v.set(Ie), v.fill(NaN, r), Ie = v;
    const A = new Float32Array(l);
    A.set(Te), A.fill(NaN, i), Te = A, je.length = n, ie = t;
  }
  function Ke(t) {
    let r = qe.get(t);
    if (r === undefined) {
      r = Jt.pop(), r === undefined && (r = dn++), r >= ie && gn(), qe.set(t, r);
      const n = r * K;
      Ne.fill(0, n, n + K), Ie.fill(NaN, n, n + K);
      for (let i = n;i < n + K; i++)
        je[i] = undefined;
    }
    return r;
  }
  var jt = new Map, qt = new Map, Kt = new Map, Oe = new Map;
  function hn(t) {
    const r = qe.get(t);
    if (r !== undefined) {
      qe.delete(t), Jt.push(r);
      const n = r * Re;
      Te.fill(NaN, n, n + Re);
    }
    jt.delete(t), qt.delete(t), Kt.delete(t), yn(t);
  }
  var te = 0, ue = 0, Pe = new Float32Array(1), De = new Uint32Array(Pe.buffer);
  function re(t, r, n) {
    const i = n | 0, l = x[r];
    if (l < 0) {
      V(16, t, r, i), te++;
      return;
    }
    const u = Ke(t) * K + l;
    if (Ne[u] !== 0 && Je[u] === i) {
      ue++;
      return;
    }
    Je[u] = i, Ne[u] = 1, V(16, t, r, i), te++;
  }
  function Qt(t, r, n) {
    const i = x[r];
    if (i < 0) {
      Pe[0] = n, V(17, t, r, De[0]), te++;
      return;
    }
    const l = Ke(t) * K + i;
    if (Ie[l] === n) {
      ue++;
      return;
    }
    Ie[l] = n, Pe[0] = n, V(17, t, r, De[0]), te++;
  }
  function _n(t, r, n) {
    const i = x[r];
    if (i < 0) {
      me(n == null ? "" : String(n)), V(22, t, (r & 255) << 24 | de & 16777215, ge), te++;
      return;
    }
    const l = Ke(t) * K + i;
    if (je[l] === n) {
      ue++;
      return;
    }
    je[l] = n, me(n == null ? "" : String(n)), V(22, t, (r & 255) << 24 | de & 16777215, ge), te++;
  }
  function Ce(t, r, n, i) {
    const l = Ke(t) * Re + n;
    if (Te[l] === i) {
      ue++;
      return;
    }
    Te[l] = i, Pe[0] = i, V(r, t, 0, De[0]), te++;
  }
  function vn(t, r) {
    Ce(t, 32, 0, r);
  }
  function bn(t, r) {
    Ce(t, 33, 1, r);
  }
  function Fn(t, r) {
    Ce(t, 34, 2, r);
  }
  function En(t, r) {
    Ce(t, 35, 3, r);
  }
  function Sn(t, r) {
    Ce(t, 36, 4, r);
  }
  function pn(t, r) {
    Ce(t, 37, 5, r);
  }
  var wn = { material: 0, cupertino: 1, adaptive: 2 }, mn = { light: 0, dark: 1 };
  function Rn(t, r) {
    V(38, typeof t == "string" ? wn[t] ?? 0 : t | 0, typeof r == "string" ? mn[r] ?? 0 : r | 0, 0), H();
  }
  function Zt(t) {
    return Qe(1, "showDialog", [JSON.stringify(t || {})]);
  }
  function Tn(t) {
    return Qe(1, "showActionSheet", [JSON.stringify(t || {})]);
  }
  function er(t) {
    return Qe(1, "showSnackbar", [JSON.stringify(typeof t == "string" ? { message: t } : t || {})]);
  }
  var tr = new Map;
  function On(t) {
    let r = 2166136261;
    for (let n = 0;n < t.length; n++)
      r ^= t.charCodeAt(n), r = Math.imul(r, 16777619) >>> 0;
    return r;
  }
  function he(t) {
    let r = tr.get(t);
    return r !== undefined || (r = On(t), me(t), V(23, r, de, ge), tr.set(t, r)), r;
  }
  function Pn(t, r) {
    V(4, t, he(r), 0);
  }
  function bt(t, r) {
    let n = t.get(r);
    return n === undefined && (n = new Map, t.set(r, n)), n;
  }
  function rr(t, r, n) {
    const i = he(r), l = n >>> 0, u = bt(jt, t);
    if (u.get(i) === l) {
      ue++;
      return;
    }
    u.set(i, l), V(24, t, i, l), te++;
  }
  function nr(t, r, n) {
    const i = he(r), l = bt(qt, t);
    if (l.get(i) === n) {
      ue++;
      return;
    }
    l.set(i, n), Pe[0] = n, V(25, t, i, De[0]), te++;
  }
  function ir(t, r, n) {
    const i = he(r), l = n == null ? "" : String(n), u = bt(Kt, t);
    if (u.get(i) === l) {
      ue++;
      return;
    }
    u.set(i, l), me(l);
    const F = de & 16777215, v = ge & 255;
    V(26, t, i, F << 8 | v), te++;
  }
  function Cn(t, r, n) {
    V(27, t, he(r), n);
  }
  var Le = new Map, oe = new Map, or = 1;
  function ar(t, r) {
    for (let n = 0;n < r.length; n++) {
      const i = r[n];
      if (typeof i == "number")
        Number.isInteger(i) ? V(29, t, 1, i | 0) : (Pe[0] = i, V(29, t, 2, De[0]));
      else if (typeof i == "boolean")
        V(29, t, 3, i ? 1 : 0);
      else if (typeof i == "string") {
        me(i);
        const l = de >>> 0;
        V(29, t, 4 | (ge & 16777215) << 8, l);
      } else
        V(29, t, 0, 0);
    }
  }
  function Qe(t, r, n) {
    const i = he(r), l = or++;
    return ar(l, n), V(28, t, i, l), H(), new Promise((u, F) => {
      Le.set(l, { resolve: u, reject: F });
    });
  }
  function An(t, r, n, i, l) {
    const u = he(r), F = or++;
    ar(F, n), V(30, t, u, F), H(), oe.set(F, { nodeId: t, onValue: i, onError: l && l.onError, onDone: l && l.onDone });
    let v = Oe.get(t);
    return v === undefined && (v = new Set, Oe.set(t, v)), v.add(F), function() {
      if (!oe.has(F))
        return;
      oe.delete(F);
      const T = Oe.get(t);
      T && (T.delete(F), T.size === 0 && Oe.delete(t)), V(31, F, 0, 0), H();
    };
  }
  function yn(t) {
    const r = Oe.get(t);
    if (r !== undefined) {
      for (const n of r)
        oe.has(n) && (oe.delete(n), V(31, n, 0, 0));
      Oe.delete(t), H();
    }
  }
  var Ft = new Map, xn = 1;
  function lr(t) {
    const r = xn++;
    return Ft.set(r, t), r;
  }
  function kn(t, r, n) {
    V(21, t, r, n);
  }
  var Et = 0n, _e = null, sr = Ht - dt, St = dt >> 2, $n = dt + sr >> 2, In = sr / 16 | 0, cr = new ArrayBuffer(4), Nn = new Float32Array(cr), Dn = new Uint32Array(cr), Ln = new TextDecoder("utf-8");
  function pt(t, r) {
    return r === 0 ? "" : Ln.decode(Xt.subarray(ft + t, ft + t + r));
  }
  function wt(t, r) {
    q[en] = t + r;
  }
  globalThis.__skal_drainEvents = function() {
    const t = Atomics.load(gt, rn);
    if (t === Et)
      return;
    const r = St + (q[Zr] >> 2);
    let n = St + (q[Ut] >> 2);
    const i = $n, l = St;
    let u = In;
    for (;n !== r && u-- > 0; ) {
      const F = q[n + 0], v = F & 255, A = F >>> 8 & 255, T = q[n + 1], O = q[n + 2], S = q[n + 3];
      let m, f = false;
      if (A === 1)
        m = O | 0, f = true;
      else if (A === 2)
        Dn[0] = O, m = Nn[0], f = true;
      else if (A === 3)
        m = O !== 0, f = true;
      else if (A === 4)
        m = pt(S, O), f = true, wt(S, O);
      else if (A === 5) {
        const _ = pt(S, O);
        try {
          m = JSON.parse(_);
        } catch {
          m = _;
        }
        f = true, wt(S, O);
      } else if (A === 6) {
        const _ = pt(S, O);
        try {
          m = JSON.parse(_);
        } catch {
          m = [];
        }
        f = true, wt(S, O);
      }
      if (v === 3) {
        const _ = Le.get(T);
        if (_) {
          Le.delete(T);
          try {
            _.resolve(f ? m : undefined);
          } catch (d) {
            _e = d && (d.stack || d.message || String(d)) || "unknown";
          }
        }
      } else if (v === 4) {
        const _ = Le.get(T);
        if (_) {
          Le.delete(T);
          try {
            const d = typeof m == "string" ? m : `skal RPC error (status ${m})`;
            _.reject(new Error(d));
          } catch (d) {
            _e = d && (d.stack || d.message || String(d)) || "unknown";
          }
        }
      } else if (v === 5) {
        const _ = oe.get(T);
        if (_)
          try {
            _.onValue(f ? m : undefined);
          } catch (d) {
            _e = d && (d.stack || d.message || String(d)) || "unknown";
          }
      } else if (v === 6) {
        const _ = oe.get(T);
        if (_) {
          oe.delete(T);
          try {
            _.onDone && _.onDone();
          } catch (d) {
            _e = d && (d.stack || d.message || String(d)) || "unknown";
          }
        }
      } else if (v === 7) {
        const _ = oe.get(T);
        if (_) {
          oe.delete(T);
          try {
            _.onError && _.onError(new Error(typeof m == "string" ? m : "skal stream error"));
          } catch (d) {
            _e = d && (d.stack || d.message || String(d)) || "unknown";
          }
        }
      } else {
        const _ = Ft.get(T);
        if (_)
          try {
            f ? A === 6 && Array.isArray(m) ? _(...m) : _(m) : _();
          } catch (d) {
            _e = d && (d.stack || d.message || String(d)) || "unknown";
          }
      }
      n += 4, n >= i && (n = l);
    }
    q[Ut] = n - l << 2, Et = t;
  }, globalThis.skalStatus = () => JSON.stringify({ handlerCount: Ft.size, opSeq: Number(Xe), lastEventSeq: Number(Et), lastHandlerError: _e, propWrites: te, propSkips: ue });
  var za = 1, zn = 2;
  function ur() {
    return zn++;
  }
  var Vn = { box: 0, column: 1, scrollView: 5, listView: 6, reorderableListView: 7, row: 2, text: 3, button: 4, image: 9, stack: 10, switch: 11, slider: 12, checkbox: 13, activityIndicator: 14, progressBar: 15, lazyGrid: 16, wrap: 17, safeArea: 18, richText: 19, textInput: 20, navigator: 21, screen: 22, tabs: 23, tab: 24, animatedList: 25, crossFade: 26, hero: 27 }, Bn = { padding: [0, "u32"], paddingTop: [1, "u32"], paddingRight: [2, "u32"], paddingBottom: [3, "u32"], paddingLeft: [4, "u32"], width: [5, "dim"], height: [6, "dim"], weight: [7, "f32"], alignment: [8, "u32"], gap: [9, "u32"], axis: [10, "u32"], top: [11, "u32"], right: [12, "u32"], bottom: [13, "u32"], left: [14, "u32"], crossAxisCount: [15, "u32"], aspectRatio: [16, "f32"], background: [32, "color"], color: [33, "color"], cornerRadius: [34, "u32"], borderWidth: [35, "u32"], borderColor: [36, "color"], shadow: [37, "u32"], fontSize: [64, "u32"], fontWeight: [65, "u32"], fontFamily: [66, "u32"], textAlign: [67, "u32"], lineHeight: [68, "u32"], maxLines: [69, "u32"], textOverflow: [70, "u32"], src: [96, "str"], contentScale: [97, "u32"], placeholder: [128, "str"], value: [129, "str"], keyboardType: [130, "u32"], secureEntry: [131, "u32"], checked: [132, "u32"], min: [134, "f32"], max: [135, "f32"], progress: [136, "f32"], presentation: [166, "u32"], title: [71, "str"], icon: [98, "str"], activeTab: [137, "u32"], tag: [72, "str"], transition: [171, "u32"], enabled: [160, "u32"], focusable: [161, "u32"], visible: [162, "u32"] }, Wn = { opacity: vn, translationX: bn, translationY: Fn, scaleX: En, scaleY: Sn, rotation: pn }, Hn = { onClick: 1, onclick: 1, onTap: 1, onLongPress: 8, onDoubleTap: 9, onChange: 2, onSubmit: 10, onReorder: 11, onPop: 12 }, Mn = { linear: 0, easeIn: 1, easeOut: 2, easeInOut: 3, bounce: 4, elastic: 5, fastOutSlowIn: 6 }, Gn = { gentle: 1, bouncy: 2, stiff: 3 };
  function Un(t) {
    if (typeof t == "number")
      return t | 0;
    if (typeof t != "string")
      return 0;
    let r = t.trim();
    r.startsWith("#") && (r = r.slice(1));
    let n = 0, i = 0, l = 0, u = 255;
    return r.length === 3 ? (n = parseInt(r[0] + r[0], 16), i = parseInt(r[1] + r[1], 16), l = parseInt(r[2] + r[2], 16)) : r.length === 4 ? (n = parseInt(r[0] + r[0], 16), i = parseInt(r[1] + r[1], 16), l = parseInt(r[2] + r[2], 16), u = parseInt(r[3] + r[3], 16)) : r.length === 6 ? (n = parseInt(r.slice(0, 2), 16), i = parseInt(r.slice(2, 4), 16), l = parseInt(r.slice(4, 6), 16)) : r.length === 8 && (u = parseInt(r.slice(0, 2), 16), n = parseInt(r.slice(2, 4), 16), i = parseInt(r.slice(4, 6), 16), l = parseInt(r.slice(6, 8), 16)), (u & 255) << 24 | (n & 255) << 16 | (i & 255) << 8 | l & 255 | 0;
  }
  function Xn(t) {
    return typeof t == "number" ? t | 0 : t === "fill" ? on : t === "wrap" ? an : -1;
  }
  function Yn(t) {
    if (Array.isArray(t))
      return true;
    const r = Object.getPrototypeOf(t);
    return r === Object.prototype || r === null;
  }
  function Jn(t, r, n) {
    if (n == null)
      return;
    if (r === "ref" && n && typeof n.__skalBind == "function") {
      n.__skalBind(t.id);
      return;
    }
    const i = typeof n;
    if (i === "object" && Yn(n)) {
      ir(t.id, r, JSON.stringify(n)), H();
      return;
    }
    if (i === "function") {
      const l = lr(n);
      Cn(t.id, r, l), H();
      return;
    }
    if (i === "number") {
      Number.isInteger(n) && n >= 0 && n <= 4294967295 && rr(t.id, r, n | 0), nr(t.id, r, n), H();
      return;
    }
    if (i === "string") {
      ir(t.id, r, n), H();
      return;
    }
    if (i === "boolean") {
      rr(t.id, r, n ? 1 : 0), H();
      return;
    }
  }
  function jn(t) {
    const r = [t];
    for (;r.length > 0; ) {
      const n = r.pop();
      hn(n.id);
      let i = n.firstChild;
      for (;i; )
        r.push(i), i = i.nextSibling;
    }
  }
  var Ze = class {
    constructor(t, r, n = false, i = false) {
      this.tag = t, this.id = r, this.isText = n, this.isCustom = i, this.parent = null, this.firstChild = null, this.lastChild = null, this.nextSibling = null, this.prevSibling = null, this.text = "";
    }
  }, qn = Vr({ createElement(t) {
    const r = ur(), n = Vn[t];
    return n !== undefined ? (V(1, r, n, 0), H(), new Ze(t, r, false, false)) : (Pn(r, t), H(), new Ze(t, r, false, true));
  }, createTextNode(t) {
    const r = ur();
    V(1, r, 3, 0);
    const n = t == null ? "" : String(t);
    n.length > 0 && _t(r, n), H();
    const i = new Ze("#text", r, true);
    return i.text = n, i;
  }, replaceText(t, r) {
    const n = r == null ? "" : String(r);
    t.text !== n && (t.text = n, _t(t.id, n), H());
  }, setProperty(t, r, n, i) {
    if (t.isCustom) {
      Jn(t, r, n);
      return;
    }
    const l = Hn[r];
    if (l !== undefined) {
      if (typeof n == "function") {
        const v = lr(n);
        kn(t.id, l, v), H();
      }
      return;
    }
    if (r === "value" && t.tag === "slider") {
      Qt(t.id, 133, Number(n) || 0), H();
      return;
    }
    if (r === "animate" && n && typeof n == "object") {
      if (re(t.id, 163, n.duration | 0), n.curve != null) {
        const v = typeof n.curve == "string" ? Mn[n.curve] ?? 0 : n.curve | 0;
        re(t.id, 164, v);
      }
      if (n.delay != null && re(t.id, 165, n.delay | 0), n.repeat != null && re(t.id, 167, n.repeat ? 1 : 0), n.reverse != null && re(t.id, 168, n.reverse ? 1 : 0), n.loop != null && re(t.id, 169, n.loop | 0), n.spring != null) {
        const v = typeof n.spring == "string" ? Gn[n.spring] ?? 0 : n.spring ? 2 : 0;
        re(t.id, 170, v);
      }
      H();
      return;
    }
    if (r === "label" && (t.tag === "button" || t.tag === "text")) {
      const v = n == null ? "" : String(n);
      _t(t.id, v), H();
      return;
    }
    const u = Wn[r];
    if (u !== undefined) {
      typeof n == "number" && (u(t.id, n), H());
      return;
    }
    const F = Bn[r];
    if (F !== undefined) {
      const [v, A] = F;
      if (n == null)
        return;
      switch (A) {
        case "u32":
          typeof n == "number" ? (re(t.id, v, n | 0), H()) : typeof n == "boolean" && (re(t.id, v, n ? 1 : 0), H());
          return;
        case "f32":
          typeof n == "number" && (Qt(t.id, v, n), H());
          return;
        case "str":
          _n(t.id, v, String(n)), H();
          return;
        case "color":
          re(t.id, v, Un(n)), H();
          return;
        case "dim":
          re(t.id, v, Xn(n)), H();
          return;
      }
      return;
    }
    if (r === "style" && n && typeof n == "object") {
      for (const v in n)
        this.setProperty(t, v, n[v]);
      return;
    }
  }, insertNode(t, r, n) {
    if (r === n)
      return;
    if (r.parent) {
      const l = r.parent;
      r.prevSibling ? r.prevSibling.nextSibling = r.nextSibling : l.firstChild === r && (l.firstChild = r.nextSibling), r.nextSibling ? r.nextSibling.prevSibling = r.prevSibling : l.lastChild === r && (l.lastChild = r.prevSibling), r.prevSibling = null, r.nextSibling = null;
    }
    const i = n ? n.id : 0;
    V(3, t.id, r.id, i), H(), r.parent = t, n ? (r.nextSibling = n, r.prevSibling = n.prevSibling, n.prevSibling ? n.prevSibling.nextSibling = r : t.firstChild = r, n.prevSibling = r) : (r.prevSibling = t.lastChild, r.nextSibling = null, t.lastChild ? t.lastChild.nextSibling = r : t.firstChild = r, t.lastChild = r);
  }, removeNode(t, r) {
    V(2, r.id, 0, 0), jn(r), H(), r.prevSibling ? r.prevSibling.nextSibling = r.nextSibling : t.firstChild = r.nextSibling, r.nextSibling ? r.nextSibling.prevSibling = r.prevSibling : t.lastChild = r.prevSibling, r.parent = null, r.prevSibling = null, r.nextSibling = null;
  }, isTextNode(t) {
    return t.isText;
  }, getParentNode(t) {
    return t.parent;
  }, getFirstChild(t) {
    return t.firstChild;
  }, getNextSibling(t) {
    return t.nextSibling;
  } }), { render: Kn, effect: M, memo: mt, createComponent: I, createElement: a, createTextNode: Va, insertNode: b, insert: N, spread: Ba, setProp: e, mergeProps: Wa, use: Qn } = qn;
  V(1, 1, 0, 0), H();
  var Zn = new Ze("box", 1, false);
  function ei() {
    let t = 0;
    const r = function() {};
    return r.__skalBind = (n) => {
      t = n;
    }, new Proxy(r, { apply(n, i, l) {
      const u = l[0];
      u && typeof u.id == "number" && (t = u.id);
    }, get(n, i) {
      if (i === "__skalBind" || typeof i == "symbol")
        return r[i];
      if (typeof i == "string" && i.endsWith("$") && i.length > 1) {
        const l = i.slice(0, -1);
        return (...u) => {
          if (t === 0)
            throw new Error(`skal ref: cannot call .${String(i)}() before the host mounts. Move the call into a JSX event handler.`);
          const F = u[u.length - 1];
          if (typeof F != "function")
            throw new TypeError(`skal ref: .${String(i)}() requires a callback as its last argument (got ${typeof F})`);
          const v = u.slice(0, -1);
          return An(t, l, v, F);
        };
      }
      return (...l) => t === 0 ? Promise.reject(new Error(`skal ref: cannot call .${String(i)}() before the host mounts. Move the call into a JSX event handler.`)) : Qe(t, i, l);
    } });
  }
  function Rt(t, r, n) {
    const i = (_) => {
      const d = t[_];
      return typeof d == "function" ? d : d && d.component || null;
    }, l = (_) => {
      const d = t[_];
      return d && typeof d == "object" ? d.title : undefined;
    }, u = (_) => {
      const d = t[_];
      return d && typeof d == "object" ? d.transition : undefined;
    }, F = (_) => _ === "fade" ? 1 : _ === "none" ? 2 : typeof _ == "number" ? _ : 0, v = !!(n && n.linking), A = typeof window < "u", T = () => {
      if (!A)
        return null;
      const _ = (window.location.hash || "").replace(/^#\/?/, "").split("?")[0];
      return _ && t[_] ? _ : null;
    };
    let O = typeof r == "string" ? r : r && r.name || Object.keys(t)[0];
    if (v) {
      const _ = T();
      _ && (O = _);
    }
    const [S, m] = z([{ name: O, params: {}, title: l(O), transition: u(O) }]), f = { stack: S, navigate(_, d, c) {
      m([...S(), { name: _, params: d || {}, presentation: c && c.presentation, title: (c && c.title) !== undefined ? c.title : l(_), transition: (c && c.transition) !== undefined ? c.transition : u(_) }]);
    }, back() {
      const _ = S();
      _.length > 1 && m(_.slice(0, -1));
    }, replace(_, d, c) {
      m([...S().slice(0, -1), { name: _, params: d || {}, title: (c && c.title) !== undefined ? c.title : l(_), transition: (c && c.transition) !== undefined ? c.transition : u(_) }]);
    }, reset(_, d) {
      m([{ name: _, params: d || {}, title: l(_), transition: u(_) }]);
    }, canGoBack() {
      return S().length > 1;
    } };
    return v && A && Rr(() => {
      const _ = S(), d = "#/" + _[_.length - 1].name;
      window.location.hash !== d && window.history.replaceState({}, "", d);
    }), f.View = () => (() => {
      var _ = a("navigator");
      return e(_, "onPop", () => f.back()), N(_, I(ne, { get each() {
        return S();
      }, children: (d) => {
        const c = i(d.name);
        return (() => {
          var w = a("screen");
          return N(w, c ? I(c, { get params() {
            return d.params || {};
          }, router: f }) : null), M((s) => {
            var g = d.presentation === "modal" ? 1 : 0, h = d.title || "", C = F(d.transition);
            return g !== s.e && (s.e = e(w, "presentation", g, s.e)), h !== s.t && (s.t = e(w, "title", h, s.t)), C !== s.a && (s.a = e(w, "transition", C, s.a)), s;
          }, { e: undefined, t: undefined, a: undefined }), w;
        })();
      } })), _;
    })(), f;
  }
  var et = "#FF0A84FF", Tt = "#FF34C759", Ot = "#FFFF9F0A", fr = "#FFFF3B30", dr = "#FF5E5CE6";
  function G(t) {
    return (() => {
      var r = a("column"), n = a("text");
      return b(r, n), e(r, "background", "#FFFFFFFF"), e(r, "cornerRadius", 14), e(r, "padding", 16), e(r, "gap", 12), e(r, "borderWidth", 1), e(r, "borderColor", "#FFE5E5EA"), e(n, "fontSize", 15), e(n, "fontWeight", 800), e(n, "color", "#FF1C1C1E"), N(r, () => t.children, null), M((i) => e(n, "label", t.title, i)), r;
    })();
  }
  function ti(t) {
    const r = ["Inbox", "Starred", "Drafts", "Archive"];
    return (() => {
      var n = a("column");
      return e(n, "background", "#FFF2F2F7"), e(n, "padding", 16), e(n, "gap", 8), e(n, "height", "fill"), N(n, I(ne, { each: r, children: (i) => (() => {
        var l = a("box"), u = a("text");
        return b(l, u), e(l, "background", "#FFFFFFFF"), e(l, "cornerRadius", 8), e(l, "padding", 12), e(l, "onTap", () => t.router.navigate("detail", { name: i }, { title: i })), e(u, "label", `${i}   \u203A`), e(u, "fontSize", 14), e(u, "color", "#FF1C1C1E"), l;
      })() })), n;
    })();
  }
  function ri(t) {
    return (() => {
      var r = a("column"), n = a("text"), i = a("text");
      return b(r, n), b(r, i), e(r, "background", "#FFF2F2F7"), e(r, "padding", 16), e(r, "gap", 10), e(r, "height", "fill"), e(n, "fontSize", 20), e(n, "fontWeight", 800), e(n, "color", "#FF1C1C1E"), e(i, "label", "The AppBar's \u2039 back button (and the system back / swipe gesture) all pop this route. The list screen behind stayed mounted \u2014 back is instant, no re-render, scroll preserved."), e(i, "fontSize", 13), e(i, "color", "#FF8E8E93"), M((l) => e(n, "label", t.name, l)), r;
    })();
  }
  var ni = [et, Tt, Ot, dr];
  function ii() {
    const [t, r] = z(false), [n, i] = z(false), [l, u] = z(false), [F, v] = z(false), [A, T] = z(["Alpha", "Beta", "Gamma"]);
    let O = 3;
    const S = Rt({ gallery: (m) => (() => {
      var f = a("column"), _ = a("text"), d = a("row");
      return b(f, _), b(f, d), e(f, "background", "#FFF2F2F7"), e(f, "padding", 16), e(f, "gap", 12), e(f, "height", "fill"), e(_, "label", "Tap a swatch \u2014 it flies to the detail screen."), e(_, "fontSize", 13), e(_, "color", "#FF8E8E93"), e(d, "gap", 12), N(d, I(ne, { each: ni, children: (c) => (() => {
        var w = a("hero"), s = a("box");
        return b(w, s), e(w, "tag", `hero-${c}`), e(s, "width", 56), e(s, "height", 56), e(s, "background", c), e(s, "cornerRadius", 12), e(s, "onTap", () => m.router.navigate("detail", { color: c })), w;
      })() })), f;
    })(), detail: { component: (m) => (() => {
      var f = a("column"), _ = a("hero"), d = a("box"), c = a("text");
      return b(f, _), b(f, c), e(f, "background", "#FFF2F2F7"), e(f, "padding", 16), e(f, "gap", 12), e(f, "height", "fill"), b(_, d), e(d, "width", "fill"), e(d, "height", 180), e(d, "cornerRadius", 20), e(c, "label", "The swatch flew here from the gallery \u2014 a shared-element transition, GPU-composited host-side."), e(c, "fontSize", 13), e(c, "color", "#FF8E8E93"), M((w) => {
        var s = `hero-${m.params.color}`, g = m.params.color;
        return s !== w.e && (w.e = e(_, "tag", s, w.e)), g !== w.t && (w.t = e(d, "background", g, w.t)), w;
      }, { e: undefined, t: undefined }), f;
    })(), title: "Detail", transition: "fade" } }, "gallery");
    return (() => {
      var m = a("scrollView"), f = a("text"), _ = a("text"), d = a("text");
      return b(m, f), b(m, _), b(m, d), e(m, "background", "#FFF2F2F7"), e(m, "padding", 16), e(m, "gap", 14), e(f, "label", "Animations"), e(f, "fontSize", 24), e(f, "fontWeight", 800), e(f, "color", "#FF1C1C1E"), e(_, "label", "Host-side motion \u2014 JS flips one signal, Flutter runs the whole tween. Zero per-frame bridge traffic. See ANIMATION.md for the full plan."), e(_, "fontSize", 13), e(_, "color", "#FF8E8E93"), N(m, I(G, { title: "Implicit hot-prop tween \u2014 the animate prop", get children() {
        return [(() => {
          var c = a("row"), w = a("box");
          return b(c, w), e(c, "gap", 8), e(w, "width", 64), e(w, "height", 64), e(w, "background", "#FF0A84FF"), e(w, "cornerRadius", 14), e(w, "animate", { duration: 450, curve: "easeInOut" }), M((s) => {
            var g = t() ? 0.3 : 1, h = t() ? 1.4 : 1, C = t() ? 1.4 : 1, $ = t() ? 0.5 : 0, D = t() ? 70 : 0;
            return g !== s.e && (s.e = e(w, "opacity", g, s.e)), h !== s.t && (s.t = e(w, "scaleX", h, s.t)), C !== s.a && (s.a = e(w, "scaleY", C, s.a)), $ !== s.o && (s.o = e(w, "rotation", $, s.o)), D !== s.i && (s.i = e(w, "translationX", D, s.i)), s;
          }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined }), c;
        })(), (() => {
          var c = a("button");
          return e(c, "onClick", () => r(!t())), M((w) => e(c, "label", t() ? "Reset" : "Animate", w)), c;
        })(), (() => {
          var c = a("text");
          return e(c, "label", "opacity + scale + rotation + translation tween together \u2014 JS only flips one signal; the whole tween runs host-side."), e(c, "fontSize", 11), e(c, "color", "#FF8E8E93"), c;
        })()];
      } }), d), N(m, I(G, { title: "Cold-prop tween \u2014 colour \xB7 radius \xB7 padding", get children() {
        return [(() => {
          var c = a("box"), w = a("text");
          return b(c, w), e(c, "animate", { duration: 400, curve: "easeInOut" }), e(c, "width", "fill"), e(w, "label", "AnimatedContainer tweens these host-side"), e(w, "fontSize", 12), e(w, "color", "#FFFFFFFF"), M((s) => {
            var g = n() ? fr : et, h = n() ? 32 : 8, C = n() ? 28 : 12;
            return g !== s.e && (s.e = e(c, "background", g, s.e)), h !== s.t && (s.t = e(c, "cornerRadius", h, s.t)), C !== s.a && (s.a = e(c, "padding", C, s.a)), s;
          }, { e: undefined, t: undefined, a: undefined }), c;
        })(), (() => {
          var c = a("button");
          return e(c, "onClick", () => i(!n())), M((w) => e(c, "label", n() ? "Reset" : "Animate", w)), c;
        })(), (() => {
          var c = a("text");
          return e(c, "label", "background, cornerRadius and padding are cold props \u2014 the host's AnimatedContainer tweens them; JS writes each value once."), e(c, "fontSize", 11), e(c, "color", "#FF8E8E93"), c;
        })()];
      } }), d), N(m, I(G, { title: "Looping \u2014 repeat \xB7 reverse", get children() {
        return [(() => {
          var c = a("row"), w = a("box"), s = a("box"), g = a("box");
          return b(c, w), b(c, s), b(c, g), e(c, "gap", 20), e(w, "width", 44), e(w, "height", 44), e(w, "background", "#FF5E5CE6"), e(w, "cornerRadius", 22), e(w, "animate", { duration: 800, curve: "easeInOut", repeat: true, reverse: true }), e(w, "scaleX", 1.35), e(w, "scaleY", 1.35), e(s, "width", 44), e(s, "height", 44), e(s, "background", "#FF34C759"), e(s, "cornerRadius", 10), e(s, "animate", { duration: 1400, repeat: true }), e(s, "rotation", 6.2832), e(g, "width", 44), e(g, "height", 44), e(g, "background", "#FFFF9F0A"), e(g, "cornerRadius", 22), e(g, "animate", { duration: 900, curve: "easeInOut", repeat: true, reverse: true }), e(g, "opacity", 0.25), c;
        })(), (() => {
          var c = a("text");
          return e(c, "label", "A pulse, a spin and a breathe \u2014 each loops forever host-side; JS set the endpoints once and never touches them again."), e(c, "fontSize", 11), e(c, "color", "#FF8E8E93"), c;
        })()];
      } }), d), N(m, I(G, { title: "Spring physics \u2014 animate.spring", get children() {
        return [(() => {
          var c = a("column"), w = a("box"), s = a("box"), g = a("box");
          return b(c, w), b(c, s), b(c, g), e(c, "gap", 10), e(w, "width", 48), e(w, "height", 48), e(w, "background", "#FF0A84FF"), e(w, "cornerRadius", 10), e(w, "animate", { duration: 700, spring: "gentle" }), e(s, "width", 48), e(s, "height", 48), e(s, "background", "#FF34C759"), e(s, "cornerRadius", 10), e(s, "animate", { duration: 700, spring: "bouncy" }), e(g, "width", 48), e(g, "height", 48), e(g, "background", "#FFFF9F0A"), e(g, "cornerRadius", 10), e(g, "animate", { duration: 700, spring: "stiff" }), M((h) => {
            var C = l() ? 150 : 0, $ = l() ? 150 : 0, D = l() ? 150 : 0;
            return C !== h.e && (h.e = e(w, "translationX", C, h.e)), $ !== h.t && (h.t = e(s, "translationX", $, h.t)), D !== h.a && (h.a = e(g, "translationX", D, h.a)), h;
          }, { e: undefined, t: undefined, a: undefined }), c;
        })(), (() => {
          var c = a("button");
          return e(c, "onClick", () => u(!l())), M((w) => e(c, "label", l() ? "Back" : "Spring", w)), c;
        })(), (() => {
          var c = a("text");
          return e(c, "label", "gentle \xB7 bouncy \xB7 stiff \u2014 three spring-like curves; bouncy overshoots and wobbles into place."), e(c, "fontSize", 11), e(c, "color", "#FF8E8E93"), c;
        })()];
      } }), d), N(m, I(G, { title: "Cross-fade \u2014 CrossFade", get children() {
        return [(() => {
          var c = a("box"), w = a("crossFade");
          return b(c, w), e(c, "height", 92), N(w, (() => {
            var s = mt(() => !!F());
            return () => s() ? (() => {
              var g = a("box"), h = a("text");
              return b(g, h), e(g, "width", "fill"), e(g, "height", 92), e(g, "background", "#FF5E5CE6"), e(g, "cornerRadius", 12), e(g, "padding", 16), e(h, "label", "Panel B"), e(h, "fontSize", 16), e(h, "fontWeight", 800), e(h, "color", "#FFFFFFFF"), g;
            })() : (() => {
              var g = a("box"), h = a("text");
              return b(g, h), e(g, "width", "fill"), e(g, "height", 92), e(g, "background", "#FF0A84FF"), e(g, "cornerRadius", 12), e(g, "padding", 16), e(h, "label", "Panel A"), e(h, "fontSize", 16), e(h, "fontWeight", 800), e(h, "color", "#FFFFFFFF"), g;
            })();
          })()), c;
        })(), (() => {
          var c = a("button");
          return e(c, "label", "Swap panel"), e(c, "onClick", () => v(!F())), c;
        })(), (() => {
          var c = a("text");
          return e(c, "label", "AnimatedSwitcher fades the old child out as the new fades in \u2014 the outgoing element is retained through the fade."), e(c, "fontSize", 11), e(c, "color", "#FF8E8E93"), c;
        })()];
      } }), d), N(m, I(G, { title: "Animated list \u2014 AnimatedList", get children() {
        return [(() => {
          var c = a("animatedList");
          return e(c, "gap", 8), N(c, I(ne, { get each() {
            return A();
          }, children: (w) => (() => {
            var s = a("box"), g = a("text");
            return b(s, g), e(s, "background", "#FFEFEFF4"), e(s, "cornerRadius", 8), e(s, "padding", 12), e(g, "label", w), e(g, "fontSize", 13), e(g, "color", "#FF1C1C1E"), s;
          })() })), c;
        })(), (() => {
          var c = a("row"), w = a("button"), s = a("button");
          return b(c, w), b(c, s), e(c, "gap", 8), e(w, "label", "Add"), e(w, "onClick", () => T([...A(), `Item ${++O}`])), e(s, "label", "Remove"), e(s, "onClick", () => T(A().slice(0, -1))), c;
        })(), (() => {
          var c = a("text");
          return e(c, "label", "Add \u2192 a row fades + expands in; Remove \u2192 it collapses + fades out. Both host-side, via deferred teardown."), e(c, "fontSize", 11), e(c, "color", "#FF8E8E93"), c;
        })()];
      } }), d), N(m, I(G, { title: "Shared element \u2014 Hero", get children() {
        return [(() => {
          var c = a("box");
          return e(c, "height", 300), e(c, "borderWidth", 1), e(c, "borderColor", "#FFE5E5EA"), e(c, "cornerRadius", 8), N(c, I(S.View, {})), c;
        })(), (() => {
          var c = a("text");
          return e(c, "label", "A Hero with a matching tag on each screen flies between them across the navigator push \u2014 the navigator is a real Flutter Navigator."), e(c, "fontSize", 11), e(c, "color", "#FF8E8E93"), c;
        })()];
      } }), d), e(d, "label", "\u2014 end of animations \u2014"), e(d, "fontSize", 12), e(d, "color", "#FF8E8E93"), m;
    })();
  }
  function oi() {
    const [t, r] = z("material"), [n, i] = z(false), [l, u] = z(true), [F, v] = z(false), [A, T] = z(40), [O, S] = z(""), [m, f] = z("none yet"), [_, d] = z("\u2014 try a dialog button \u2014"), [c, w] = z(["First item", "Second item", "Third item", "Fourth item"]), s = Rt({ list: { component: (k) => I(ti, { get router() {
      return k.router;
    } }), title: "Mailboxes" }, detail: (k) => I(ri, { get name() {
      return k.params.name;
    }, get router() {
      return k.router;
    } }) }, "list"), [g, h] = z(0), C = (k, P) => {
      r(k), i(P), Rn(k, P ? 1 : 0);
    }, $ = Rt({ home: { component: (k) => D(k.router) }, animations: { component: () => I(ii, {}), title: "Animations" } }, "home");
    function D(k) {
      return (() => {
        var P = a("scrollView"), Z = a("text"), ee = a("text"), B = a("text");
        return b(P, Z), b(P, ee), b(P, B), e(P, "background", "#FFF2F2F7"), e(P, "padding", 16), e(P, "gap", 14), e(Z, "label", "Skal \u2014 Component Demo"), e(Z, "fontSize", 24), e(Z, "fontWeight", 800), e(Z, "color", "#FF1C1C1E"), e(ee, "label", "Every fast-path widget, plus animation, the design system, and dialogs."), e(ee, "fontSize", 13), e(ee, "color", "#FF8E8E93"), N(P, I(G, { title: "Design system \u2014 setDesign()", get children() {
          return [(() => {
            var o = a("text");
            return e(o, "fontSize", 13), e(o, "color", "#FF8E8E93"), M((E) => e(o, "label", `active: ${t()} \xB7 ${n() ? "dark" : "light"}`, E)), o;
          })(), (() => {
            var o = a("row"), E = a("button"), p = a("button"), y = a("button");
            return b(o, E), b(o, p), b(o, y), e(o, "gap", 8), e(E, "label", "Material"), e(E, "onClick", () => C("material", n())), e(p, "label", "Cupertino"), e(p, "onClick", () => C("cupertino", n())), e(y, "onClick", () => C(t(), !n())), M((W) => e(y, "label", n() ? "Light mode" : "Dark mode", W)), o;
          })(), (() => {
            var o = a("text");
            return e(o, "label", "Buttons, switches, sliders, the text field & spinner all swap Material\u2194Cupertino."), e(o, "fontSize", 11), e(o, "color", "#FF8E8E93"), o;
          })()];
        } }), B), N(P, I(G, { title: "Layout \u2014 box \xB7 row \xB7 wrap", get children() {
          return [(() => {
            var o = a("row"), E = a("box"), p = a("box"), y = a("box");
            return b(o, E), b(o, p), b(o, y), e(o, "gap", 8), e(E, "width", 56), e(E, "height", 56), e(E, "background", "#FF0A84FF"), e(E, "cornerRadius", 10), e(p, "width", 56), e(p, "height", 56), e(p, "background", "#FF34C759"), e(p, "cornerRadius", 10), e(y, "width", 56), e(y, "height", 56), e(y, "background", "#FFFF9F0A"), e(y, "cornerRadius", 10), o;
          })(), (() => {
            var o = a("text");
            return e(o, "label", "Wrap \u2014 children flow onto new runs:"), e(o, "fontSize", 11), e(o, "color", "#FF8E8E93"), o;
          })(), (() => {
            var o = a("wrap");
            return e(o, "gap", 6), N(o, I(ne, { each: ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa"], children: (E) => (() => {
              var p = a("box"), y = a("text");
              return b(p, y), e(p, "background", "#FFEFEFF4"), e(p, "cornerRadius", 12), e(p, "paddingLeft", 10), e(p, "paddingRight", 10), e(p, "paddingTop", 6), e(p, "paddingBottom", 6), e(y, "label", E), e(y, "fontSize", 12), e(y, "color", "#FF1C1C1E"), p;
            })() })), o;
          })()];
        } }), B), N(P, I(G, { title: "Stack \u2014 overlap + positioned children", get children() {
          var o = a("stack"), E = a("box"), p = a("box"), y = a("text"), W = a("box");
          return b(o, E), b(o, p), b(o, W), e(o, "width", "fill"), e(o, "height", 120), e(E, "width", "fill"), e(E, "height", 120), e(E, "background", "#FF5E5CE6"), e(E, "cornerRadius", 12), b(p, y), e(p, "top", 10), e(p, "left", 10), e(p, "background", "#FFFFFFFF"), e(p, "cornerRadius", 8), e(p, "paddingLeft", 10), e(p, "paddingRight", 10), e(p, "paddingTop", 4), e(p, "paddingBottom", 4), e(y, "label", "top \xB7 left"), e(y, "fontSize", 11), e(y, "color", "#FF1C1C1E"), e(W, "bottom", 10), e(W, "right", 10), e(W, "width", 30), e(W, "height", 30), e(W, "background", "#FFFF3B30"), e(W, "cornerRadius", 15), o;
        } }), B), N(P, I(G, { title: "Text & RichText", get children() {
          return [(() => {
            var o = a("text");
            return e(o, "label", "Styled text \u2014 18sp, weight 700."), e(o, "fontSize", 18), e(o, "fontWeight", 700), e(o, "color", "#FF1C1C1E"), o;
          })(), (() => {
            var o = a("richText"), E = a("text"), p = a("text"), y = a("text"), W = a("text"), j = a("text");
            return b(o, E), b(o, p), b(o, y), b(o, W), b(o, j), e(E, "label", "Rich text "), e(E, "fontSize", 16), e(E, "color", "#FF1C1C1E"), e(p, "label", "mixes "), e(p, "fontSize", 16), e(p, "color", "#FF0A84FF"), e(p, "fontWeight", 800), e(y, "label", "size, "), e(y, "fontSize", 22), e(y, "color", "#FFFF3B30"), e(y, "fontWeight", 700), e(W, "label", "weight "), e(W, "fontSize", 16), e(W, "color", "#FF34C759"), e(W, "fontWeight", 800), e(j, "label", "and colour inline."), e(j, "fontSize", 16), e(j, "color", "#FF1C1C1E"), o;
          })()];
        } }), B), N(P, I(G, { title: "Image \u2014 network \xB7 BoxFit \xB7 rounded", get children() {
          return [(() => {
            var o = a("image");
            return e(o, "src", "https://picsum.photos/seed/skal/640/360"), e(o, "width", "fill"), e(o, "height", 160), e(o, "contentScale", 1), e(o, "cornerRadius", 12), o;
          })(), (() => {
            var o = a("text");
            return e(o, "label", "contentScale=1 (cover); cornerRadius clips the pixels. Requires network."), e(o, "fontSize", 11), e(o, "color", "#FF8E8E93"), o;
          })()];
        } }), B), N(P, I(G, { title: "Scrolling \u2014 horizontal list \xB7 lazy grid \xB7 reorderable", get children() {
          return [(() => {
            var o = a("text");
            return e(o, "label", "listView axis=1 (horizontal, virtualized):"), e(o, "fontSize", 11), e(o, "color", "#FF8E8E93"), o;
          })(), (() => {
            var o = a("listView");
            return e(o, "axis", 1), e(o, "height", 66), e(o, "gap", 8), N(o, I(ne, { each: [et, Tt, Ot, dr, fr, "#FF00C7BE", "#FFAF52DE", "#FFFFD60A"], children: (E) => (() => {
              var p = a("box");
              return e(p, "width", 66), e(p, "height", 50), e(p, "background", E), e(p, "cornerRadius", 10), p;
            })() })), o;
          })(), (() => {
            var o = a("text");
            return e(o, "label", "lazyGrid \u2014 crossAxisCount=4:"), e(o, "fontSize", 11), e(o, "color", "#FF8E8E93"), o;
          })(), (() => {
            var o = a("lazyGrid");
            return e(o, "crossAxisCount", 4), e(o, "aspectRatio", 1), e(o, "gap", 8), e(o, "height", 150), N(o, I(ne, { get each() {
              return Array.from({ length: 12 }, (E, p) => p);
            }, children: (E) => (() => {
              var p = a("box");
              return e(p, "background", E % 3 === 0 ? et : E % 3 === 1 ? Tt : Ot), e(p, "cornerRadius", 8), p;
            })() })), o;
          })(), (() => {
            var o = a("text");
            return e(o, "label", "reorderableListView \u2014 drag a row to reorder:"), e(o, "fontSize", 11), e(o, "color", "#FF8E8E93"), o;
          })(), (() => {
            var o = a("reorderableListView");
            return e(o, "height", 200), e(o, "gap", 6), e(o, "onReorder", (E, p) => {
              const y = c().slice(), [W] = y.splice(E, 1);
              y.splice(p, 0, W), w(y);
            }), N(o, I(ne, { get each() {
              return c();
            }, children: (E) => (() => {
              var p = a("box"), y = a("text");
              return b(p, y), e(p, "background", "#FFEFEFF4"), e(p, "cornerRadius", 8), e(p, "padding", 12), e(y, "label", E), e(y, "fontSize", 13), e(y, "color", "#FF1C1C1E"), p;
            })() })), o;
          })()];
        } }), B), N(P, I(G, { title: "Controls \u2014 switch \xB7 checkbox \xB7 slider \xB7 text field", get children() {
          return [(() => {
            var o = a("row"), E = a("switch"), p = a("text");
            return b(o, E), b(o, p), e(o, "gap", 12), e(E, "onChange", (y) => u(y)), e(p, "fontSize", 13), e(p, "color", "#FF1C1C1E"), M((y) => {
              var W = l(), j = l() ? "switch: on" : "switch: off";
              return W !== y.e && (y.e = e(E, "checked", W, y.e)), j !== y.t && (y.t = e(p, "label", j, y.t)), y;
            }, { e: undefined, t: undefined }), o;
          })(), (() => {
            var o = a("row"), E = a("checkbox"), p = a("text");
            return b(o, E), b(o, p), e(o, "gap", 12), e(E, "onChange", (y) => v(y)), e(p, "fontSize", 13), e(p, "color", "#FF1C1C1E"), M((y) => {
              var W = F(), j = F() ? "checkbox: checked" : "checkbox: unchecked";
              return W !== y.e && (y.e = e(E, "checked", W, y.e)), j !== y.t && (y.t = e(p, "label", j, y.t)), y;
            }, { e: undefined, t: undefined }), o;
          })(), (() => {
            var o = a("slider");
            return e(o, "min", 0), e(o, "max", 100), e(o, "onChange", (E) => T(E)), M((E) => e(o, "value", A(), E)), o;
          })(), (() => {
            var o = a("text");
            return e(o, "fontSize", 13), e(o, "color", "#FF1C1C1E"), M((E) => e(o, "label", `slider: ${Math.round(A())}`, E)), o;
          })(), (() => {
            var o = a("textInput");
            return e(o, "placeholder", "Type your name\u2026"), e(o, "onChange", (E) => S(E)), e(o, "onSubmit", (E) => er(`Submitted: ${E}`)), M((E) => e(o, "value", O(), E)), o;
          })(), (() => {
            var o = a("text");
            return e(o, "fontSize", 13), e(o, "color", "#FF8E8E93"), M((E) => e(o, "label", O() ? `Hello, ${O()}!` : "\u2014 type above; press Enter to submit \u2014", E)), o;
          })()];
        } }), B), N(P, I(G, { title: "Indicators \u2014 spinner \xB7 progress bar", get children() {
          return [(() => {
            var o = a("row"), E = a("activityIndicator"), p = a("text");
            return b(o, E), b(o, p), e(o, "gap", 12), e(E, "color", "#FF0A84FF"), e(p, "label", "CircularProgressIndicator"), e(p, "fontSize", 13), e(p, "color", "#FF1C1C1E"), o;
          })(), (() => {
            var o = a("text");
            return e(o, "label", "determinate \u2014 tracks the slider above:"), e(o, "fontSize", 11), e(o, "color", "#FF8E8E93"), o;
          })(), (() => {
            var o = a("progressBar");
            return e(o, "color", "#FF0A84FF"), M((E) => e(o, "progress", A() / 100, E)), o;
          })(), (() => {
            var o = a("text");
            return e(o, "label", "indeterminate:"), e(o, "fontSize", 11), e(o, "color", "#FF8E8E93"), o;
          })(), (() => {
            var o = a("progressBar");
            return e(o, "color", "#FF34C759"), o;
          })()];
        } }), B), N(P, I(G, { title: "Animation", get children() {
          return [(() => {
            var o = a("text");
            return e(o, "label", "Implicit tweens, looping, list enter/exit, Hero \u2014 all host-side, zero per-frame bridge traffic. Opens a dedicated page."), e(o, "fontSize", 11), e(o, "color", "#FF8E8E93"), o;
          })(), (() => {
            var o = a("button");
            return e(o, "label", "Open Animations \u2192"), e(o, "onClick", () => k.navigate("animations")), o;
          })()];
        } }), B), N(P, I(G, { title: "Gestures \u2014 onTap \xB7 onLongPress \xB7 onDoubleTap", get children() {
          return [(() => {
            var o = a("box"), E = a("text");
            return b(o, E), e(o, "background", "#FFEFEFF4"), e(o, "cornerRadius", 12), e(o, "padding", 22), e(o, "onTap", () => f("onTap")), e(o, "onLongPress", () => f("onLongPress")), e(o, "onDoubleTap", () => f("onDoubleTap")), e(E, "label", "Tap / long-press / double-tap this box"), e(E, "fontSize", 13), e(E, "color", "#FF1C1C1E"), o;
          })(), (() => {
            var o = a("text");
            return e(o, "fontSize", 12), e(o, "color", "#FF8E8E93"), M((E) => e(o, "label", `last gesture: ${m()}`, E)), o;
          })()];
        } }), B), N(P, I(G, { title: "Dialogs \u2014 imperative JS API", get children() {
          return [(() => {
            var o = a("row"), E = a("button"), p = a("button");
            return b(o, E), b(o, p), e(o, "gap", 8), e(E, "label", "Alert"), e(E, "onClick", async () => {
              await Zt({ title: "Heads up", message: "A plain alert dialog.", actions: [{ label: "OK", value: "ok" }] }), d("alert: dismissed");
            }), e(p, "label", "Confirm"), e(p, "onClick", async () => {
              d(`confirm \u2192 ${await Zt({ title: "Delete file?", message: "This cannot be undone.", actions: [{ label: "Cancel", value: "cancel" }, { label: "Delete", value: "delete", style: "destructive" }] }) ?? "dismissed"}`);
            }), o;
          })(), (() => {
            var o = a("row"), E = a("button"), p = a("button");
            return b(o, E), b(o, p), e(o, "gap", 8), e(E, "label", "Action sheet"), e(E, "onClick", async () => {
              d(`sheet \u2192 ${await Tn({ title: "Choose an action", actions: [{ label: "Copy", value: "copy" }, { label: "Share", value: "share" }, { label: "Delete", value: "delete", style: "destructive" }] }) ?? "cancelled"}`);
            }), e(p, "label", "Snackbar"), e(p, "onClick", () => {
              er("Hello from a snackbar \uD83D\uDC4B"), d("snackbar: shown");
            }), o;
          })(), (() => {
            var o = a("text");
            return e(o, "fontSize", 12), e(o, "color", "#FF8E8E93"), M((E) => e(o, "label", _(), E)), o;
          })()];
        } }), B), N(P, I(G, { title: "Navigation \u2014 push / pop with keep-alive", get children() {
          return [(() => {
            var o = a("text");
            return e(o, "label", "Tap a mailbox to push a screen; the AppBar back button (or system back) pops. Native transition; the screen behind stays mounted."), e(o, "fontSize", 11), e(o, "color", "#FF8E8E93"), o;
          })(), (() => {
            var o = a("box");
            return e(o, "height", 320), e(o, "borderWidth", 1), e(o, "borderColor", "#FFE5E5EA"), N(o, I(s.View, {})), o;
          })()];
        } }), B), N(P, I(G, { title: "Tabs \u2014 bottom bar with keep-alive", get children() {
          return [(() => {
            var o = a("text");
            return e(o, "label", "Every tab subtree is built once and kept alive (IndexedStack) \u2014 switching never re-mounts; scroll & state survive."), e(o, "fontSize", 11), e(o, "color", "#FF8E8E93"), o;
          })(), (() => {
            var o = a("box"), E = a("tabs"), p = a("tab"), y = a("column"), W = a("text"), j = a("text"), tt = a("tab"), ve = a("column"), ze = a("text"), br = a("textInput"), rt = a("tab"), be = a("column"), Ve = a("text"), nt = a("text");
            return b(o, E), e(o, "height", 280), e(o, "borderWidth", 1), e(o, "borderColor", "#FFE5E5EA"), e(o, "cornerRadius", 8), b(E, p), b(E, tt), b(E, rt), e(E, "onChange", h), e(E, "height", "fill"), b(p, y), e(p, "title", "Home"), e(p, "icon", "home"), b(y, W), b(y, j), e(y, "background", "#FFF2F2F7"), e(y, "padding", 16), e(y, "gap", 8), e(y, "height", "fill"), e(W, "label", "Home"), e(W, "fontSize", 20), e(W, "fontWeight", 800), e(W, "color", "#FF1C1C1E"), e(j, "label", "Switch tabs and come back \u2014 this tab was never torn down."), e(j, "fontSize", 13), e(j, "color", "#FF8E8E93"), b(tt, ve), e(tt, "title", "Search"), e(tt, "icon", "search"), b(ve, ze), b(ve, br), e(ve, "background", "#FFF2F2F7"), e(ve, "padding", 16), e(ve, "gap", 8), e(ve, "height", "fill"), e(ze, "label", "Search"), e(ze, "fontSize", 20), e(ze, "fontWeight", 800), e(ze, "color", "#FF1C1C1E"), e(br, "placeholder", "Type to search\u2026"), b(rt, be), e(rt, "title", "Profile"), e(rt, "icon", "person"), b(be, Ve), b(be, nt), e(be, "background", "#FFF2F2F7"), e(be, "padding", 16), e(be, "gap", 8), e(be, "height", "fill"), e(Ve, "label", "Profile"), e(Ve, "fontSize", 20), e(Ve, "fontWeight", 800), e(Ve, "color", "#FF1C1C1E"), e(nt, "fontSize", 13), e(nt, "color", "#FF8E8E93"), M((Fe) => {
              var Fr = g(), Er = `active tab index: ${g()}`;
              return Fr !== Fe.e && (Fe.e = e(E, "activeTab", Fr, Fe.e)), Er !== Fe.t && (Fe.t = e(nt, "label", Er, Fe.t)), Fe;
            }, { e: undefined, t: undefined }), o;
          })()];
        } }), B), N(P, I(G, { title: "SafeArea", get children() {
          var o = a("safeArea"), E = a("box"), p = a("text");
          return b(o, E), b(E, p), e(E, "background", "#FFEFEFF4"), e(E, "cornerRadius", 8), e(E, "padding", 14), e(p, "label", "Insets past notches & system bars. (No visible effect here \u2014 the app root already applies one.)"), e(p, "fontSize", 12), e(p, "color", "#FF1C1C1E"), o;
        } }), B), e(B, "label", "\u2014 end of UI demo \u2014"), e(B, "fontSize", 12), e(B, "color", "#FF8E8E93"), P;
      })();
    }
    return I($.View, {});
  }
  var gr = ["Just shipped a new feature, feeling great about how it turned out \uD83D\uDE80", "Hot take: the best APIs are the ones you don't have to read docs for", "Spent the morning refactoring legacy code \u2014 so much cleaner now", "There's no such thing as 'just a small change' in production code", "If your tests are slow, that's a smell. Fast tests = good tests", "Bun's startup time keeps surprising me, even after a year", "Why is naming things still the hardest part of programming?", "Found a 10\xD7 speedup in a critical path today. Profilers, not guesses", "Reading 'The Art of Unix Programming' for the third time", "Premature abstraction is somehow worse than premature optimization", "Latency is a feature, throughput is an artifact of how you measure", "Half of debugging is admitting your assumption was wrong", "You don't ship the codebase you have. You ship the codebase you understand", "Cache invalidation, naming things, off-by-one. The classics", "Every config file format eventually grows a turing-complete templating layer"], ai = Array.from({ length: 15000 }, (t, r) => ({ author: `@user${r * 2654435761 >>> 17}`, body: gr[r % gr.length], num: r + 1 })), li = [50, 200, 500, 1000, 2000, 5000, 1e4], hr = "#FFF1F5F9", _r = "#FF475569", si = "#FF22C55E", ci = "#FFEF4444", vr = "#FFFFFFFF";
  function ui(t) {
    const [r, n] = z(0), [i, l] = z(false), [u, F] = z(0), [v, A] = z(false);
    return (() => {
      var T = a("column"), O = a("text"), S = a("text"), m = a("row"), f = a("button"), _ = a("button");
      return b(T, O), b(T, S), b(T, m), e(T, "background", "#FFFFFFFF"), e(T, "padding", 12), e(T, "cornerRadius", 10), e(T, "borderWidth", 1), e(T, "borderColor", "#FFE5E5EA"), e(T, "gap", 6), e(O, "fontWeight", 700), e(O, "fontSize", 14), e(O, "color", "#FF1DA1F2"), e(S, "fontSize", 14), e(S, "color", "#FF1F2937"), e(S, "maxLines", 3), e(S, "textOverflow", 1), b(m, f), b(m, _), e(m, "gap", 10), e(f, "fontSize", 12), e(f, "padding", 6), e(f, "cornerRadius", 16), e(f, "onClick", () => {
        const d = !i();
        l(d), n(r() + (d ? 1 : -1));
      }), e(_, "fontSize", 12), e(_, "padding", 6), e(_, "cornerRadius", 16), e(_, "onClick", () => {
        const d = !v();
        A(d), F(u() + (d ? 1 : -1));
      }), M((d) => {
        var c = `#${t.num} \xB7 ${t.author}`, w = t.body, s = `\u2665 ${r()}`, g = i() ? si : hr, h = i() ? vr : _r, C = `\u21A9 ${u()}`, $ = v() ? ci : hr, D = v() ? vr : _r;
        return c !== d.e && (d.e = e(O, "label", c, d.e)), w !== d.t && (d.t = e(S, "label", w, d.t)), s !== d.a && (d.a = e(f, "label", s, d.a)), g !== d.o && (d.o = e(f, "background", g, d.o)), h !== d.i && (d.i = e(f, "color", h, d.i)), C !== d.n && (d.n = e(_, "label", C, d.n)), $ !== d.s && (d.s = e(_, "background", $, d.s)), D !== d.h && (d.h = e(_, "color", D, d.h)), d;
      }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined, n: undefined, s: undefined, h: undefined }), T;
    })();
  }
  function fi() {
    const [t, r] = z(50), [n, i] = z(""), l = Me(() => ai.slice(0, t()));
    return (() => {
      var u = a("listView"), F = a("text"), v = a("text"), A = a("wrap"), T = a("text");
      return b(u, F), b(u, v), b(u, A), b(u, T), e(u, "background", "#FFF2F2F7"), e(u, "padding", 16), e(u, "gap", 12), e(F, "label", "Tweet feed \u2014 virtualized"), e(F, "fontSize", 24), e(F, "fontWeight", 800), e(F, "color", "#FF1C1C1E"), e(v, "label", "ListView.builder materializes only the visible window; the source pool is 15 000 items. Tap a count to mount N."), e(v, "fontSize", 13), e(v, "color", "#FF8E8E93"), e(A, "gap", 6), N(A, I(ne, { each: li, children: (O) => (() => {
        var S = a("button");
        return e(S, "label", `${O}`), e(S, "onClick", () => {
          const m = performance.now();
          try {
            r(O), i(`mounted ${O} in ${(performance.now() - m).toFixed(2)} ms`);
          } catch (f) {
            i(`ERROR @ ${O}: ${f && (f.message || String(f)) || "unknown"}`);
          }
        }), S;
      })() })), e(T, "fontSize", 12), e(T, "color", "#FF8E8E93"), N(u, I(ne, { get each() {
        return l();
      }, children: (O) => I(ui, { get author() {
        return O.author;
      }, get body() {
        return O.body;
      }, get num() {
        return O.num;
      } }) }), null), M((O) => e(T, "label", n() || `showing ${t()} tweets`, O)), u;
    })();
  }
  function di() {
    const [t, r] = z("\u2014 waiting for counter events \u2014"), n = ei(), [i, l] = z("\u2014 tap a button to RPC the Ticker \u2014"), [u, F] = z(null), [v, A] = z(false);
    return (() => {
      var T = a("scrollView"), O = a("text"), S = a("text"), m = a("text");
      return b(T, O), b(T, S), b(T, m), e(T, "background", "#FFF2F2F7"), e(T, "padding", 16), e(T, "gap", 14), e(O, "label", "Libraries \u2014 codegen-wrapped widgets"), e(O, "fontSize", 24), e(O, "fontWeight", 800), e(O, "color", "#FF1C1C1E"), e(S, "label", "Custom adapters + real pub.dev packages, brought into JSX by skal_codegen. Imported from 'skal-flutter'."), e(S, "fontSize", 13), e(S, "color", "#FF8E8E93"), N(T, I(G, { title: "Greeting \u2014 hand-written adapter", get children() {
        var f = a("greeting");
        return e(f, "name", "Skal"), e(f, "color", "#FF1DA1F2"), e(f, "fontSize", 20), f;
      } }), m), N(T, I(G, { title: "Shimmer \u2014 pub.dev, named-ctor wrap", get children() {
        return [(() => {
          var f = a("text");
          return e(f, "label", "ShimmerFromColors \u2014 codegen-synthesized from the Shimmer.fromColors named constructor."), e(f, "fontSize", 11), e(f, "color", "#FF8E8E93"), f;
        })(), (() => {
          var f = a("shimmerFromColors"), _ = a("greeting");
          return b(f, _), e(f, "baseColor", 4290624957), e(f, "highlightColor", 4292927712), e(f, "period", 1500), e(_, "name", "loading\u2026"), e(_, "color", "#FF333333"), e(_, "fontSize", 28), f;
        })()];
      } }), m), N(T, I(G, { title: "QR code \u2014 qr_flutter, pub.dev wrap", get children() {
        return [(() => {
          var f = a("qrImageView");
          return e(f, "data", "https://skal.dev"), e(f, "size", 200), f;
        })(), (() => {
          var f = a("text");
          return e(f, "label", "QrImageView, generated against qr_flutter's class."), e(f, "fontSize", 11), e(f, "color", "#FF8E8E93"), f;
        })()];
      } }), m), N(T, I(G, { title: "Camera \u2014 host-pattern wrap (controller lifecycle)", get children() {
        return [(() => {
          var f = a("text");
          return e(f, "label", "A synthesized _CameraHost owns the CameraController (init in initState, dispose on unmount). The controller initializes only once Start mounts <Camera> \u2014 no camera / permission \u2192 an inline error banner."), e(f, "fontSize", 11), e(f, "color", "#FF8E8E93"), f;
        })(), (() => {
          var f = a("button");
          return e(f, "onClick", () => A(!v())), M((_) => e(f, "label", v() ? "Stop camera" : "Start camera", _)), f;
        })(), mt(() => mt(() => !!v())() && (() => {
          var f = a("box"), _ = a("camera");
          return b(f, _), e(f, "background", "#FF000000"), e(f, "padding", 4), e(f, "cornerRadius", 8), e(_, "resolutionIndex", 1), f;
        })())];
      } }), m), N(T, I(G, { title: "Counter \u2014 typed callbacks back to JSX", get children() {
        return [(() => {
          var f = a("counter");
          return e(f, "initial", 0), e(f, "onChanged", (_) => r(`onChanged(${_})`)), e(f, "onReset", () => r("onReset()")), f;
        })(), (() => {
          var f = a("text");
          return e(f, "fontSize", 13), e(f, "color", "#FF1C1C1E"), M((_) => e(f, "label", t(), _)), f;
        })()];
      } }), m), N(T, I(G, { title: "Ticker \u2014 JS \u2192 Dart imperative RPC", get children() {
        return [(() => {
          var f = a("ticker");
          return Qn(n, f), e(f, "intervalMs", 500), f;
        })(), (() => {
          var f = a("wrap"), _ = a("button"), d = a("button"), c = a("button"), w = a("button"), s = a("button"), g = a("button"), h = a("button"), C = a("button");
          return b(f, _), b(f, d), b(f, c), b(f, w), b(f, s), b(f, g), b(f, h), b(f, C), e(f, "gap", 6), e(_, "label", "pause"), e(_, "onClick", async () => {
            await n.pause(), l("pause() \u2713");
          }), e(d, "label", "resume"), e(d, "onClick", async () => {
            await n.resume(), l("resume() \u2713");
          }), e(c, "label", "reset"), e(c, "onClick", async () => {
            await n.reset(), l("reset() \u2713");
          }), e(w, "label", "+10"), e(w, "onClick", async () => {
            await n.bump(10), l(`bump(10), now getValue() \u2192 ${await n.getValue()}`);
          }), e(s, "label", "read"), e(s, "onClick", async () => {
            l(`getValue() \u2192 ${await n.getValue()}, isPaused() \u2192 ${await n.isPaused()}`);
          }), e(g, "label", "describe"), e(g, "onClick", async () => {
            l(`describe() \u2192 ${await n.describe("hello from JSX")}`);
          }), e(h, "label", "snapshot"), e(h, "onClick", async () => {
            const $ = await n.snapshot();
            l(`snapshot() \u2192 value=${$.value} paused=${$.paused} ts=${$.timestamp}`);
          }), e(C, "label", "sub/unsub"), e(C, "onClick", () => {
            if (u())
              u()(), F(() => null), l("unsubscribed from ticks$");
            else {
              const $ = n.ticks$((D) => {
                l(`stream tick: ${D}`);
              });
              F(() => $), l("subscribed to ticks$ \u2014 wait for emissions\u2026");
            }
          }), f;
        })(), (() => {
          var f = a("text");
          return e(f, "fontSize", 13), e(f, "color", "#FF1C1C1E"), M((_) => e(f, "label", i(), _)), f;
        })()];
      } }), m), N(T, I(G, { title: "Stickers \u2014 List<Widget> children + gradient prop", get children() {
        var f = a("stickers"), _ = a("greeting"), d = a("greeting"), c = a("greeting");
        return b(f, _), b(f, d), b(f, c), e(f, "gap", 6), e(f, "padding", 10), e(f, "gradient", { type: "linear", colors: ["#FFFFE082", "#FFB0F0D0", "#FFB0E0FF"], stops: [0, 0.5, 1], begin: "topLeft", end: "bottomRight" }), e(_, "name", "multi-child A"), e(_, "color", "#FF6B4F00"), e(_, "fontSize", 14), e(d, "name", "multi-child B"), e(d, "color", "#FF6B4F00"), e(d, "fontSize", 14), e(c, "name", "multi-child C"), e(c, "color", "#FF6B4F00"), e(c, "fontSize", 14), f;
      } }), m), e(m, "label", "\u2014 end of Libs demo \u2014"), e(m, "fontSize", 12), e(m, "color", "#FF8E8E93"), T;
    })();
  }
  function gi() {
    const [t, r] = z(0);
    return (() => {
      var n = a("tabs"), i = a("tab"), l = a("tab"), u = a("tab");
      return b(n, i), b(n, l), b(n, u), e(n, "onChange", r), e(n, "height", "fill"), e(i, "title", "UI"), e(i, "icon", "grid"), N(i, I(oi, {})), e(l, "title", "List"), e(l, "icon", "list"), N(l, I(fi, {})), e(u, "title", "Libs"), e(u, "icon", "explore"), N(u, I(di, {})), M((F) => e(n, "activeTab", t(), F)), n;
    })();
  }
  Kn(() => I(gi, {}), Zn);
})();
})
