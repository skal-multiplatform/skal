// @bun @bytecode @bun-cjs
(function(exports, require, module, __filename, __dirname) {// ../flutter/skal_flutter/assets/skal-app.js
(function() {
  var j = { context: undefined, registry: undefined, effects: undefined, done: false, getContextId() {
    return pt(this.context.count);
  }, getNextContextId() {
    return pt(this.context.count++);
  } };
  function pt(e) {
    const r = String(e), n = r.length - 1;
    return j.context.id + (n ? String.fromCharCode(96 + n) : "") + r;
  }
  function rt(e) {
    j.context = e;
  }
  function vr() {
    return { ...j.context, id: j.getNextContextId(), count: 0 };
  }
  var br = (e, r) => e === r, nt = Symbol("solid-proxy"), Er = typeof Proxy == "function", Sr = Symbol("solid-track"), ze = { equals: br }, wt = null, Tt = At, Q = 1, ye = 2, Rt = { owned: null, cleanups: null, context: null, owner: null }, D = null, T = null, Ae = null, Se = null, H = null, X = null, J = null, We = 0;
  function He(e, r) {
    const n = H, o = D, l = e.length === 0, s = r === undefined ? o : r, d = l ? Rt : { owned: null, cleanups: null, context: s ? s.context : null, owner: s }, h = l ? e : () => e(() => Fe(() => le(d)));
    D = d, H = null;
    try {
      return ie(h, true);
    } finally {
      H = n, D = o;
    }
  }
  function z(e, r) {
    r = r ? Object.assign({}, ze, r) : ze;
    const n = { value: e, observers: null, observerSlots: null, comparator: r.equals || undefined }, o = (l) => (typeof l == "function" && (T && T.running && T.sources.has(n) ? l = l(n.tValue) : l = l(n.value)), Ct(n, l));
    return [Ot.bind(n), o];
  }
  function oe(e, r, n) {
    const o = ot(e, r, false, Q);
    Ae && T && T.running ? X.push(o) : xe(o);
  }
  function Fr(e, r, n) {
    Tt = mr;
    const o = ot(e, r, false, Q), l = it && wr(it);
    l && (o.suspense = l), (!n || !n.render) && (o.user = true), J ? J.push(o) : xe(o);
  }
  function Ge(e, r, n) {
    n = n ? Object.assign({}, ze, n) : ze;
    const o = ot(e, r, true, 0);
    return o.observers = null, o.observerSlots = null, o.comparator = n.equals || undefined, Ae && T && T.running ? (o.tState = Q, X.push(o)) : xe(o), Ot.bind(o);
  }
  function Fe(e) {
    if (!Se && H === null)
      return e();
    const r = H;
    H = null;
    try {
      return Se ? Se.untrack(e) : e();
    } finally {
      H = r;
    }
  }
  function mt(e) {
    return D === null || (D.cleanups === null ? D.cleanups = [e] : D.cleanups.push(e)), e;
  }
  function pr(e) {
    if (T && T.running)
      return e(), T.done;
    const r = H, n = D;
    return Promise.resolve().then(() => {
      H = r, D = n;
      let o;
      return (Ae || it) && (o = T || (T = { sources: new Set, effects: [], promises: new Set, disposed: new Set, queue: new Set, running: true }), o.done || (o.done = new Promise((l) => o.resolve = l)), o.running = true), ie(e, false), H = D = null, o ? o.done : undefined;
    });
  }
  var [ui, Pt] = z(false);
  function wr(e) {
    let r;
    return D && D.context && (r = D.context[e.id]) !== undefined ? r : e.defaultValue;
  }
  var it;
  function Ot() {
    const e = T && T.running;
    if (this.sources && (e ? this.tState : this.state))
      if ((e ? this.tState : this.state) === Q)
        xe(this);
      else {
        const r = X;
        X = null, ie(() => Me(this), false), X = r;
      }
    if (H) {
      const r = this.observers ? this.observers.length : 0;
      H.sources ? (H.sources.push(this), H.sourceSlots.push(r)) : (H.sources = [this], H.sourceSlots = [r]), this.observers ? (this.observers.push(H), this.observerSlots.push(H.sources.length - 1)) : (this.observers = [H], this.observerSlots = [H.sources.length - 1]);
    }
    return e && T.sources.has(this) ? this.tValue : this.value;
  }
  function Ct(e, r, n) {
    let o = T && T.running && T.sources.has(e) ? e.tValue : e.value;
    if (!e.comparator || !e.comparator(o, r)) {
      if (T) {
        const l = T.running;
        (l || !n && T.sources.has(e)) && (T.sources.add(e), e.tValue = r), l || (e.value = r);
      } else
        e.value = r;
      e.observers && e.observers.length && ie(() => {
        for (let l = 0;l < e.observers.length; l += 1) {
          const s = e.observers[l], d = T && T.running;
          d && T.disposed.has(s) || ((d ? !s.tState : !s.state) && (s.pure ? X.push(s) : J.push(s), s.observers && xt(s)), d ? s.tState = Q : s.state = Q);
        }
        if (X.length > 1e6)
          throw X = [], new Error;
      }, false);
    }
    return r;
  }
  function xe(e) {
    if (!e.fn)
      return;
    le(e);
    const r = We;
    yt(e, T && T.running && T.sources.has(e) ? e.tValue : e.value, r), T && !T.running && T.sources.has(e) && queueMicrotask(() => {
      ie(() => {
        T && (T.running = true), H = D = e, yt(e, e.tValue, r), H = D = null;
      }, false);
    });
  }
  function yt(e, r, n) {
    let o;
    const l = D, s = H;
    H = D = e;
    try {
      o = e.fn(r);
    } catch (d) {
      return e.pure && (T && T.running ? (e.tState = Q, e.tOwned && e.tOwned.forEach(le), e.tOwned = undefined) : (e.state = Q, e.owned && e.owned.forEach(le), e.owned = null)), e.updatedAt = n + 1, lt(d);
    } finally {
      H = s, D = l;
    }
    (!e.updatedAt || e.updatedAt <= n) && (e.updatedAt != null && ("observers" in e) ? Ct(e, o, true) : T && T.running && e.pure ? (T.sources.has(e) || (e.value = o), T.sources.add(e), e.tValue = o) : e.value = o, e.updatedAt = n);
  }
  function ot(e, r, n, o = Q, l) {
    const s = { fn: e, state: o, updatedAt: null, owned: null, sources: null, sourceSlots: null, cleanups: null, value: r, owner: D, context: D ? D.context : null, pure: n };
    if (T && T.running && (s.state = 0, s.tState = o), D === null || D !== Rt && (T && T.running && D.pure ? D.tOwned ? D.tOwned.push(s) : D.tOwned = [s] : D.owned ? D.owned.push(s) : D.owned = [s]), Se && s.fn) {
      const d = s.fn, [h, O] = z(undefined, { equals: false }), w = Se.factory(d, O);
      mt(() => w.dispose());
      let m;
      const S = () => pr(O).then(() => {
        m && (m.dispose(), m = undefined);
      });
      s.fn = (v) => (h(), T && T.running ? (m || (m = Se.factory(d, S)), m.track(v)) : w.track(v));
    }
    return s;
  }
  function ke(e) {
    const r = T && T.running;
    if ((r ? e.tState : e.state) === 0)
      return;
    if ((r ? e.tState : e.state) === ye)
      return Me(e);
    if (e.suspense && Fe(e.suspense.inFallback))
      return e.suspense.effects.push(e);
    const n = [e];
    for (;(e = e.owner) && (!e.updatedAt || e.updatedAt < We); ) {
      if (r && T.disposed.has(e))
        return;
      (r ? e.tState : e.state) && n.push(e);
    }
    for (let o = n.length - 1;o >= 0; o--) {
      if (e = n[o], r) {
        let l = e, s = n[o + 1];
        for (;(l = l.owner) && l !== s; )
          if (T.disposed.has(l))
            return;
      }
      if ((r ? e.tState : e.state) === Q)
        xe(e);
      else if ((r ? e.tState : e.state) === ye) {
        const l = X;
        X = null, ie(() => Me(e, n[0]), false), X = l;
      }
    }
  }
  function ie(e, r) {
    if (X)
      return e();
    let n = false;
    r || (X = []), J ? n = true : J = [], We++;
    try {
      const o = e();
      return Tr(n), o;
    } catch (o) {
      n || (J = null), X = null, lt(o);
    }
  }
  function Tr(e) {
    if (X && (Ae && T && T.running ? Rr(X) : At(X), X = null), e)
      return;
    let r;
    if (T) {
      if (!T.promises.size && !T.queue.size) {
        const { sources: o, disposed: l } = T;
        J.push.apply(J, T.effects), r = T.resolve;
        for (const s of J)
          "tState" in s && (s.state = s.tState), delete s.tState;
        T = null, ie(() => {
          for (const s of l)
            le(s);
          for (const s of o) {
            if (s.value = s.tValue, s.owned)
              for (let d = 0, h = s.owned.length;d < h; d++)
                le(s.owned[d]);
            s.tOwned && (s.owned = s.tOwned), delete s.tValue, delete s.tOwned, s.tState = 0;
          }
          Pt(false);
        }, false);
      } else if (T.running) {
        T.running = false, T.effects.push.apply(T.effects, J), J = null, Pt(true);
        return;
      }
    }
    const n = J;
    J = null, n.length && ie(() => Tt(n), false), r && r();
  }
  function At(e) {
    for (let r = 0;r < e.length; r++)
      ke(e[r]);
  }
  function Rr(e) {
    for (let r = 0;r < e.length; r++) {
      const n = e[r], o = T.queue;
      o.has(n) || (o.add(n), Ae(() => {
        o.delete(n), ie(() => {
          T.running = true, ke(n);
        }, false), T && (T.running = false);
      }));
    }
  }
  function mr(e) {
    let r, n = 0;
    for (r = 0;r < e.length; r++) {
      const o = e[r];
      o.user ? e[n++] = o : ke(o);
    }
    if (j.context) {
      if (j.count) {
        j.effects || (j.effects = []), j.effects.push(...e.slice(0, n));
        return;
      }
      rt();
    }
    for (j.effects && (j.done || !j.count) && (e = [...j.effects, ...e], n += j.effects.length, delete j.effects), r = 0;r < n; r++)
      ke(e[r]);
  }
  function Me(e, r) {
    const n = T && T.running;
    n ? e.tState = 0 : e.state = 0;
    for (let o = 0;o < e.sources.length; o += 1) {
      const l = e.sources[o];
      if (l.sources) {
        const s = n ? l.tState : l.state;
        s === Q ? l !== r && (!l.updatedAt || l.updatedAt < We) && ke(l) : s === ye && Me(l, r);
      }
    }
  }
  function xt(e) {
    const r = T && T.running;
    for (let n = 0;n < e.observers.length; n += 1) {
      const o = e.observers[n];
      (r ? !o.tState : !o.state) && (r ? o.tState = ye : o.state = ye, o.pure ? X.push(o) : J.push(o), o.observers && xt(o));
    }
  }
  function le(e) {
    let r;
    if (e.sources)
      for (;e.sources.length; ) {
        const n = e.sources.pop(), o = e.sourceSlots.pop(), l = n.observers;
        if (l && l.length) {
          const s = l.pop(), d = n.observerSlots.pop();
          o < l.length && (s.sourceSlots[d] = o, l[o] = s, n.observerSlots[o] = d);
        }
      }
    if (e.tOwned) {
      for (r = e.tOwned.length - 1;r >= 0; r--)
        le(e.tOwned[r]);
      delete e.tOwned;
    }
    if (T && T.running && e.pure)
      kt(e, true);
    else if (e.owned) {
      for (r = e.owned.length - 1;r >= 0; r--)
        le(e.owned[r]);
      e.owned = null;
    }
    if (e.cleanups) {
      for (r = e.cleanups.length - 1;r >= 0; r--)
        e.cleanups[r]();
      e.cleanups = null;
    }
    T && T.running ? e.tState = 0 : e.state = 0;
  }
  function kt(e, r) {
    if (r || (e.tState = 0, T.disposed.add(e)), e.owned)
      for (let n = 0;n < e.owned.length; n++)
        kt(e.owned[n]);
  }
  function Pr(e) {
    return e instanceof Error ? e : new Error(typeof e == "string" ? e : "Unknown error", { cause: e });
  }
  function It(e, r, n) {
    try {
      for (const o of r)
        o(e);
    } catch (o) {
      lt(o, n && n.owner || null);
    }
  }
  function lt(e, r = D) {
    const n = wt && r && r.context && r.context[wt], o = Pr(e);
    if (!n)
      throw o;
    J ? J.push({ fn() {
      It(o, n, r);
    }, state: Q }) : It(o, n, r);
  }
  var Or = Symbol("fallback");
  function $t(e) {
    for (let r = 0;r < e.length; r++)
      e[r]();
  }
  function Cr(e, r, n = {}) {
    let o = [], l = [], s = [], d = 0, h = r.length > 1 ? [] : null;
    return mt(() => $t(s)), () => {
      let O = e() || [], w = O.length, m, S;
      return O[Sr], Fe(() => {
        let c, E, _, V, M, F, b, g, C;
        if (w === 0)
          d !== 0 && ($t(s), s = [], o = [], l = [], d = 0, h && (h = [])), n.fallback && (o = [Or], l[0] = He((x) => (s[0] = x, n.fallback())), d = 1);
        else if (d === 0) {
          for (l = new Array(w), S = 0;S < w; S++)
            o[S] = O[S], l[S] = He(v);
          d = w;
        } else {
          for (_ = new Array(w), V = new Array(w), h && (M = new Array(w)), F = 0, b = Math.min(d, w);F < b && o[F] === O[F]; F++)
            ;
          for (b = d - 1, g = w - 1;b >= F && g >= F && o[b] === O[g]; b--, g--)
            _[g] = l[b], V[g] = s[b], h && (M[g] = h[b]);
          for (c = new Map, E = new Array(g + 1), S = g;S >= F; S--)
            C = O[S], m = c.get(C), E[S] = m === undefined ? -1 : m, c.set(C, S);
          for (m = F;m <= b; m++)
            C = o[m], S = c.get(C), S !== undefined && S !== -1 ? (_[S] = l[m], V[S] = s[m], h && (M[S] = h[m]), S = E[S], c.set(C, S)) : s[m]();
          for (S = F;S < w; S++)
            S in _ ? (l[S] = _[S], s[S] = V[S], h && (h[S] = M[S], h[S](S))) : l[S] = He(v);
          l = l.slice(0, d = w), o = O.slice(0);
        }
        return l;
      });
      function v(c) {
        if (s[S] = c, h) {
          const [E, _] = z(S);
          return h[S] = _, r(O[S], E);
        }
        return r(O[S]);
      }
    };
  }
  var yr = false;
  function Ar(e, r) {
    if (yr && j.context) {
      const n = j.context;
      rt(vr());
      const o = Fe(() => e(r || {}));
      return rt(n), o;
    }
    return Fe(() => e(r || {}));
  }
  function Ue() {
    return true;
  }
  var xr = { get(e, r, n) {
    return r === nt ? n : e.get(r);
  }, has(e, r) {
    return r === nt ? true : e.has(r);
  }, set: Ue, deleteProperty: Ue, getOwnPropertyDescriptor(e, r) {
    return { configurable: true, enumerable: true, get() {
      return e.get(r);
    }, set: Ue, deleteProperty: Ue };
  }, ownKeys(e) {
    return e.keys();
  } };
  function at(e) {
    return (e = typeof e == "function" ? e() : e) ? e : {};
  }
  function kr() {
    for (let e = 0, r = this.length;e < r; ++e) {
      const n = this[e]();
      if (n !== undefined)
        return n;
    }
  }
  function Nt(...e) {
    let r = false;
    for (let d = 0;d < e.length; d++) {
      const h = e[d];
      r = r || !!h && nt in h, e[d] = typeof h == "function" ? (r = true, Ge(h)) : h;
    }
    if (Er && r)
      return new Proxy({ get(d) {
        for (let h = e.length - 1;h >= 0; h--) {
          const O = at(e[h])[d];
          if (O !== undefined)
            return O;
        }
      }, has(d) {
        for (let h = e.length - 1;h >= 0; h--)
          if (d in at(e[h]))
            return true;
        return false;
      }, keys() {
        const d = [];
        for (let h = 0;h < e.length; h++)
          d.push(...Object.keys(at(e[h])));
        return [...new Set(d)];
      } }, xr);
    const n = {}, o = Object.create(null);
    for (let d = e.length - 1;d >= 0; d--) {
      const h = e[d];
      if (!h)
        continue;
      const O = Object.getOwnPropertyNames(h);
      for (let w = O.length - 1;w >= 0; w--) {
        const m = O[w];
        if (m === "__proto__" || m === "constructor")
          continue;
        const S = Object.getOwnPropertyDescriptor(h, m);
        if (!o[m])
          o[m] = S.get ? { enumerable: true, configurable: true, get: kr.bind(n[m] = [S.get.bind(h)]) } : S.value !== undefined ? S : undefined;
        else {
          const v = n[m];
          v && (S.get ? v.push(S.get.bind(h)) : S.value !== undefined && v.push(() => S.value));
        }
      }
    }
    const l = {}, s = Object.keys(o);
    for (let d = s.length - 1;d >= 0; d--) {
      const h = s[d], O = o[h];
      O && O.get ? Object.defineProperty(l, h, O) : l[h] = O ? O.value : undefined;
    }
    return l;
  }
  function ae(e) {
    const r = "fallback" in e && { fallback: () => e.fallback };
    return Ge(Cr(() => e.each, e.children, r || undefined));
  }
  var Ir = (e) => Ge(() => e());
  function $r({ createElement: e, createTextNode: r, isTextNode: n, replaceText: o, insertNode: l, removeNode: s, setProperty: d, getParentNode: h, getFirstChild: O, getNextSibling: w }) {
    function m(F, b, g, C) {
      if (g !== undefined && !C && (C = []), typeof b != "function")
        return S(F, b, C, g);
      oe((x) => S(F, b(), x, g), C);
    }
    function S(F, b, g, C, x) {
      for (;typeof g == "function"; )
        g = g();
      if (b === g)
        return g;
      const k = typeof b, R = C !== undefined;
      if (k === "string" || k === "number")
        if (k === "number" && (b = b.toString()), R) {
          let A = g[0];
          A && n(A) ? o(A, b) : A = r(b), g = E(F, g, C, A);
        } else
          g !== "" && typeof g == "string" ? o(O(F), g = b) : (E(F, g, C, r(b)), g = b);
      else if (b == null || k === "boolean")
        g = E(F, g, C);
      else {
        if (k === "function")
          return oe(() => {
            let A = b();
            for (;typeof A == "function"; )
              A = A();
            g = S(F, A, g, C);
          }), () => g;
        if (Array.isArray(b)) {
          const A = [];
          if (v(A, b, x))
            return oe(() => g = S(F, A, g, C, true)), () => g;
          if (A.length === 0) {
            const ee = E(F, g, C);
            if (R)
              return g = ee;
          } else
            Array.isArray(g) ? g.length === 0 ? _(F, A, C) : c(F, g, A) : g == null || g === "" ? _(F, A) : c(F, R && g || [O(F)], A);
          g = A;
        } else {
          if (Array.isArray(g)) {
            if (R)
              return g = E(F, g, C, b);
            E(F, g, null, b);
          } else
            g == null || g === "" || !O(F) ? l(F, b) : V(F, b, O(F));
          g = b;
        }
      }
      return g;
    }
    function v(F, b, g) {
      let C = false;
      for (let x = 0, k = b.length;x < k; x++) {
        let R = b[x], A;
        if (!(R == null || R === true || R === false))
          if (Array.isArray(R))
            C = v(F, R) || C;
          else if ((A = typeof R) == "string" || A === "number")
            F.push(r(R));
          else if (A === "function")
            if (g) {
              for (;typeof R == "function"; )
                R = R();
              C = v(F, Array.isArray(R) ? R : [R]) || C;
            } else
              F.push(R), C = true;
          else
            F.push(R);
      }
      return C;
    }
    function c(F, b, g) {
      let C = g.length, x = b.length, k = C, R = 0, A = 0, ee = w(b[x - 1]), W = null;
      for (;R < x || A < k; ) {
        if (b[R] === g[A]) {
          R++, A++;
          continue;
        }
        for (;b[x - 1] === g[k - 1]; )
          x--, k--;
        if (x === R) {
          const i = k < C ? A ? w(g[A - 1]) : g[k - A] : ee;
          for (;A < k; )
            l(F, g[A++], i);
        } else if (k === A)
          for (;R < x; )
            (!W || !W.has(b[R])) && s(F, b[R]), R++;
        else if (b[R] === g[k - 1] && g[A] === b[x - 1]) {
          const i = w(b[--x]);
          l(F, g[A++], w(b[R++])), l(F, g[--k], i), b[x] = g[k];
        } else {
          if (!W) {
            W = new Map;
            let u = A;
            for (;u < k; )
              W.set(g[u], u++);
          }
          const i = W.get(b[R]);
          if (i != null)
            if (A < i && i < k) {
              let u = R, f = 1, P;
              for (;++u < x && u < k && !((P = W.get(b[u])) == null || P !== i + f); )
                f++;
              if (f > i - A) {
                const N = b[R];
                for (;A < i; )
                  l(F, g[A++], N);
              } else
                V(F, g[A++], b[R++]);
            } else
              R++;
          else
            s(F, b[R++]);
        }
      }
    }
    function E(F, b, g, C) {
      if (g === undefined) {
        let k;
        for (;k = O(F); )
          s(F, k);
        return C && l(F, C), "";
      }
      const x = C || r("");
      if (b.length) {
        let k = false;
        for (let R = b.length - 1;R >= 0; R--) {
          const A = b[R];
          if (x !== A) {
            const ee = h(A) === F;
            !k && !R ? ee ? V(F, x, A) : l(F, x, g) : ee && s(F, A);
          } else
            k = true;
        }
      } else
        l(F, x, g);
      return [x];
    }
    function _(F, b, g) {
      for (let C = 0, x = b.length;C < x; C++)
        l(F, b[C], g);
    }
    function V(F, b, g) {
      l(F, b, g), s(F, g);
    }
    function M(F, b, g = {}, C) {
      return b || (b = {}), C || oe(() => g.children = S(F, b.children, g.children)), oe(() => b.ref && b.ref(F)), oe(() => {
        for (const x in b) {
          if (x === "children" || x === "ref")
            continue;
          const k = b[x];
          k !== g[x] && (d(F, x, k, g[x]), g[x] = k);
        }
      }), g;
    }
    return { render(F, b) {
      let g;
      return He((C) => {
        g = C, m(b, F());
      }), g;
    }, insert: m, spread(F, b, g) {
      typeof b == "function" ? oe((C) => M(F, b(), C, g)) : M(F, b, undefined, g);
    }, createElement: e, createTextNode: r, insertNode: l, setProp(F, b, g, C) {
      return d(F, b, g, C), g;
    }, mergeProps: Nt, effect: oe, memo: Ir, createComponent: Ar, use(F, b, g) {
      return Fe(() => F(b, g));
    } };
  }
  function Nr(e) {
    const r = $r(e);
    return r.mergeProps = Nt, r;
  }
  var Dt = 6 * 1024 * 1024, Dr = 64, fi = Dr, Lt = 4 * 1024 * 1024, pe = 64 + Lt, st = 768 * 1024, ct = pe + st, Lr = 256 * 1024, ut = ct + Lr, Vt = pe + st, Vr = 0, Br = 8, zr = 12, Wr = 16, Hr = 24, Gr = 28, Mr = 32, Ur = 40, Xr = 44, Yr = Br >> 2, jr = zr >> 2, Jr = Hr >> 2, Bt = Gr >> 2, Kr = Ur >> 2;
  Xr >> 2;
  var qr = Vr >> 3, Qr = Wr >> 3, Zr = Mr >> 3, gi = 1, hi = 2, di = 3, _i = 4, vi = 16, bi = 17, Ei = 20, Si = 21, Fi = 22, pi = 23, wi = 24, Ti = 25, Ri = 26, mi = 27, Pi = 28, Oi = 29, Ci = 30, yi = 31, Ai = 32, xi = 33, ki = 34, Ii = 35, $i = 36, Ni = 37, Di = 38, Li = 0, Vi = 1, Bi = 2, zi = 3, Wi = 4, Hi = 5, Gi = 6, Mi = 7, Ui = 9, Xi = 10, Yi = 11, ji = 12, Ji = 13, Ki = 14, qi = 15, Qi = 16, Zi = 17, eo = 18, to = 19, ro = 20, no = 21, io = 22, oo = 23, lo = 24, ao = 1, so = 2, co = 3, uo = 4, fo = 5, go = 6, ho = 7, _o = 8, vo = 9, bo = 10, Eo = 11, So = 12, Fo = 0, po = 1, wo = 2, To = 3, Ro = 4, mo = 5, Po = 6, Oo = 0, Co = 1, yo = 2, Ao = 3, xo = 4, ko = 5, Io = 6, $o = 7, No = 8, Do = 9, Lo = 10, Vo = 11, Bo = 12, zo = 13, Wo = 14, Ho = 15, Go = 16, Mo = 32, Uo = 33, Xo = 34, Yo = 35, jo = 36, Jo = 37, Ko = 64, qo = 65, Qo = 66, Zo = 67, el = 68, tl = 69, rl = 70, nl = 71, il = 96, ol = 97, ll = 98, al = 128, sl = 129, cl = 130, ul = 131, fl = 132, gl = 133, hl = 134, dl = 135, _l = 136, vl = 137, bl = 160, El = 161, Sl = 162, Fl = 163, pl = 164, wl = 165, Tl = 166, Rl = -1, en = 2147483646, tn = 2147483645, ue = globalThis.__skal_acquireBridge();
  if (!ue || ue.byteLength !== Dt)
    throw new Error(`Skal: bridge buffer not available (got ${ue && ue.byteLength})`);
  var zt = new Uint8Array(ue), K = new Uint32Array(ue), ft = new BigInt64Array(ue), rn = new TextEncoder, Ie = 16, nn = 64 + Lt >> 2, on = 16384, ln = nn - 4, Xe = 0n, se = Ie, we = pe, Ye = Ie;
  function gt() {
    K[Yr] = se - Ie << 2, K[jr] = we - pe, Xe += 1n, Atomics.store(ft, qr, Xe), Ye = se;
  }
  function Wt() {
    gt();
    const e = Xe, r = performance.now() + 5000;
    for (;!(Atomics.load(ft, Zr) >= e); )
      if (performance.now() > r) {
        console.warn("Skal: drain spin timeout \u2014 UI thread slow; ring will overwrite");
        break;
      }
    se = Ie, we = pe, Ye = Ie;
  }
  function L(e, r, n, o) {
    let l = se;
    l >= ln && (Wt(), l = se), K[l] = e >>> 0, K[l + 1] = r >>> 0, K[l + 2] = n >>> 0, K[l + 3] = o >>> 0, se = l + 4, se - Ye >= on && gt();
  }
  var fe = 0, ge = 0;
  function Te(e) {
    we + e.length * 3 > Vt && Wt();
    const r = we - pe, n = zt.subarray(we, Vt), { read: o, written: l } = rn.encodeInto(e, n);
    if (o !== e.length)
      throw new Error(`Skal: string too large for heap (${e.length} code units > ${st} bytes)`);
    we += l, fe = r, ge = l;
  }
  function ht(e, r) {
    Te(r), L(20, e, fe, ge);
  }
  var dt = false;
  function an() {
    dt = false, se !== Ye && gt();
  }
  function B() {
    dt || (dt = true, queueMicrotask(an));
  }
  var te = 1024, y = new Int8Array(256);
  y.fill(-1), y[0] = 0, y[1] = 1, y[2] = 2, y[3] = 3, y[4] = 4, y[5] = 5, y[6] = 6, y[7] = 7, y[8] = 8, y[9] = 9, y[32] = 10, y[33] = 11, y[34] = 12, y[35] = 13, y[36] = 14, y[37] = 15, y[64] = 16, y[65] = 17, y[66] = 18, y[67] = 19, y[68] = 20, y[69] = 21, y[70] = 22, y[96] = 23, y[97] = 24, y[128] = 25, y[129] = 26, y[130] = 27, y[131] = 28, y[160] = 29, y[161] = 30, y[162] = 31, y[10] = 32, y[11] = 33, y[12] = 34, y[13] = 35, y[14] = 36, y[15] = 37, y[16] = 38, y[132] = 39, y[133] = 40, y[134] = 41, y[135] = 42, y[136] = 43, y[163] = 44, y[164] = 45, y[165] = 46, y[166] = 47, y[71] = 48, y[98] = 49, y[137] = 50;
  var q = 64, je = new Int32Array(te * q), $e = new Float32Array(te * q), Je = new Array(te * q), Ne = new Uint8Array(te * q), Re = 6, me = new Float32Array(te * Re);
  me.fill(NaN);
  var Ke = new Map, Ht = [], sn = 0;
  function cn() {
    const e = te * 2, r = te * q, n = e * q, o = te * Re, l = e * Re, s = new Int32Array(n);
    s.set(je), je = s;
    const d = new Uint8Array(n);
    d.set(Ne), Ne = d;
    const h = new Float32Array(n);
    h.set($e), h.fill(NaN, r), $e = h;
    const O = new Float32Array(l);
    O.set(me), O.fill(NaN, o), me = O, Je.length = n, te = e;
  }
  function qe(e) {
    let r = Ke.get(e);
    if (r === undefined) {
      r = Ht.pop(), r === undefined && (r = sn++), r >= te && cn(), Ke.set(e, r);
      const n = r * q;
      Ne.fill(0, n, n + q), $e.fill(NaN, n, n + q);
      for (let o = n;o < n + q; o++)
        Je[o] = undefined;
    }
    return r;
  }
  var Gt = new Map, Mt = new Map, Ut = new Map, Pe = new Map;
  function un(e) {
    const r = Ke.get(e);
    if (r !== undefined) {
      Ke.delete(e), Ht.push(r);
      const n = r * Re;
      me.fill(NaN, n, n + Re);
    }
    Gt.delete(e), Mt.delete(e), Ut.delete(e), Pn(e);
  }
  var Z = 0, ce = 0, Oe = new Float32Array(1), De = new Uint32Array(Oe.buffer);
  function he(e, r, n) {
    const o = n | 0, l = y[r];
    if (l < 0) {
      L(16, e, r, o), Z++;
      return;
    }
    const s = qe(e) * q + l;
    if (Ne[s] !== 0 && je[s] === o) {
      ce++;
      return;
    }
    je[s] = o, Ne[s] = 1, L(16, e, r, o), Z++;
  }
  function Xt(e, r, n) {
    const o = y[r];
    if (o < 0) {
      Oe[0] = n, L(17, e, r, De[0]), Z++;
      return;
    }
    const l = qe(e) * q + o;
    if ($e[l] === n) {
      ce++;
      return;
    }
    $e[l] = n, Oe[0] = n, L(17, e, r, De[0]), Z++;
  }
  function fn(e, r, n) {
    const o = y[r];
    if (o < 0) {
      Te(n == null ? "" : String(n)), L(22, e, (r & 255) << 24 | fe & 16777215, ge), Z++;
      return;
    }
    const l = qe(e) * q + o;
    if (Je[l] === n) {
      ce++;
      return;
    }
    Je[l] = n, Te(n == null ? "" : String(n)), L(22, e, (r & 255) << 24 | fe & 16777215, ge), Z++;
  }
  function Ce(e, r, n, o) {
    const l = qe(e) * Re + n;
    if (me[l] === o) {
      ce++;
      return;
    }
    me[l] = o, Oe[0] = o, L(r, e, 0, De[0]), Z++;
  }
  function gn(e, r) {
    Ce(e, 32, 0, r);
  }
  function hn(e, r) {
    Ce(e, 33, 1, r);
  }
  function dn(e, r) {
    Ce(e, 34, 2, r);
  }
  function _n(e, r) {
    Ce(e, 35, 3, r);
  }
  function vn(e, r) {
    Ce(e, 36, 4, r);
  }
  function bn(e, r) {
    Ce(e, 37, 5, r);
  }
  var En = { material: 0, cupertino: 1, adaptive: 2 }, Sn = { light: 0, dark: 1 };
  function Fn(e, r) {
    L(38, typeof e == "string" ? En[e] ?? 0 : e | 0, typeof r == "string" ? Sn[r] ?? 0 : r | 0, 0), B();
  }
  function Yt(e) {
    return Qe(1, "showDialog", [JSON.stringify(e || {})]);
  }
  function pn(e) {
    return Qe(1, "showActionSheet", [JSON.stringify(e || {})]);
  }
  function jt(e) {
    return Qe(1, "showSnackbar", [JSON.stringify(typeof e == "string" ? { message: e } : e || {})]);
  }
  var Jt = new Map;
  function wn(e) {
    let r = 2166136261;
    for (let n = 0;n < e.length; n++)
      r ^= e.charCodeAt(n), r = Math.imul(r, 16777619) >>> 0;
    return r;
  }
  function de(e) {
    let r = Jt.get(e);
    return r !== undefined || (r = wn(e), Te(e), L(23, r, fe, ge), Jt.set(e, r)), r;
  }
  function Tn(e, r) {
    L(4, e, de(r), 0);
  }
  function _t(e, r) {
    let n = e.get(r);
    return n === undefined && (n = new Map, e.set(r, n)), n;
  }
  function Kt(e, r, n) {
    const o = de(r), l = n >>> 0, s = _t(Gt, e);
    if (s.get(o) === l) {
      ce++;
      return;
    }
    s.set(o, l), L(24, e, o, l), Z++;
  }
  function qt(e, r, n) {
    const o = de(r), l = _t(Mt, e);
    if (l.get(o) === n) {
      ce++;
      return;
    }
    l.set(o, n), Oe[0] = n, L(25, e, o, De[0]), Z++;
  }
  function Qt(e, r, n) {
    const o = de(r), l = n == null ? "" : String(n), s = _t(Ut, e);
    if (s.get(o) === l) {
      ce++;
      return;
    }
    s.set(o, l), Te(l);
    const d = fe & 16777215, h = ge & 255;
    L(26, e, o, d << 8 | h), Z++;
  }
  function Rn(e, r, n) {
    L(27, e, de(r), n);
  }
  var Le = new Map, re = new Map, Zt = 1;
  function er(e, r) {
    for (let n = 0;n < r.length; n++) {
      const o = r[n];
      if (typeof o == "number")
        Number.isInteger(o) ? L(29, e, 1, o | 0) : (Oe[0] = o, L(29, e, 2, De[0]));
      else if (typeof o == "boolean")
        L(29, e, 3, o ? 1 : 0);
      else if (typeof o == "string") {
        Te(o);
        const l = fe >>> 0;
        L(29, e, 4 | (ge & 16777215) << 8, l);
      } else
        L(29, e, 0, 0);
    }
  }
  function Qe(e, r, n) {
    const o = de(r), l = Zt++;
    return er(l, n), L(28, e, o, l), B(), new Promise((s, d) => {
      Le.set(l, { resolve: s, reject: d });
    });
  }
  function mn(e, r, n, o, l) {
    const s = de(r), d = Zt++;
    er(d, n), L(30, e, s, d), B(), re.set(d, { nodeId: e, onValue: o, onError: l && l.onError, onDone: l && l.onDone });
    let h = Pe.get(e);
    return h === undefined && (h = new Set, Pe.set(e, h)), h.add(d), function() {
      if (!re.has(d))
        return;
      re.delete(d);
      const w = Pe.get(e);
      w && (w.delete(d), w.size === 0 && Pe.delete(e)), L(31, d, 0, 0), B();
    };
  }
  function Pn(e) {
    const r = Pe.get(e);
    if (r !== undefined) {
      for (const n of r)
        re.has(n) && (re.delete(n), L(31, n, 0, 0));
      Pe.delete(e), B();
    }
  }
  var vt = new Map, On = 1;
  function tr(e) {
    const r = On++;
    return vt.set(r, e), r;
  }
  function Cn(e, r, n) {
    L(21, e, r, n);
  }
  var bt = 0n, _e = null, rr = Dt - ut, Et = ut >> 2, yn = ut + rr >> 2, An = rr / 16 | 0, nr = new ArrayBuffer(4), xn = new Float32Array(nr), kn = new Uint32Array(nr), In = new TextDecoder("utf-8");
  function St(e, r) {
    return r === 0 ? "" : In.decode(zt.subarray(ct + e, ct + e + r));
  }
  function Ft(e, r) {
    K[Kr] = e + r;
  }
  globalThis.__skal_drainEvents = function() {
    const e = Atomics.load(ft, Qr);
    if (e === bt)
      return;
    const r = Et + (K[Jr] >> 2);
    let n = Et + (K[Bt] >> 2);
    const o = yn, l = Et;
    let s = An;
    for (;n !== r && s-- > 0; ) {
      const d = K[n + 0], h = d & 255, O = d >>> 8 & 255, w = K[n + 1], m = K[n + 2], S = K[n + 3];
      let v, c = false;
      if (O === 1)
        v = m | 0, c = true;
      else if (O === 2)
        kn[0] = m, v = xn[0], c = true;
      else if (O === 3)
        v = m !== 0, c = true;
      else if (O === 4)
        v = St(S, m), c = true, Ft(S, m);
      else if (O === 5) {
        const E = St(S, m);
        try {
          v = JSON.parse(E);
        } catch {
          v = E;
        }
        c = true, Ft(S, m);
      } else if (O === 6) {
        const E = St(S, m);
        try {
          v = JSON.parse(E);
        } catch {
          v = [];
        }
        c = true, Ft(S, m);
      }
      if (h === 3) {
        const E = Le.get(w);
        if (E) {
          Le.delete(w);
          try {
            E.resolve(c ? v : undefined);
          } catch (_) {
            _e = _ && (_.stack || _.message || String(_)) || "unknown";
          }
        }
      } else if (h === 4) {
        const E = Le.get(w);
        if (E) {
          Le.delete(w);
          try {
            const _ = typeof v == "string" ? v : `skal RPC error (status ${v})`;
            E.reject(new Error(_));
          } catch (_) {
            _e = _ && (_.stack || _.message || String(_)) || "unknown";
          }
        }
      } else if (h === 5) {
        const E = re.get(w);
        if (E)
          try {
            E.onValue(c ? v : undefined);
          } catch (_) {
            _e = _ && (_.stack || _.message || String(_)) || "unknown";
          }
      } else if (h === 6) {
        const E = re.get(w);
        if (E) {
          re.delete(w);
          try {
            E.onDone && E.onDone();
          } catch (_) {
            _e = _ && (_.stack || _.message || String(_)) || "unknown";
          }
        }
      } else if (h === 7) {
        const E = re.get(w);
        if (E) {
          re.delete(w);
          try {
            E.onError && E.onError(new Error(typeof v == "string" ? v : "skal stream error"));
          } catch (_) {
            _e = _ && (_.stack || _.message || String(_)) || "unknown";
          }
        }
      } else {
        const E = vt.get(w);
        if (E)
          try {
            c ? O === 6 && Array.isArray(v) ? E(...v) : E(v) : E();
          } catch (_) {
            _e = _ && (_.stack || _.message || String(_)) || "unknown";
          }
      }
      n += 4, n >= o && (n = l);
    }
    K[Bt] = n - l << 2, bt = e;
  }, globalThis.skalStatus = () => JSON.stringify({ handlerCount: vt.size, opSeq: Number(Xe), lastEventSeq: Number(bt), lastHandlerError: _e, propWrites: Z, propSkips: ce });
  var ml = 1, $n = 2;
  function ir() {
    return $n++;
  }
  var Nn = { box: 0, column: 1, scrollView: 5, listView: 6, reorderableListView: 7, row: 2, text: 3, button: 4, image: 9, stack: 10, switch: 11, slider: 12, checkbox: 13, activityIndicator: 14, progressBar: 15, lazyGrid: 16, wrap: 17, safeArea: 18, richText: 19, textInput: 20, navigator: 21, screen: 22, tabs: 23, tab: 24 }, Dn = { padding: [0, "u32"], paddingTop: [1, "u32"], paddingRight: [2, "u32"], paddingBottom: [3, "u32"], paddingLeft: [4, "u32"], width: [5, "dim"], height: [6, "dim"], weight: [7, "f32"], alignment: [8, "u32"], gap: [9, "u32"], axis: [10, "u32"], top: [11, "u32"], right: [12, "u32"], bottom: [13, "u32"], left: [14, "u32"], crossAxisCount: [15, "u32"], aspectRatio: [16, "f32"], background: [32, "color"], color: [33, "color"], cornerRadius: [34, "u32"], borderWidth: [35, "u32"], borderColor: [36, "color"], shadow: [37, "u32"], fontSize: [64, "u32"], fontWeight: [65, "u32"], fontFamily: [66, "u32"], textAlign: [67, "u32"], lineHeight: [68, "u32"], maxLines: [69, "u32"], textOverflow: [70, "u32"], src: [96, "str"], contentScale: [97, "u32"], placeholder: [128, "str"], value: [129, "str"], keyboardType: [130, "u32"], secureEntry: [131, "u32"], checked: [132, "u32"], min: [134, "f32"], max: [135, "f32"], progress: [136, "f32"], presentation: [166, "u32"], title: [71, "str"], icon: [98, "str"], activeTab: [137, "u32"], enabled: [160, "u32"], focusable: [161, "u32"], visible: [162, "u32"] }, Ln = { opacity: gn, translationX: hn, translationY: dn, scaleX: _n, scaleY: vn, rotation: bn }, Vn = { onClick: 1, onclick: 1, onTap: 1, onLongPress: 8, onDoubleTap: 9, onChange: 2, onSubmit: 10, onReorder: 11, onPop: 12 }, Bn = { linear: 0, easeIn: 1, easeOut: 2, easeInOut: 3, bounce: 4, elastic: 5, fastOutSlowIn: 6 };
  function zn(e) {
    if (typeof e == "number")
      return e | 0;
    if (typeof e != "string")
      return 0;
    let r = e.trim();
    r.startsWith("#") && (r = r.slice(1));
    let n = 0, o = 0, l = 0, s = 255;
    return r.length === 3 ? (n = parseInt(r[0] + r[0], 16), o = parseInt(r[1] + r[1], 16), l = parseInt(r[2] + r[2], 16)) : r.length === 4 ? (n = parseInt(r[0] + r[0], 16), o = parseInt(r[1] + r[1], 16), l = parseInt(r[2] + r[2], 16), s = parseInt(r[3] + r[3], 16)) : r.length === 6 ? (n = parseInt(r.slice(0, 2), 16), o = parseInt(r.slice(2, 4), 16), l = parseInt(r.slice(4, 6), 16)) : r.length === 8 && (s = parseInt(r.slice(0, 2), 16), n = parseInt(r.slice(2, 4), 16), o = parseInt(r.slice(4, 6), 16), l = parseInt(r.slice(6, 8), 16)), (s & 255) << 24 | (n & 255) << 16 | (o & 255) << 8 | l & 255 | 0;
  }
  function Wn(e) {
    return typeof e == "number" ? e | 0 : e === "fill" ? en : e === "wrap" ? tn : -1;
  }
  function Hn(e) {
    if (Array.isArray(e))
      return true;
    const r = Object.getPrototypeOf(e);
    return r === Object.prototype || r === null;
  }
  function Gn(e, r, n) {
    if (n == null)
      return;
    if (r === "ref" && n && typeof n.__skalBind == "function") {
      n.__skalBind(e.id);
      return;
    }
    const o = typeof n;
    if (o === "object" && Hn(n)) {
      Qt(e.id, r, JSON.stringify(n)), B();
      return;
    }
    if (o === "function") {
      const l = tr(n);
      Rn(e.id, r, l), B();
      return;
    }
    if (o === "number") {
      Number.isInteger(n) && n >= 0 && n <= 4294967295 && Kt(e.id, r, n | 0), qt(e.id, r, n), B();
      return;
    }
    if (o === "string") {
      Qt(e.id, r, n), B();
      return;
    }
    if (o === "boolean") {
      Kt(e.id, r, n ? 1 : 0), B();
      return;
    }
  }
  function Mn(e) {
    const r = [e];
    for (;r.length > 0; ) {
      const n = r.pop();
      un(n.id);
      let o = n.firstChild;
      for (;o; )
        r.push(o), o = o.nextSibling;
    }
  }
  var Ze = class {
    constructor(e, r, n = false, o = false) {
      this.tag = e, this.id = r, this.isText = n, this.isCustom = o, this.parent = null, this.firstChild = null, this.lastChild = null, this.nextSibling = null, this.prevSibling = null, this.text = "";
    }
  }, Un = Nr({ createElement(e) {
    const r = ir(), n = Nn[e];
    return n !== undefined ? (L(1, r, n, 0), B(), new Ze(e, r, false, false)) : (Tn(r, e), B(), new Ze(e, r, false, true));
  }, createTextNode(e) {
    const r = ir();
    L(1, r, 3, 0);
    const n = e == null ? "" : String(e);
    n.length > 0 && ht(r, n), B();
    const o = new Ze("#text", r, true);
    return o.text = n, o;
  }, replaceText(e, r) {
    const n = r == null ? "" : String(r);
    e.text !== n && (e.text = n, ht(e.id, n), B());
  }, setProperty(e, r, n, o) {
    if (e.isCustom) {
      Gn(e, r, n);
      return;
    }
    const l = Vn[r];
    if (l !== undefined) {
      if (typeof n == "function") {
        const h = tr(n);
        Cn(e.id, l, h), B();
      }
      return;
    }
    if (r === "value" && e.tag === "slider") {
      Xt(e.id, 133, Number(n) || 0), B();
      return;
    }
    if (r === "animate" && n && typeof n == "object") {
      if (he(e.id, 163, n.duration | 0), n.curve != null) {
        const h = typeof n.curve == "string" ? Bn[n.curve] ?? 0 : n.curve | 0;
        he(e.id, 164, h);
      }
      n.delay != null && he(e.id, 165, n.delay | 0), B();
      return;
    }
    if (r === "label" && (e.tag === "button" || e.tag === "text")) {
      const h = n == null ? "" : String(n);
      ht(e.id, h), B();
      return;
    }
    const s = Ln[r];
    if (s !== undefined) {
      typeof n == "number" && (s(e.id, n), B());
      return;
    }
    const d = Dn[r];
    if (d !== undefined) {
      const [h, O] = d;
      if (n == null)
        return;
      switch (O) {
        case "u32":
          typeof n == "number" ? (he(e.id, h, n | 0), B()) : typeof n == "boolean" && (he(e.id, h, n ? 1 : 0), B());
          return;
        case "f32":
          typeof n == "number" && (Xt(e.id, h, n), B());
          return;
        case "str":
          fn(e.id, h, String(n)), B();
          return;
        case "color":
          he(e.id, h, zn(n)), B();
          return;
        case "dim":
          he(e.id, h, Wn(n)), B();
          return;
      }
      return;
    }
    if (r === "style" && n && typeof n == "object") {
      for (const h in n)
        this.setProperty(e, h, n[h]);
      return;
    }
  }, insertNode(e, r, n) {
    if (r === n)
      return;
    if (r.parent) {
      const l = r.parent;
      r.prevSibling ? r.prevSibling.nextSibling = r.nextSibling : l.firstChild === r && (l.firstChild = r.nextSibling), r.nextSibling ? r.nextSibling.prevSibling = r.prevSibling : l.lastChild === r && (l.lastChild = r.prevSibling), r.prevSibling = null, r.nextSibling = null;
    }
    const o = n ? n.id : 0;
    L(3, e.id, r.id, o), B(), r.parent = e, n ? (r.nextSibling = n, r.prevSibling = n.prevSibling, n.prevSibling ? n.prevSibling.nextSibling = r : e.firstChild = r, n.prevSibling = r) : (r.prevSibling = e.lastChild, r.nextSibling = null, e.lastChild ? e.lastChild.nextSibling = r : e.firstChild = r, e.lastChild = r);
  }, removeNode(e, r) {
    L(2, r.id, 0, 0), Mn(r), B(), r.prevSibling ? r.prevSibling.nextSibling = r.nextSibling : e.firstChild = r.nextSibling, r.nextSibling ? r.nextSibling.prevSibling = r.prevSibling : e.lastChild = r.prevSibling, r.parent = null, r.prevSibling = null, r.nextSibling = null;
  }, isTextNode(e) {
    return e.isText;
  }, getParentNode(e) {
    return e.parent;
  }, getFirstChild(e) {
    return e.firstChild;
  }, getNextSibling(e) {
    return e.nextSibling;
  } }), { render: Xn, effect: G, memo: or, createComponent: I, createElement: a, createTextNode: Pl, insertNode: p, insert: $, spread: Ol, setProp: t, mergeProps: Cl, use: Yn } = Un;
  L(1, 1, 0, 0), B();
  var jn = new Ze("box", 1, false);
  function Jn() {
    let e = 0;
    const r = function() {};
    return r.__skalBind = (n) => {
      e = n;
    }, new Proxy(r, { apply(n, o, l) {
      const s = l[0];
      s && typeof s.id == "number" && (e = s.id);
    }, get(n, o) {
      if (o === "__skalBind" || typeof o == "symbol")
        return r[o];
      if (typeof o == "string" && o.endsWith("$") && o.length > 1) {
        const l = o.slice(0, -1);
        return (...s) => {
          if (e === 0)
            throw new Error(`skal ref: cannot call .${String(o)}() before the host mounts. Move the call into a JSX event handler.`);
          const d = s[s.length - 1];
          if (typeof d != "function")
            throw new TypeError(`skal ref: .${String(o)}() requires a callback as its last argument (got ${typeof d})`);
          const h = s.slice(0, -1);
          return mn(e, l, h, d);
        };
      }
      return (...l) => e === 0 ? Promise.reject(new Error(`skal ref: cannot call .${String(o)}() before the host mounts. Move the call into a JSX event handler.`)) : Qe(e, o, l);
    } });
  }
  function Kn(e, r, n) {
    const o = (v) => {
      const c = e[v];
      return typeof c == "function" ? c : c && c.component || null;
    }, l = (v) => {
      const c = e[v];
      return c && typeof c == "object" ? c.title : undefined;
    }, s = !!(n && n.linking), d = typeof window < "u", h = () => {
      if (!d)
        return null;
      const v = (window.location.hash || "").replace(/^#\/?/, "").split("?")[0];
      return v && e[v] ? v : null;
    };
    let O = typeof r == "string" ? r : r && r.name || Object.keys(e)[0];
    if (s) {
      const v = h();
      v && (O = v);
    }
    const [w, m] = z([{ name: O, params: {}, title: l(O) }]), S = { stack: w, navigate(v, c, E) {
      m([...w(), { name: v, params: c || {}, presentation: E && E.presentation, title: (E && E.title) !== undefined ? E.title : l(v) }]);
    }, back() {
      const v = w();
      v.length > 1 && m(v.slice(0, -1));
    }, replace(v, c, E) {
      m([...w().slice(0, -1), { name: v, params: c || {}, title: (E && E.title) !== undefined ? E.title : l(v) }]);
    }, reset(v, c) {
      m([{ name: v, params: c || {}, title: l(v) }]);
    }, canGoBack() {
      return w().length > 1;
    } };
    return s && d && Fr(() => {
      const v = w(), c = "#/" + v[v.length - 1].name;
      window.location.hash !== c && window.history.replaceState({}, "", c);
    }), S.View = () => (() => {
      var v = a("navigator");
      return t(v, "onPop", () => S.back()), $(v, I(ae, { get each() {
        return w();
      }, children: (c) => {
        const E = o(c.name);
        return (() => {
          var _ = a("screen");
          return $(_, E ? I(E, { get params() {
            return c.params || {};
          }, router: S }) : null), G((V) => {
            var M = c.presentation === "modal" ? 1 : 0, F = c.title || "";
            return M !== V.e && (V.e = t(_, "presentation", M, V.e)), F !== V.t && (V.t = t(_, "title", F, V.t)), V;
          }, { e: undefined, t: undefined }), _;
        })();
      } })), v;
    })(), S;
  }
  var lr = "#FF0A84FF", ar = "#FF34C759", sr = "#FFFF9F0A", qn = "#FFFF3B30", Qn = "#FF5E5CE6";
  function U(e) {
    return (() => {
      var r = a("column"), n = a("text");
      return p(r, n), t(r, "background", "#FFFFFFFF"), t(r, "cornerRadius", 14), t(r, "padding", 16), t(r, "gap", 12), t(r, "borderWidth", 1), t(r, "borderColor", "#FFE5E5EA"), t(n, "fontSize", 15), t(n, "fontWeight", 800), t(n, "color", "#FF1C1C1E"), $(r, () => e.children, null), G((o) => t(n, "label", e.title, o)), r;
    })();
  }
  function Zn(e) {
    const r = ["Inbox", "Starred", "Drafts", "Archive"];
    return (() => {
      var n = a("column");
      return t(n, "background", "#FFF2F2F7"), t(n, "padding", 16), t(n, "gap", 8), t(n, "height", "fill"), $(n, I(ae, { each: r, children: (o) => (() => {
        var l = a("box"), s = a("text");
        return p(l, s), t(l, "background", "#FFFFFFFF"), t(l, "cornerRadius", 8), t(l, "padding", 12), t(l, "onTap", () => e.router.navigate("detail", { name: o }, { title: o })), t(s, "label", `${o}   \u203A`), t(s, "fontSize", 14), t(s, "color", "#FF1C1C1E"), l;
      })() })), n;
    })();
  }
  function ei(e) {
    return (() => {
      var r = a("column"), n = a("text"), o = a("text");
      return p(r, n), p(r, o), t(r, "background", "#FFF2F2F7"), t(r, "padding", 16), t(r, "gap", 10), t(r, "height", "fill"), t(n, "fontSize", 20), t(n, "fontWeight", 800), t(n, "color", "#FF1C1C1E"), t(o, "label", "The AppBar's \u2039 back button (and the system back / swipe gesture) all pop this route. The list screen behind stayed mounted \u2014 back is instant, no re-render, scroll preserved."), t(o, "fontSize", 13), t(o, "color", "#FF8E8E93"), G((l) => t(n, "label", e.name, l)), r;
    })();
  }
  function ti() {
    const [e, r] = z("material"), [n, o] = z(false), [l, s] = z(true), [d, h] = z(false), [O, w] = z(40), [m, S] = z(""), [v, c] = z(false), [E, _] = z("none yet"), [V, M] = z("\u2014 try a dialog button \u2014"), [F, b] = z(["First item", "Second item", "Third item", "Fourth item"]), g = Kn({ list: { component: (R) => I(Zn, { get router() {
      return R.router;
    } }), title: "Mailboxes" }, detail: (R) => I(ei, { get name() {
      return R.params.name;
    }, get router() {
      return R.router;
    } }) }, "list"), [C, x] = z(0), k = (R, A) => {
      r(R), o(A), Fn(R, A ? 1 : 0);
    };
    return (() => {
      var R = a("scrollView"), A = a("text"), ee = a("text"), W = a("text");
      return p(R, A), p(R, ee), p(R, W), t(R, "background", "#FFF2F2F7"), t(R, "padding", 16), t(R, "gap", 14), t(A, "label", "Skal \u2014 Component Demo"), t(A, "fontSize", 24), t(A, "fontWeight", 800), t(A, "color", "#FF1C1C1E"), t(ee, "label", "Every fast-path widget, plus animation, the design system, and dialogs."), t(ee, "fontSize", 13), t(ee, "color", "#FF8E8E93"), $(R, I(U, { title: "Design system \u2014 setDesign()", get children() {
        return [(() => {
          var i = a("text");
          return t(i, "fontSize", 13), t(i, "color", "#FF8E8E93"), G((u) => t(i, "label", `active: ${e()} \xB7 ${n() ? "dark" : "light"}`, u)), i;
        })(), (() => {
          var i = a("row"), u = a("button"), f = a("button"), P = a("button");
          return p(i, u), p(i, f), p(i, P), t(i, "gap", 8), t(u, "label", "Material"), t(u, "onClick", () => k("material", n())), t(f, "label", "Cupertino"), t(f, "onClick", () => k("cupertino", n())), t(P, "onClick", () => k(e(), !n())), G((N) => t(P, "label", n() ? "Light mode" : "Dark mode", N)), i;
        })(), (() => {
          var i = a("text");
          return t(i, "label", "Buttons, switches, sliders, the text field & spinner all swap Material\u2194Cupertino."), t(i, "fontSize", 11), t(i, "color", "#FF8E8E93"), i;
        })()];
      } }), W), $(R, I(U, { title: "Layout \u2014 box \xB7 row \xB7 wrap", get children() {
        return [(() => {
          var i = a("row"), u = a("box"), f = a("box"), P = a("box");
          return p(i, u), p(i, f), p(i, P), t(i, "gap", 8), t(u, "width", 56), t(u, "height", 56), t(u, "background", "#FF0A84FF"), t(u, "cornerRadius", 10), t(f, "width", 56), t(f, "height", 56), t(f, "background", "#FF34C759"), t(f, "cornerRadius", 10), t(P, "width", 56), t(P, "height", 56), t(P, "background", "#FFFF9F0A"), t(P, "cornerRadius", 10), i;
        })(), (() => {
          var i = a("text");
          return t(i, "label", "Wrap \u2014 children flow onto new runs:"), t(i, "fontSize", 11), t(i, "color", "#FF8E8E93"), i;
        })(), (() => {
          var i = a("wrap");
          return t(i, "gap", 6), $(i, I(ae, { each: ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa"], children: (u) => (() => {
            var f = a("box"), P = a("text");
            return p(f, P), t(f, "background", "#FFEFEFF4"), t(f, "cornerRadius", 12), t(f, "paddingLeft", 10), t(f, "paddingRight", 10), t(f, "paddingTop", 6), t(f, "paddingBottom", 6), t(P, "label", u), t(P, "fontSize", 12), t(P, "color", "#FF1C1C1E"), f;
          })() })), i;
        })()];
      } }), W), $(R, I(U, { title: "Stack \u2014 overlap + positioned children", get children() {
        var i = a("stack"), u = a("box"), f = a("box"), P = a("text"), N = a("box");
        return p(i, u), p(i, f), p(i, N), t(i, "width", "fill"), t(i, "height", 120), t(u, "width", "fill"), t(u, "height", 120), t(u, "background", "#FF5E5CE6"), t(u, "cornerRadius", 12), p(f, P), t(f, "top", 10), t(f, "left", 10), t(f, "background", "#FFFFFFFF"), t(f, "cornerRadius", 8), t(f, "paddingLeft", 10), t(f, "paddingRight", 10), t(f, "paddingTop", 4), t(f, "paddingBottom", 4), t(P, "label", "top \xB7 left"), t(P, "fontSize", 11), t(P, "color", "#FF1C1C1E"), t(N, "bottom", 10), t(N, "right", 10), t(N, "width", 30), t(N, "height", 30), t(N, "background", "#FFFF3B30"), t(N, "cornerRadius", 15), i;
      } }), W), $(R, I(U, { title: "Text & RichText", get children() {
        return [(() => {
          var i = a("text");
          return t(i, "label", "Styled text \u2014 18sp, weight 700."), t(i, "fontSize", 18), t(i, "fontWeight", 700), t(i, "color", "#FF1C1C1E"), i;
        })(), (() => {
          var i = a("richText"), u = a("text"), f = a("text"), P = a("text"), N = a("text"), Y = a("text");
          return p(i, u), p(i, f), p(i, P), p(i, N), p(i, Y), t(u, "label", "Rich text "), t(u, "fontSize", 16), t(u, "color", "#FF1C1C1E"), t(f, "label", "mixes "), t(f, "fontSize", 16), t(f, "color", "#FF0A84FF"), t(f, "fontWeight", 800), t(P, "label", "size, "), t(P, "fontSize", 22), t(P, "color", "#FFFF3B30"), t(P, "fontWeight", 700), t(N, "label", "weight "), t(N, "fontSize", 16), t(N, "color", "#FF34C759"), t(N, "fontWeight", 800), t(Y, "label", "and colour inline."), t(Y, "fontSize", 16), t(Y, "color", "#FF1C1C1E"), i;
        })()];
      } }), W), $(R, I(U, { title: "Image \u2014 network \xB7 BoxFit \xB7 rounded", get children() {
        return [(() => {
          var i = a("image");
          return t(i, "src", "https://picsum.photos/seed/skal/640/360"), t(i, "width", "fill"), t(i, "height", 160), t(i, "contentScale", 1), t(i, "cornerRadius", 12), i;
        })(), (() => {
          var i = a("text");
          return t(i, "label", "contentScale=1 (cover); cornerRadius clips the pixels. Requires network."), t(i, "fontSize", 11), t(i, "color", "#FF8E8E93"), i;
        })()];
      } }), W), $(R, I(U, { title: "Scrolling \u2014 horizontal list \xB7 lazy grid \xB7 reorderable", get children() {
        return [(() => {
          var i = a("text");
          return t(i, "label", "listView axis=1 (horizontal, virtualized):"), t(i, "fontSize", 11), t(i, "color", "#FF8E8E93"), i;
        })(), (() => {
          var i = a("listView");
          return t(i, "axis", 1), t(i, "height", 66), t(i, "gap", 8), $(i, I(ae, { each: [lr, ar, sr, Qn, qn, "#FF00C7BE", "#FFAF52DE", "#FFFFD60A"], children: (u) => (() => {
            var f = a("box");
            return t(f, "width", 66), t(f, "height", 50), t(f, "background", u), t(f, "cornerRadius", 10), f;
          })() })), i;
        })(), (() => {
          var i = a("text");
          return t(i, "label", "lazyGrid \u2014 crossAxisCount=4:"), t(i, "fontSize", 11), t(i, "color", "#FF8E8E93"), i;
        })(), (() => {
          var i = a("lazyGrid");
          return t(i, "crossAxisCount", 4), t(i, "aspectRatio", 1), t(i, "gap", 8), t(i, "height", 150), $(i, I(ae, { get each() {
            return Array.from({ length: 12 }, (u, f) => f);
          }, children: (u) => (() => {
            var f = a("box");
            return t(f, "background", u % 3 === 0 ? lr : u % 3 === 1 ? ar : sr), t(f, "cornerRadius", 8), f;
          })() })), i;
        })(), (() => {
          var i = a("text");
          return t(i, "label", "reorderableListView \u2014 drag a row to reorder:"), t(i, "fontSize", 11), t(i, "color", "#FF8E8E93"), i;
        })(), (() => {
          var i = a("reorderableListView");
          return t(i, "height", 200), t(i, "gap", 6), t(i, "onReorder", (u, f) => {
            const P = F().slice(), [N] = P.splice(u, 1);
            P.splice(f, 0, N), b(P);
          }), $(i, I(ae, { get each() {
            return F();
          }, children: (u) => (() => {
            var f = a("box"), P = a("text");
            return p(f, P), t(f, "background", "#FFEFEFF4"), t(f, "cornerRadius", 8), t(f, "padding", 12), t(P, "label", u), t(P, "fontSize", 13), t(P, "color", "#FF1C1C1E"), f;
          })() })), i;
        })()];
      } }), W), $(R, I(U, { title: "Controls \u2014 switch \xB7 checkbox \xB7 slider \xB7 text field", get children() {
        return [(() => {
          var i = a("row"), u = a("switch"), f = a("text");
          return p(i, u), p(i, f), t(i, "gap", 12), t(u, "onChange", (P) => s(P)), t(f, "fontSize", 13), t(f, "color", "#FF1C1C1E"), G((P) => {
            var N = l(), Y = l() ? "switch: on" : "switch: off";
            return N !== P.e && (P.e = t(u, "checked", N, P.e)), Y !== P.t && (P.t = t(f, "label", Y, P.t)), P;
          }, { e: undefined, t: undefined }), i;
        })(), (() => {
          var i = a("row"), u = a("checkbox"), f = a("text");
          return p(i, u), p(i, f), t(i, "gap", 12), t(u, "onChange", (P) => h(P)), t(f, "fontSize", 13), t(f, "color", "#FF1C1C1E"), G((P) => {
            var N = d(), Y = d() ? "checkbox: checked" : "checkbox: unchecked";
            return N !== P.e && (P.e = t(u, "checked", N, P.e)), Y !== P.t && (P.t = t(f, "label", Y, P.t)), P;
          }, { e: undefined, t: undefined }), i;
        })(), (() => {
          var i = a("slider");
          return t(i, "min", 0), t(i, "max", 100), t(i, "onChange", (u) => w(u)), G((u) => t(i, "value", O(), u)), i;
        })(), (() => {
          var i = a("text");
          return t(i, "fontSize", 13), t(i, "color", "#FF1C1C1E"), G((u) => t(i, "label", `slider: ${Math.round(O())}`, u)), i;
        })(), (() => {
          var i = a("textInput");
          return t(i, "placeholder", "Type your name\u2026"), t(i, "onChange", (u) => S(u)), t(i, "onSubmit", (u) => jt(`Submitted: ${u}`)), G((u) => t(i, "value", m(), u)), i;
        })(), (() => {
          var i = a("text");
          return t(i, "fontSize", 13), t(i, "color", "#FF8E8E93"), G((u) => t(i, "label", m() ? `Hello, ${m()}!` : "\u2014 type above; press Enter to submit \u2014", u)), i;
        })()];
      } }), W), $(R, I(U, { title: "Indicators \u2014 spinner \xB7 progress bar", get children() {
        return [(() => {
          var i = a("row"), u = a("activityIndicator"), f = a("text");
          return p(i, u), p(i, f), t(i, "gap", 12), t(u, "color", "#FF0A84FF"), t(f, "label", "CircularProgressIndicator"), t(f, "fontSize", 13), t(f, "color", "#FF1C1C1E"), i;
        })(), (() => {
          var i = a("text");
          return t(i, "label", "determinate \u2014 tracks the slider above:"), t(i, "fontSize", 11), t(i, "color", "#FF8E8E93"), i;
        })(), (() => {
          var i = a("progressBar");
          return t(i, "color", "#FF0A84FF"), G((u) => t(i, "progress", O() / 100, u)), i;
        })(), (() => {
          var i = a("text");
          return t(i, "label", "indeterminate:"), t(i, "fontSize", 11), t(i, "color", "#FF8E8E93"), i;
        })(), (() => {
          var i = a("progressBar");
          return t(i, "color", "#FF34C759"), i;
        })()];
      } }), W), $(R, I(U, { title: "Animation \u2014 animate prop (Dart-side tween)", get children() {
        return [(() => {
          var i = a("row"), u = a("box");
          return p(i, u), t(i, "gap", 8), t(u, "width", 64), t(u, "height", 64), t(u, "background", "#FF0A84FF"), t(u, "cornerRadius", 14), t(u, "animate", { duration: 450, curve: "easeInOut" }), G((f) => {
            var P = v() ? 0.3 : 1, N = v() ? 1.4 : 1, Y = v() ? 1.4 : 1, ve = v() ? 0.5 : 0, ne = v() ? 70 : 0;
            return P !== f.e && (f.e = t(u, "opacity", P, f.e)), N !== f.t && (f.t = t(u, "scaleX", N, f.t)), Y !== f.a && (f.a = t(u, "scaleY", Y, f.a)), ve !== f.o && (f.o = t(u, "rotation", ve, f.o)), ne !== f.i && (f.i = t(u, "translationX", ne, f.i)), f;
          }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined }), i;
        })(), (() => {
          var i = a("button");
          return t(i, "onClick", () => c(!v())), G((u) => t(i, "label", v() ? "Reset" : "Animate", u)), i;
        })(), (() => {
          var i = a("text");
          return t(i, "label", "opacity + scale + rotation + translation tween together \u2014 JS only flips one signal; the whole tween runs host-side."), t(i, "fontSize", 11), t(i, "color", "#FF8E8E93"), i;
        })()];
      } }), W), $(R, I(U, { title: "Gestures \u2014 onTap \xB7 onLongPress \xB7 onDoubleTap", get children() {
        return [(() => {
          var i = a("box"), u = a("text");
          return p(i, u), t(i, "background", "#FFEFEFF4"), t(i, "cornerRadius", 12), t(i, "padding", 22), t(i, "onTap", () => _("onTap")), t(i, "onLongPress", () => _("onLongPress")), t(i, "onDoubleTap", () => _("onDoubleTap")), t(u, "label", "Tap / long-press / double-tap this box"), t(u, "fontSize", 13), t(u, "color", "#FF1C1C1E"), i;
        })(), (() => {
          var i = a("text");
          return t(i, "fontSize", 12), t(i, "color", "#FF8E8E93"), G((u) => t(i, "label", `last gesture: ${E()}`, u)), i;
        })()];
      } }), W), $(R, I(U, { title: "Dialogs \u2014 imperative JS API", get children() {
        return [(() => {
          var i = a("row"), u = a("button"), f = a("button");
          return p(i, u), p(i, f), t(i, "gap", 8), t(u, "label", "Alert"), t(u, "onClick", async () => {
            await Yt({ title: "Heads up", message: "A plain alert dialog.", actions: [{ label: "OK", value: "ok" }] }), M("alert: dismissed");
          }), t(f, "label", "Confirm"), t(f, "onClick", async () => {
            M(`confirm \u2192 ${await Yt({ title: "Delete file?", message: "This cannot be undone.", actions: [{ label: "Cancel", value: "cancel" }, { label: "Delete", value: "delete", style: "destructive" }] }) ?? "dismissed"}`);
          }), i;
        })(), (() => {
          var i = a("row"), u = a("button"), f = a("button");
          return p(i, u), p(i, f), t(i, "gap", 8), t(u, "label", "Action sheet"), t(u, "onClick", async () => {
            M(`sheet \u2192 ${await pn({ title: "Choose an action", actions: [{ label: "Copy", value: "copy" }, { label: "Share", value: "share" }, { label: "Delete", value: "delete", style: "destructive" }] }) ?? "cancelled"}`);
          }), t(f, "label", "Snackbar"), t(f, "onClick", () => {
            jt("Hello from a snackbar \uD83D\uDC4B"), M("snackbar: shown");
          }), i;
        })(), (() => {
          var i = a("text");
          return t(i, "fontSize", 12), t(i, "color", "#FF8E8E93"), G((u) => t(i, "label", V(), u)), i;
        })()];
      } }), W), $(R, I(U, { title: "Navigation \u2014 push / pop with keep-alive", get children() {
        return [(() => {
          var i = a("text");
          return t(i, "label", "Tap a mailbox to push a screen; the AppBar back button (or system back) pops. Native transition; the screen behind stays mounted."), t(i, "fontSize", 11), t(i, "color", "#FF8E8E93"), i;
        })(), (() => {
          var i = a("box");
          return t(i, "height", 320), t(i, "borderWidth", 1), t(i, "borderColor", "#FFE5E5EA"), $(i, I(g.View, {})), i;
        })()];
      } }), W), $(R, I(U, { title: "Tabs \u2014 bottom bar with keep-alive", get children() {
        return [(() => {
          var i = a("text");
          return t(i, "label", "Every tab subtree is built once and kept alive (IndexedStack) \u2014 switching never re-mounts; scroll & state survive."), t(i, "fontSize", 11), t(i, "color", "#FF8E8E93"), i;
        })(), (() => {
          var i = a("box"), u = a("tabs"), f = a("tab"), P = a("column"), N = a("text"), Y = a("text"), ve = a("tab"), ne = a("column"), Ve = a("text"), hr = a("textInput"), et = a("tab"), be = a("column"), Be = a("text"), tt = a("text");
          return p(i, u), t(i, "height", 280), t(i, "borderWidth", 1), t(i, "borderColor", "#FFE5E5EA"), t(i, "cornerRadius", 8), p(u, f), p(u, ve), p(u, et), t(u, "onChange", x), t(u, "height", "fill"), p(f, P), t(f, "title", "Home"), t(f, "icon", "home"), p(P, N), p(P, Y), t(P, "background", "#FFF2F2F7"), t(P, "padding", 16), t(P, "gap", 8), t(P, "height", "fill"), t(N, "label", "Home"), t(N, "fontSize", 20), t(N, "fontWeight", 800), t(N, "color", "#FF1C1C1E"), t(Y, "label", "Switch tabs and come back \u2014 this tab was never torn down."), t(Y, "fontSize", 13), t(Y, "color", "#FF8E8E93"), p(ve, ne), t(ve, "title", "Search"), t(ve, "icon", "search"), p(ne, Ve), p(ne, hr), t(ne, "background", "#FFF2F2F7"), t(ne, "padding", 16), t(ne, "gap", 8), t(ne, "height", "fill"), t(Ve, "label", "Search"), t(Ve, "fontSize", 20), t(Ve, "fontWeight", 800), t(Ve, "color", "#FF1C1C1E"), t(hr, "placeholder", "Type to search\u2026"), p(et, be), t(et, "title", "Profile"), t(et, "icon", "person"), p(be, Be), p(be, tt), t(be, "background", "#FFF2F2F7"), t(be, "padding", 16), t(be, "gap", 8), t(be, "height", "fill"), t(Be, "label", "Profile"), t(Be, "fontSize", 20), t(Be, "fontWeight", 800), t(Be, "color", "#FF1C1C1E"), t(tt, "fontSize", 13), t(tt, "color", "#FF8E8E93"), G((Ee) => {
            var dr = C(), _r = `active tab index: ${C()}`;
            return dr !== Ee.e && (Ee.e = t(u, "activeTab", dr, Ee.e)), _r !== Ee.t && (Ee.t = t(tt, "label", _r, Ee.t)), Ee;
          }, { e: undefined, t: undefined }), i;
        })()];
      } }), W), $(R, I(U, { title: "SafeArea", get children() {
        var i = a("safeArea"), u = a("box"), f = a("text");
        return p(i, u), p(u, f), t(u, "background", "#FFEFEFF4"), t(u, "cornerRadius", 8), t(u, "padding", 14), t(f, "label", "Insets past notches & system bars. (No visible effect here \u2014 the app root already applies one.)"), t(f, "fontSize", 12), t(f, "color", "#FF1C1C1E"), i;
      } }), W), t(W, "label", "\u2014 end of UI demo \u2014"), t(W, "fontSize", 12), t(W, "color", "#FF8E8E93"), R;
    })();
  }
  var cr = ["Just shipped a new feature, feeling great about how it turned out \uD83D\uDE80", "Hot take: the best APIs are the ones you don't have to read docs for", "Spent the morning refactoring legacy code \u2014 so much cleaner now", "There's no such thing as 'just a small change' in production code", "If your tests are slow, that's a smell. Fast tests = good tests", "Bun's startup time keeps surprising me, even after a year", "Why is naming things still the hardest part of programming?", "Found a 10\xD7 speedup in a critical path today. Profilers, not guesses", "Reading 'The Art of Unix Programming' for the third time", "Premature abstraction is somehow worse than premature optimization", "Latency is a feature, throughput is an artifact of how you measure", "Half of debugging is admitting your assumption was wrong", "You don't ship the codebase you have. You ship the codebase you understand", "Cache invalidation, naming things, off-by-one. The classics", "Every config file format eventually grows a turing-complete templating layer"], ri = Array.from({ length: 15000 }, (e, r) => ({ author: `@user${r * 2654435761 >>> 17}`, body: cr[r % cr.length], num: r + 1 })), ni = [50, 200, 500, 1000, 2000, 5000, 1e4], ur = "#FFF1F5F9", fr = "#FF475569", ii = "#FF22C55E", oi = "#FFEF4444", gr = "#FFFFFFFF";
  function li(e) {
    const [r, n] = z(0), [o, l] = z(false), [s, d] = z(0), [h, O] = z(false);
    return (() => {
      var w = a("column"), m = a("text"), S = a("text"), v = a("row"), c = a("button"), E = a("button");
      return p(w, m), p(w, S), p(w, v), t(w, "background", "#FFFFFFFF"), t(w, "padding", 12), t(w, "cornerRadius", 10), t(w, "borderWidth", 1), t(w, "borderColor", "#FFE5E5EA"), t(w, "gap", 6), t(m, "fontWeight", 700), t(m, "fontSize", 14), t(m, "color", "#FF1DA1F2"), t(S, "fontSize", 14), t(S, "color", "#FF1F2937"), t(S, "maxLines", 3), t(S, "textOverflow", 1), p(v, c), p(v, E), t(v, "gap", 10), t(c, "fontSize", 12), t(c, "padding", 6), t(c, "cornerRadius", 16), t(c, "onClick", () => {
        const _ = !o();
        l(_), n(r() + (_ ? 1 : -1));
      }), t(E, "fontSize", 12), t(E, "padding", 6), t(E, "cornerRadius", 16), t(E, "onClick", () => {
        const _ = !h();
        O(_), d(s() + (_ ? 1 : -1));
      }), G((_) => {
        var V = `#${e.num} \xB7 ${e.author}`, M = e.body, F = `\u2665 ${r()}`, b = o() ? ii : ur, g = o() ? gr : fr, C = `\u21A9 ${s()}`, x = h() ? oi : ur, k = h() ? gr : fr;
        return V !== _.e && (_.e = t(m, "label", V, _.e)), M !== _.t && (_.t = t(S, "label", M, _.t)), F !== _.a && (_.a = t(c, "label", F, _.a)), b !== _.o && (_.o = t(c, "background", b, _.o)), g !== _.i && (_.i = t(c, "color", g, _.i)), C !== _.n && (_.n = t(E, "label", C, _.n)), x !== _.s && (_.s = t(E, "background", x, _.s)), k !== _.h && (_.h = t(E, "color", k, _.h)), _;
      }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined, n: undefined, s: undefined, h: undefined }), w;
    })();
  }
  function ai() {
    const [e, r] = z(50), [n, o] = z(""), l = Ge(() => ri.slice(0, e()));
    return (() => {
      var s = a("listView"), d = a("text"), h = a("text"), O = a("wrap"), w = a("text");
      return p(s, d), p(s, h), p(s, O), p(s, w), t(s, "background", "#FFF2F2F7"), t(s, "padding", 16), t(s, "gap", 12), t(d, "label", "Tweet feed \u2014 virtualized"), t(d, "fontSize", 24), t(d, "fontWeight", 800), t(d, "color", "#FF1C1C1E"), t(h, "label", "ListView.builder materializes only the visible window; the source pool is 15 000 items. Tap a count to mount N."), t(h, "fontSize", 13), t(h, "color", "#FF8E8E93"), t(O, "gap", 6), $(O, I(ae, { each: ni, children: (m) => (() => {
        var S = a("button");
        return t(S, "label", `${m}`), t(S, "onClick", () => {
          const v = performance.now();
          try {
            r(m), o(`mounted ${m} in ${(performance.now() - v).toFixed(2)} ms`);
          } catch (c) {
            o(`ERROR @ ${m}: ${c && (c.message || String(c)) || "unknown"}`);
          }
        }), S;
      })() })), t(w, "fontSize", 12), t(w, "color", "#FF8E8E93"), $(s, I(ae, { get each() {
        return l();
      }, children: (m) => I(li, { get author() {
        return m.author;
      }, get body() {
        return m.body;
      }, get num() {
        return m.num;
      } }) }), null), G((m) => t(w, "label", n() || `showing ${e()} tweets`, m)), s;
    })();
  }
  function si() {
    const [e, r] = z("\u2014 waiting for counter events \u2014"), n = Jn(), [o, l] = z("\u2014 tap a button to RPC the Ticker \u2014"), [s, d] = z(null), [h, O] = z(false);
    return (() => {
      var w = a("scrollView"), m = a("text"), S = a("text"), v = a("text");
      return p(w, m), p(w, S), p(w, v), t(w, "background", "#FFF2F2F7"), t(w, "padding", 16), t(w, "gap", 14), t(m, "label", "Libraries \u2014 codegen-wrapped widgets"), t(m, "fontSize", 24), t(m, "fontWeight", 800), t(m, "color", "#FF1C1C1E"), t(S, "label", "Custom adapters + real pub.dev packages, brought into JSX by skal_codegen. Imported from 'skal-flutter'."), t(S, "fontSize", 13), t(S, "color", "#FF8E8E93"), $(w, I(U, { title: "Greeting \u2014 hand-written adapter", get children() {
        var c = a("greeting");
        return t(c, "name", "Skal"), t(c, "color", "#FF1DA1F2"), t(c, "fontSize", 20), c;
      } }), v), $(w, I(U, { title: "Shimmer \u2014 pub.dev, named-ctor wrap", get children() {
        return [(() => {
          var c = a("text");
          return t(c, "label", "ShimmerFromColors \u2014 codegen-synthesized from the Shimmer.fromColors named constructor."), t(c, "fontSize", 11), t(c, "color", "#FF8E8E93"), c;
        })(), (() => {
          var c = a("shimmerFromColors"), E = a("greeting");
          return p(c, E), t(c, "baseColor", 4290624957), t(c, "highlightColor", 4292927712), t(c, "period", 1500), t(E, "name", "loading\u2026"), t(E, "color", "#FF333333"), t(E, "fontSize", 28), c;
        })()];
      } }), v), $(w, I(U, { title: "QR code \u2014 qr_flutter, pub.dev wrap", get children() {
        return [(() => {
          var c = a("qrImageView");
          return t(c, "data", "https://skal.dev"), t(c, "size", 200), c;
        })(), (() => {
          var c = a("text");
          return t(c, "label", "QrImageView, generated against qr_flutter's class."), t(c, "fontSize", 11), t(c, "color", "#FF8E8E93"), c;
        })()];
      } }), v), $(w, I(U, { title: "Camera \u2014 host-pattern wrap (controller lifecycle)", get children() {
        return [(() => {
          var c = a("text");
          return t(c, "label", "A synthesized _CameraHost owns the CameraController (init in initState, dispose on unmount). The controller initializes only once Start mounts <Camera> \u2014 no camera / permission \u2192 an inline error banner."), t(c, "fontSize", 11), t(c, "color", "#FF8E8E93"), c;
        })(), (() => {
          var c = a("button");
          return t(c, "onClick", () => O(!h())), G((E) => t(c, "label", h() ? "Stop camera" : "Start camera", E)), c;
        })(), or(() => or(() => !!h())() && (() => {
          var c = a("box"), E = a("camera");
          return p(c, E), t(c, "background", "#FF000000"), t(c, "padding", 4), t(c, "cornerRadius", 8), t(E, "resolutionIndex", 1), c;
        })())];
      } }), v), $(w, I(U, { title: "Counter \u2014 typed callbacks back to JSX", get children() {
        return [(() => {
          var c = a("counter");
          return t(c, "initial", 0), t(c, "onChanged", (E) => r(`onChanged(${E})`)), t(c, "onReset", () => r("onReset()")), c;
        })(), (() => {
          var c = a("text");
          return t(c, "fontSize", 13), t(c, "color", "#FF1C1C1E"), G((E) => t(c, "label", e(), E)), c;
        })()];
      } }), v), $(w, I(U, { title: "Ticker \u2014 JS \u2192 Dart imperative RPC", get children() {
        return [(() => {
          var c = a("ticker");
          return Yn(n, c), t(c, "intervalMs", 500), c;
        })(), (() => {
          var c = a("wrap"), E = a("button"), _ = a("button"), V = a("button"), M = a("button"), F = a("button"), b = a("button"), g = a("button"), C = a("button");
          return p(c, E), p(c, _), p(c, V), p(c, M), p(c, F), p(c, b), p(c, g), p(c, C), t(c, "gap", 6), t(E, "label", "pause"), t(E, "onClick", async () => {
            await n.pause(), l("pause() \u2713");
          }), t(_, "label", "resume"), t(_, "onClick", async () => {
            await n.resume(), l("resume() \u2713");
          }), t(V, "label", "reset"), t(V, "onClick", async () => {
            await n.reset(), l("reset() \u2713");
          }), t(M, "label", "+10"), t(M, "onClick", async () => {
            await n.bump(10), l(`bump(10), now getValue() \u2192 ${await n.getValue()}`);
          }), t(F, "label", "read"), t(F, "onClick", async () => {
            l(`getValue() \u2192 ${await n.getValue()}, isPaused() \u2192 ${await n.isPaused()}`);
          }), t(b, "label", "describe"), t(b, "onClick", async () => {
            l(`describe() \u2192 ${await n.describe("hello from JSX")}`);
          }), t(g, "label", "snapshot"), t(g, "onClick", async () => {
            const x = await n.snapshot();
            l(`snapshot() \u2192 value=${x.value} paused=${x.paused} ts=${x.timestamp}`);
          }), t(C, "label", "sub/unsub"), t(C, "onClick", () => {
            if (s())
              s()(), d(() => null), l("unsubscribed from ticks$");
            else {
              const x = n.ticks$((k) => {
                l(`stream tick: ${k}`);
              });
              d(() => x), l("subscribed to ticks$ \u2014 wait for emissions\u2026");
            }
          }), c;
        })(), (() => {
          var c = a("text");
          return t(c, "fontSize", 13), t(c, "color", "#FF1C1C1E"), G((E) => t(c, "label", o(), E)), c;
        })()];
      } }), v), $(w, I(U, { title: "Stickers \u2014 List<Widget> children + gradient prop", get children() {
        var c = a("stickers"), E = a("greeting"), _ = a("greeting"), V = a("greeting");
        return p(c, E), p(c, _), p(c, V), t(c, "gap", 6), t(c, "padding", 10), t(c, "gradient", { type: "linear", colors: ["#FFFFE082", "#FFB0F0D0", "#FFB0E0FF"], stops: [0, 0.5, 1], begin: "topLeft", end: "bottomRight" }), t(E, "name", "multi-child A"), t(E, "color", "#FF6B4F00"), t(E, "fontSize", 14), t(_, "name", "multi-child B"), t(_, "color", "#FF6B4F00"), t(_, "fontSize", 14), t(V, "name", "multi-child C"), t(V, "color", "#FF6B4F00"), t(V, "fontSize", 14), c;
      } }), v), t(v, "label", "\u2014 end of Libs demo \u2014"), t(v, "fontSize", 12), t(v, "color", "#FF8E8E93"), w;
    })();
  }
  function ci() {
    const [e, r] = z(0);
    return (() => {
      var n = a("tabs"), o = a("tab"), l = a("tab"), s = a("tab");
      return p(n, o), p(n, l), p(n, s), t(n, "onChange", r), t(n, "height", "fill"), t(o, "title", "UI"), t(o, "icon", "grid"), $(o, I(ti, {})), t(l, "title", "List"), t(l, "icon", "list"), $(l, I(ai, {})), t(s, "title", "Libs"), t(s, "icon", "explore"), $(s, I(si, {})), G((d) => t(n, "activeTab", e(), d)), n;
    })();
  }
  Xn(() => I(ci, {}), jn);
})();
})
