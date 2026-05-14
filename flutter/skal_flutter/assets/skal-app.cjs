// @bun @bytecode @bun-cjs
(function(exports, require, module, __filename, __dirname) {// ../flutter/skal_flutter/assets/skal-app.js
(function() {
  var ae = { context: undefined, registry: undefined, effects: undefined, done: false, getContextId() {
    return Ot(this.context.count);
  }, getNextContextId() {
    return Ot(this.context.count++);
  } };
  function Ot(e) {
    const t = String(e), n = t.length - 1;
    return ae.context.id + (n ? String.fromCharCode(96 + n) : "") + t;
  }
  function pt(e) {
    ae.context = e;
  }
  function ln() {
    return { ...ae.context, id: ae.getNextContextId(), count: 0 };
  }
  var an = (e, t) => e === t, Qe = Symbol("solid-proxy"), un = typeof Proxy == "function", fn = Symbol("solid-track"), Fe = { equals: an }, Pt = null, cn = Ft, G = 1, we = 2, Tt = { owned: null, cleanups: null, context: null, owner: null }, F = null, g = null, be = null, ue = null, k = null, D = null, V = null, Ne = 0;
  function ke(e, t) {
    const n = k, r = F, i = e.length === 0, s = t === undefined ? r : t, a = i ? Tt : { owned: null, cleanups: null, context: s ? s.context : null, owner: s }, h = i ? e : () => e(() => fe(() => J(a)));
    F = a, k = null;
    try {
      return j(h, true);
    } finally {
      k = n, F = r;
    }
  }
  function B(e, t) {
    t = t ? Object.assign({}, Fe, t) : Fe;
    const n = { value: e, observers: null, observerSlots: null, comparator: t.equals || undefined }, r = (i) => (typeof i == "function" && (g && g.running && g.sources.has(n) ? i = i(n.tValue) : i = i(n.value)), At(n, i));
    return [mt.bind(n), r];
  }
  function K(e, t, n) {
    const r = Ct(e, t, false, G);
    be && g && g.running ? D.push(r) : De(r);
  }
  function xe(e, t, n) {
    n = n ? Object.assign({}, Fe, n) : Fe;
    const r = Ct(e, t, true, 0);
    return r.observers = null, r.observerSlots = null, r.comparator = n.equals || undefined, be && g && g.running ? (r.tState = G, D.push(r)) : De(r), mt.bind(r);
  }
  function fe(e) {
    if (!ue && k === null)
      return e();
    const t = k;
    k = null;
    try {
      return ue ? ue.untrack(e) : e();
    } finally {
      k = t;
    }
  }
  function Rt(e) {
    return F === null || (F.cleanups === null ? F.cleanups = [e] : F.cleanups.push(e)), e;
  }
  function gn(e) {
    if (g && g.running)
      return e(), g.done;
    const t = k, n = F;
    return Promise.resolve().then(() => {
      k = t, F = n;
      let r;
      return (be || hn) && (r = g || (g = { sources: new Set, effects: [], promises: new Set, disposed: new Set, queue: new Set, running: true }), r.done || (r.done = new Promise((i) => r.resolve = i)), r.running = true), j(e, false), k = F = null, r ? r.done : undefined;
    });
  }
  var [Vr, yt] = B(false), hn;
  function mt() {
    const e = g && g.running;
    if (this.sources && (e ? this.tState : this.state))
      if ((e ? this.tState : this.state) === G)
        De(this);
      else {
        const t = D;
        D = null, j(() => Le(this), false), D = t;
      }
    if (k) {
      const t = this.observers ? this.observers.length : 0;
      k.sources ? (k.sources.push(this), k.sourceSlots.push(t)) : (k.sources = [this], k.sourceSlots = [t]), this.observers ? (this.observers.push(k), this.observerSlots.push(k.sources.length - 1)) : (this.observers = [k], this.observerSlots = [k.sources.length - 1]);
    }
    return e && g.sources.has(this) ? this.tValue : this.value;
  }
  function At(e, t, n) {
    let r = g && g.running && g.sources.has(e) ? e.tValue : e.value;
    if (!e.comparator || !e.comparator(r, t)) {
      if (g) {
        const i = g.running;
        (i || !n && g.sources.has(e)) && (g.sources.add(e), e.tValue = t), i || (e.value = t);
      } else
        e.value = t;
      e.observers && e.observers.length && j(() => {
        for (let i = 0;i < e.observers.length; i += 1) {
          const s = e.observers[i], a = g && g.running;
          a && g.disposed.has(s) || ((a ? !s.tState : !s.state) && (s.pure ? D.push(s) : V.push(s), s.observers && Nt(s)), a ? s.tState = G : s.state = G);
        }
        if (D.length > 1e6)
          throw D = [], new Error;
      }, false);
    }
    return t;
  }
  function De(e) {
    if (!e.fn)
      return;
    J(e);
    const t = Ne;
    It(e, g && g.running && g.sources.has(e) ? e.tValue : e.value, t), g && !g.running && g.sources.has(e) && queueMicrotask(() => {
      j(() => {
        g && (g.running = true), k = F = e, It(e, e.tValue, t), k = F = null;
      }, false);
    });
  }
  function It(e, t, n) {
    let r;
    const i = F, s = k;
    k = F = e;
    try {
      r = e.fn(t);
    } catch (a) {
      return e.pure && (g && g.running ? (e.tState = G, e.tOwned && e.tOwned.forEach(J), e.tOwned = undefined) : (e.state = G, e.owned && e.owned.forEach(J), e.owned = null)), e.updatedAt = n + 1, et(a);
    } finally {
      k = s, F = i;
    }
    (!e.updatedAt || e.updatedAt <= n) && (e.updatedAt != null && ("observers" in e) ? At(e, r, true) : g && g.running && e.pure ? (g.sources.has(e) || (e.value = r), g.sources.add(e), e.tValue = r) : e.value = r, e.updatedAt = n);
  }
  function Ct(e, t, n, r = G, i) {
    const s = { fn: e, state: r, updatedAt: null, owned: null, sources: null, sourceSlots: null, cleanups: null, value: t, owner: F, context: F ? F.context : null, pure: n };
    if (g && g.running && (s.state = 0, s.tState = r), F === null || F !== Tt && (g && g.running && F.pure ? F.tOwned ? F.tOwned.push(s) : F.tOwned = [s] : F.owned ? F.owned.push(s) : F.owned = [s]), ue && s.fn) {
      const a = s.fn, [h, d] = B(undefined, { equals: false }), w = ue.factory(a, d);
      Rt(() => w.dispose());
      let v;
      const _ = () => gn(d).then(() => {
        v && (v.dispose(), v = undefined);
      });
      s.fn = (b) => (h(), g && g.running ? (v || (v = ue.factory(a, _)), v.track(b)) : w.track(b));
    }
    return s;
  }
  function Ze(e) {
    const t = g && g.running;
    if ((t ? e.tState : e.state) === 0)
      return;
    if ((t ? e.tState : e.state) === we)
      return Le(e);
    if (e.suspense && fe(e.suspense.inFallback))
      return e.suspense.effects.push(e);
    const n = [e];
    for (;(e = e.owner) && (!e.updatedAt || e.updatedAt < Ne); ) {
      if (t && g.disposed.has(e))
        return;
      (t ? e.tState : e.state) && n.push(e);
    }
    for (let r = n.length - 1;r >= 0; r--) {
      if (e = n[r], t) {
        let i = e, s = n[r + 1];
        for (;(i = i.owner) && i !== s; )
          if (g.disposed.has(i))
            return;
      }
      if ((t ? e.tState : e.state) === G)
        De(e);
      else if ((t ? e.tState : e.state) === we) {
        const i = D;
        D = null, j(() => Le(e, n[0]), false), D = i;
      }
    }
  }
  function j(e, t) {
    if (D)
      return e();
    let n = false;
    t || (D = []), V ? n = true : V = [], Ne++;
    try {
      const r = e();
      return _n(n), r;
    } catch (r) {
      n || (V = null), D = null, et(r);
    }
  }
  function _n(e) {
    if (D && (be && g && g.running ? dn(D) : Ft(D), D = null), e)
      return;
    let t;
    if (g) {
      if (!g.promises.size && !g.queue.size) {
        const { sources: r, disposed: i } = g;
        V.push.apply(V, g.effects), t = g.resolve;
        for (const s of V)
          "tState" in s && (s.state = s.tState), delete s.tState;
        g = null, j(() => {
          for (const s of i)
            J(s);
          for (const s of r) {
            if (s.value = s.tValue, s.owned)
              for (let a = 0, h = s.owned.length;a < h; a++)
                J(s.owned[a]);
            s.tOwned && (s.owned = s.tOwned), delete s.tValue, delete s.tOwned, s.tState = 0;
          }
          yt(false);
        }, false);
      } else if (g.running) {
        g.running = false, g.effects.push.apply(g.effects, V), V = null, yt(true);
        return;
      }
    }
    const n = V;
    V = null, n.length && j(() => cn(n), false), t && t();
  }
  function Ft(e) {
    for (let t = 0;t < e.length; t++)
      Ze(e[t]);
  }
  function dn(e) {
    for (let t = 0;t < e.length; t++) {
      const n = e[t], r = g.queue;
      r.has(n) || (r.add(n), be(() => {
        r.delete(n), j(() => {
          g.running = true, Ze(n);
        }, false), g && (g.running = false);
      }));
    }
  }
  function Le(e, t) {
    const n = g && g.running;
    n ? e.tState = 0 : e.state = 0;
    for (let r = 0;r < e.sources.length; r += 1) {
      const i = e.sources[r];
      if (i.sources) {
        const s = n ? i.tState : i.state;
        s === G ? i !== t && (!i.updatedAt || i.updatedAt < Ne) && Ze(i) : s === we && Le(i, t);
      }
    }
  }
  function Nt(e) {
    const t = g && g.running;
    for (let n = 0;n < e.observers.length; n += 1) {
      const r = e.observers[n];
      (t ? !r.tState : !r.state) && (t ? r.tState = we : r.state = we, r.pure ? D.push(r) : V.push(r), r.observers && Nt(r));
    }
  }
  function J(e) {
    let t;
    if (e.sources)
      for (;e.sources.length; ) {
        const n = e.sources.pop(), r = e.sourceSlots.pop(), i = n.observers;
        if (i && i.length) {
          const s = i.pop(), a = n.observerSlots.pop();
          r < i.length && (s.sourceSlots[a] = r, i[r] = s, n.observerSlots[r] = a);
        }
      }
    if (e.tOwned) {
      for (t = e.tOwned.length - 1;t >= 0; t--)
        J(e.tOwned[t]);
      delete e.tOwned;
    }
    if (g && g.running && e.pure)
      kt(e, true);
    else if (e.owned) {
      for (t = e.owned.length - 1;t >= 0; t--)
        J(e.owned[t]);
      e.owned = null;
    }
    if (e.cleanups) {
      for (t = e.cleanups.length - 1;t >= 0; t--)
        e.cleanups[t]();
      e.cleanups = null;
    }
    g && g.running ? e.tState = 0 : e.state = 0;
  }
  function kt(e, t) {
    if (t || (e.tState = 0, g.disposed.add(e)), e.owned)
      for (let n = 0;n < e.owned.length; n++)
        kt(e.owned[n]);
  }
  function vn(e) {
    return e instanceof Error ? e : new Error(typeof e == "string" ? e : "Unknown error", { cause: e });
  }
  function xt(e, t, n) {
    try {
      for (const r of t)
        r(e);
    } catch (r) {
      et(r, n && n.owner || null);
    }
  }
  function et(e, t = F) {
    const n = Pt && t && t.context && t.context[Pt], r = vn(e);
    if (!n)
      throw r;
    V ? V.push({ fn() {
      xt(r, n, t);
    }, state: G }) : xt(r, n, t);
  }
  var En = Symbol("fallback");
  function Dt(e) {
    for (let t = 0;t < e.length; t++)
      e[t]();
  }
  function Sn(e, t, n = {}) {
    let r = [], i = [], s = [], a = 0, h = t.length > 1 ? [] : null;
    return Rt(() => Dt(s)), () => {
      let d = e() || [], w = d.length, v, _;
      return d[fn], fe(() => {
        let I, S, c, A, $, f, u, o, E;
        if (w === 0)
          a !== 0 && (Dt(s), s = [], r = [], i = [], a = 0, h && (h = [])), n.fallback && (r = [En], i[0] = ke((P) => (s[0] = P, n.fallback())), a = 1);
        else if (a === 0) {
          for (i = new Array(w), _ = 0;_ < w; _++)
            r[_] = d[_], i[_] = ke(b);
          a = w;
        } else {
          for (c = new Array(w), A = new Array(w), h && ($ = new Array(w)), f = 0, u = Math.min(a, w);f < u && r[f] === d[f]; f++)
            ;
          for (u = a - 1, o = w - 1;u >= f && o >= f && r[u] === d[o]; u--, o--)
            c[o] = i[u], A[o] = s[u], h && ($[o] = h[u]);
          for (I = new Map, S = new Array(o + 1), _ = o;_ >= f; _--)
            E = d[_], v = I.get(E), S[_] = v === undefined ? -1 : v, I.set(E, _);
          for (v = f;v <= u; v++)
            E = r[v], _ = I.get(E), _ !== undefined && _ !== -1 ? (c[_] = i[v], A[_] = s[v], h && ($[_] = h[v]), _ = S[_], I.set(E, _)) : s[v]();
          for (_ = f;_ < w; _++)
            _ in c ? (i[_] = c[_], s[_] = A[_], h && (h[_] = $[_], h[_](_))) : i[_] = ke(b);
          i = i.slice(0, a = w), r = d.slice(0);
        }
        return i;
      });
      function b(I) {
        if (s[_] = I, h) {
          const [S, c] = B(_);
          return h[_] = c, t(d[_], S);
        }
        return t(d[_]);
      }
    };
  }
  var wn = false;
  function bn(e, t) {
    if (wn && ae.context) {
      const n = ae.context;
      pt(ln());
      const r = fe(() => e(t || {}));
      return pt(n), r;
    }
    return fe(() => e(t || {}));
  }
  function $e() {
    return true;
  }
  var On = { get(e, t, n) {
    return t === Qe ? n : e.get(t);
  }, has(e, t) {
    return t === Qe ? true : e.has(t);
  }, set: $e, deleteProperty: $e, getOwnPropertyDescriptor(e, t) {
    return { configurable: true, enumerable: true, get() {
      return e.get(t);
    }, set: $e, deleteProperty: $e };
  }, ownKeys(e) {
    return e.keys();
  } };
  function tt(e) {
    return (e = typeof e == "function" ? e() : e) ? e : {};
  }
  function pn() {
    for (let e = 0, t = this.length;e < t; ++e) {
      const n = this[e]();
      if (n !== undefined)
        return n;
    }
  }
  function Lt(...e) {
    let t = false;
    for (let a = 0;a < e.length; a++) {
      const h = e[a];
      t = t || !!h && Qe in h, e[a] = typeof h == "function" ? (t = true, xe(h)) : h;
    }
    if (un && t)
      return new Proxy({ get(a) {
        for (let h = e.length - 1;h >= 0; h--) {
          const d = tt(e[h])[a];
          if (d !== undefined)
            return d;
        }
      }, has(a) {
        for (let h = e.length - 1;h >= 0; h--)
          if (a in tt(e[h]))
            return true;
        return false;
      }, keys() {
        const a = [];
        for (let h = 0;h < e.length; h++)
          a.push(...Object.keys(tt(e[h])));
        return [...new Set(a)];
      } }, On);
    const n = {}, r = Object.create(null);
    for (let a = e.length - 1;a >= 0; a--) {
      const h = e[a];
      if (!h)
        continue;
      const d = Object.getOwnPropertyNames(h);
      for (let w = d.length - 1;w >= 0; w--) {
        const v = d[w];
        if (v === "__proto__" || v === "constructor")
          continue;
        const _ = Object.getOwnPropertyDescriptor(h, v);
        if (!r[v])
          r[v] = _.get ? { enumerable: true, configurable: true, get: pn.bind(n[v] = [_.get.bind(h)]) } : _.value !== undefined ? _ : undefined;
        else {
          const b = n[v];
          b && (_.get ? b.push(_.get.bind(h)) : _.value !== undefined && b.push(() => _.value));
        }
      }
    }
    const i = {}, s = Object.keys(r);
    for (let a = s.length - 1;a >= 0; a--) {
      const h = s[a], d = r[h];
      d && d.get ? Object.defineProperty(i, h, d) : i[h] = d ? d.value : undefined;
    }
    return i;
  }
  function $t(e) {
    const t = "fallback" in e && { fallback: () => e.fallback };
    return xe(Sn(() => e.each, e.children, t || undefined));
  }
  var Pn = (e) => xe(() => e());
  function Tn({ createElement: e, createTextNode: t, isTextNode: n, replaceText: r, insertNode: i, removeNode: s, setProperty: a, getParentNode: h, getFirstChild: d, getNextSibling: w }) {
    function v(f, u, o, E) {
      if (o !== undefined && !E && (E = []), typeof u != "function")
        return _(f, u, E, o);
      K((P) => _(f, u(), P, o), E);
    }
    function _(f, u, o, E, P) {
      for (;typeof o == "function"; )
        o = o();
      if (u === o)
        return o;
      const T = typeof u, p = E !== undefined;
      if (T === "string" || T === "number")
        if (T === "number" && (u = u.toString()), p) {
          let O = o[0];
          O && n(O) ? r(O, u) : O = t(u), o = S(f, o, E, O);
        } else
          o !== "" && typeof o == "string" ? r(d(f), o = u) : (S(f, o, E, t(u)), o = u);
      else if (u == null || T === "boolean")
        o = S(f, o, E);
      else {
        if (T === "function")
          return K(() => {
            let O = u();
            for (;typeof O == "function"; )
              O = O();
            o = _(f, O, o, E);
          }), () => o;
        if (Array.isArray(u)) {
          const O = [];
          if (b(O, u, P))
            return K(() => o = _(f, O, o, E, true)), () => o;
          if (O.length === 0) {
            const L = S(f, o, E);
            if (p)
              return o = L;
          } else
            Array.isArray(o) ? o.length === 0 ? c(f, O, E) : I(f, o, O) : o == null || o === "" ? c(f, O) : I(f, p && o || [d(f)], O);
          o = O;
        } else {
          if (Array.isArray(o)) {
            if (p)
              return o = S(f, o, E, u);
            S(f, o, null, u);
          } else
            o == null || o === "" || !d(f) ? i(f, u) : A(f, u, d(f));
          o = u;
        }
      }
      return o;
    }
    function b(f, u, o) {
      let E = false;
      for (let P = 0, T = u.length;P < T; P++) {
        let p = u[P], O;
        if (!(p == null || p === true || p === false))
          if (Array.isArray(p))
            E = b(f, p) || E;
          else if ((O = typeof p) == "string" || O === "number")
            f.push(t(p));
          else if (O === "function")
            if (o) {
              for (;typeof p == "function"; )
                p = p();
              E = b(f, Array.isArray(p) ? p : [p]) || E;
            } else
              f.push(p), E = true;
          else
            f.push(p);
      }
      return E;
    }
    function I(f, u, o) {
      let E = o.length, P = u.length, T = E, p = 0, O = 0, L = w(u[P - 1]), W = null;
      for (;p < P || O < T; ) {
        if (u[p] === o[O]) {
          p++, O++;
          continue;
        }
        for (;u[P - 1] === o[T - 1]; )
          P--, T--;
        if (P === p) {
          const H = T < E ? O ? w(o[O - 1]) : o[T - O] : L;
          for (;O < T; )
            i(f, o[O++], H);
        } else if (T === O)
          for (;p < P; )
            (!W || !W.has(u[p])) && s(f, u[p]), p++;
        else if (u[p] === o[T - 1] && o[O] === u[P - 1]) {
          const H = w(u[--P]);
          i(f, o[O++], w(u[p++])), i(f, o[--T], H), u[P] = o[T];
        } else {
          if (!W) {
            W = new Map;
            let Y = O;
            for (;Y < T; )
              W.set(o[Y], Y++);
          }
          const H = W.get(u[p]);
          if (H != null)
            if (O < H && H < T) {
              let Y = p, se = 1, Se;
              for (;++Y < P && Y < T && !((Se = W.get(u[Y])) == null || Se !== H + se); )
                se++;
              if (se > H - O) {
                const Ie = u[p];
                for (;O < H; )
                  i(f, o[O++], Ie);
              } else
                A(f, o[O++], u[p++]);
            } else
              p++;
          else
            s(f, u[p++]);
        }
      }
    }
    function S(f, u, o, E) {
      if (o === undefined) {
        let T;
        for (;T = d(f); )
          s(f, T);
        return E && i(f, E), "";
      }
      const P = E || t("");
      if (u.length) {
        let T = false;
        for (let p = u.length - 1;p >= 0; p--) {
          const O = u[p];
          if (P !== O) {
            const L = h(O) === f;
            !T && !p ? L ? A(f, P, O) : i(f, P, o) : L && s(f, O);
          } else
            T = true;
        }
      } else
        i(f, P, o);
      return [P];
    }
    function c(f, u, o) {
      for (let E = 0, P = u.length;E < P; E++)
        i(f, u[E], o);
    }
    function A(f, u, o) {
      i(f, u, o), s(f, o);
    }
    function $(f, u, o = {}, E) {
      return u || (u = {}), E || K(() => o.children = _(f, u.children, o.children)), K(() => u.ref && u.ref(f)), K(() => {
        for (const P in u) {
          if (P === "children" || P === "ref")
            continue;
          const T = u[P];
          T !== o[P] && (a(f, P, T, o[P]), o[P] = T);
        }
      }), o;
    }
    return { render(f, u) {
      let o;
      return ke((E) => {
        o = E, v(u, f());
      }), o;
    }, insert: v, spread(f, u, o) {
      typeof u == "function" ? K((E) => $(f, u(), E, o)) : $(f, u, undefined, o);
    }, createElement: e, createTextNode: t, insertNode: i, setProp(f, u, o, E) {
      return a(f, u, o, E), o;
    }, mergeProps: Lt, effect: K, memo: Pn, createComponent: bn, use(f, u, o) {
      return fe(() => f(u, o));
    } };
  }
  function Rn(e) {
    const t = Tn(e);
    return t.mergeProps = Lt, t;
  }
  var Vt = 6 * 1024 * 1024, yn = 64, Br = yn, Bt = 4 * 1024 * 1024, ce = 64 + Bt, nt = 768 * 1024, rt = ce + nt, mn = 256 * 1024, it = rt + mn, Ht = ce + nt, An = 0, In = 8, Cn = 12, Fn = 16, Nn = 24, kn = 28, xn = 32, Dn = In >> 2, Ln = Cn >> 2, $n = Nn >> 2, Mt = kn >> 2, Vn = An >> 3, Bn = Fn >> 3, Hn = xn >> 3, Hr = 1, Mr = 2, Ur = 3, Gr = 4, Wr = 16, Yr = 17, qr = 20, Xr = 21, jr = 22, zr = 23, Kr = 24, Jr = 25, Qr = 26, Zr = 27, ei = 28, ti = 29, ni = 30, ri = 31, ii = 32, si = 33, oi = 34, li = 35, ai = 36, ui = 37, fi = 0, ci = 1, gi = 2, hi = 3, _i = 4, di = 5, vi = 6, Ei = 7, Si = 1, wi = 3, bi = 4, Oi = 5, pi = 6, Pi = 7, Ti = 0, Ri = 1, yi = 2, mi = 3, Ai = 4, Ii = 5, Ci = 6, Fi = 0, Ni = 1, ki = 2, xi = 3, Di = 4, Li = 5, $i = 6, Vi = 7, Bi = 8, Hi = 9, Mi = 32, Ui = 33, Gi = 34, Wi = 35, Yi = 36, qi = 37, Xi = 64, ji = 65, zi = 66, Ki = 67, Ji = 68, Qi = 69, Zi = 70, es = 96, ts = 97, ns = 128, rs = 129, is = 130, ss = 131, os = 160, ls = 161, as = 162, us = -1, Mn = 2147483646, Un = 2147483645, ee = globalThis.__skal_acquireBridge();
  if (!ee || ee.byteLength !== Vt)
    throw new Error(`Skal: bridge buffer not available (got ${ee && ee.byteLength})`);
  var Ut = new Uint8Array(ee), M = new Uint32Array(ee), st = new BigInt64Array(ee), Gn = new TextEncoder, Oe = 16, Wn = 64 + Bt >> 2, Yn = 16384, qn = Wn - 4, Ve = 0n, Q = Oe, ge = ce, Be = Oe;
  function ot() {
    M[Dn] = Q - Oe << 2, M[Ln] = ge - ce, Ve += 1n, Atomics.store(st, Vn, Ve), Be = Q;
  }
  function Gt() {
    ot();
    const e = Ve, t = performance.now() + 5000;
    for (;!(Atomics.load(st, Hn) >= e); )
      if (performance.now() > t) {
        console.warn("Skal: drain spin timeout \u2014 UI thread slow; ring will overwrite");
        break;
      }
    Q = Oe, ge = ce, Be = Oe;
  }
  function C(e, t, n, r) {
    let i = Q;
    i >= qn && (Gt(), i = Q), M[i] = e >>> 0, M[i + 1] = t >>> 0, M[i + 2] = n >>> 0, M[i + 3] = r >>> 0, Q = i + 4, Q - Be >= Yn && ot();
  }
  var te = 0, ne = 0;
  function he(e) {
    ge + e.length * 3 > Ht && Gt();
    const t = ge - ce, n = Ut.subarray(ge, Ht), { read: r, written: i } = Gn.encodeInto(e, n);
    if (r !== e.length)
      throw new Error(`Skal: string too large for heap (${e.length} code units > ${nt} bytes)`);
    ge += i, te = t, ne = i;
  }
  function lt(e, t) {
    he(t), C(20, e, te, ne);
  }
  var at = false;
  function Xn() {
    at = false, Q !== Be && ot();
  }
  function x() {
    at || (at = true, queueMicrotask(Xn));
  }
  var q = 1024, y = new Int8Array(256);
  y.fill(-1), y[0] = 0, y[1] = 1, y[2] = 2, y[3] = 3, y[4] = 4, y[5] = 5, y[6] = 6, y[7] = 7, y[8] = 8, y[9] = 9, y[32] = 10, y[33] = 11, y[34] = 12, y[35] = 13, y[36] = 14, y[37] = 15, y[64] = 16, y[65] = 17, y[66] = 18, y[67] = 19, y[68] = 20, y[69] = 21, y[70] = 22, y[96] = 23, y[97] = 24, y[128] = 25, y[129] = 26, y[130] = 27, y[131] = 28, y[160] = 29, y[161] = 30, y[162] = 31;
  var U = 32, He = new Int32Array(q * U), pe = new Float32Array(q * U), Me = new Array(q * U), Pe = new Uint8Array(q * U), _e = 6, de = new Float32Array(q * _e);
  de.fill(NaN);
  var Ue = new Map, Wt = [], jn = 0;
  function zn() {
    const e = q * 2, t = q * U, n = e * U, r = q * _e, i = e * _e, s = new Int32Array(n);
    s.set(He), He = s;
    const a = new Uint8Array(n);
    a.set(Pe), Pe = a;
    const h = new Float32Array(n);
    h.set(pe), h.fill(NaN, t), pe = h;
    const d = new Float32Array(i);
    d.set(de), d.fill(NaN, r), de = d, Me.length = n, q = e;
  }
  function Ge(e) {
    let t = Ue.get(e);
    if (t === undefined) {
      t = Wt.pop(), t === undefined && (t = jn++), t >= q && zn(), Ue.set(e, t);
      const n = t * U;
      Pe.fill(0, n, n + U), pe.fill(NaN, n, n + U);
      for (let r = n;r < n + U; r++)
        Me[r] = undefined;
    }
    return t;
  }
  function Kn(e) {
    const t = Ue.get(e);
    if (t !== undefined) {
      Ue.delete(e), Wt.push(t);
      const n = t * _e;
      de.fill(NaN, n, n + _e);
    }
  }
  var Te = 0, Re = 0, ve = new Float32Array(1), ye = new Uint32Array(ve.buffer);
  function We(e, t, n) {
    const r = y[t];
    if (r < 0)
      return;
    const i = Ge(e) * U + r, s = n | 0;
    if (Pe[i] !== 0 && He[i] === s) {
      Re++;
      return;
    }
    He[i] = s, Pe[i] = 1, C(16, e, t, s), Te++;
  }
  function Jn(e, t, n) {
    const r = y[t];
    if (r < 0)
      return;
    const i = Ge(e) * U + r;
    if (pe[i] === n) {
      Re++;
      return;
    }
    pe[i] = n, ve[0] = n, C(17, e, t, ye[0]), Te++;
  }
  function Qn(e, t, n) {
    const r = y[t];
    if (r < 0)
      return;
    const i = Ge(e) * U + r;
    if (Me[i] === n) {
      Re++;
      return;
    }
    Me[i] = n, he(n == null ? "" : String(n)), C(22, e, (t & 255) << 24 | te & 16777215, ne), Te++;
  }
  function Ee(e, t, n, r) {
    const i = Ge(e) * _e + n;
    if (de[i] === r) {
      Re++;
      return;
    }
    de[i] = r, ve[0] = r, C(t, e, 0, ye[0]), Te++;
  }
  function Zn(e, t) {
    Ee(e, 32, 0, t);
  }
  function er(e, t) {
    Ee(e, 33, 1, t);
  }
  function tr(e, t) {
    Ee(e, 34, 2, t);
  }
  function nr(e, t) {
    Ee(e, 35, 3, t);
  }
  function rr(e, t) {
    Ee(e, 36, 4, t);
  }
  function ir(e, t) {
    Ee(e, 37, 5, t);
  }
  var Yt = new Map;
  function sr(e) {
    let t = 2166136261;
    for (let n = 0;n < e.length; n++)
      t ^= e.charCodeAt(n), t = Math.imul(t, 16777619) >>> 0;
    return t;
  }
  function re(e) {
    let t = Yt.get(e);
    return t !== undefined || (t = sr(e), he(e), C(23, t, te, ne), Yt.set(e, t)), t;
  }
  function or(e, t) {
    C(4, e, re(t), 0);
  }
  function qt(e, t, n) {
    C(24, e, re(t), n >>> 0);
  }
  function Xt(e, t, n) {
    const r = re(t);
    ve[0] = n, C(25, e, r, ye[0]);
  }
  function lr(e, t, n) {
    const r = re(t);
    he(n == null ? "" : String(n));
    const i = te & 16777215, s = ne & 255;
    C(26, e, r, i << 8 | s);
  }
  function ar(e, t, n) {
    C(27, e, re(t), n);
  }
  var me = new Map, Z = new Map, jt = 1;
  function ur(e, t, n) {
    const r = re(t), i = jt++;
    for (let s = 0;s < n.length; s++) {
      const a = n[s];
      if (typeof a == "number")
        Number.isInteger(a) ? C(29, i, 1, a | 0) : (ve[0] = a, C(29, i, 2, ye[0]));
      else if (typeof a == "boolean")
        C(29, i, 3, a ? 1 : 0);
      else if (typeof a == "string") {
        he(a);
        const h = te & 16777215, d = ne & 255;
        C(29, i, 4, h << 8 | d);
      } else
        C(29, i, 0, 0);
    }
    return C(28, e, r, i), x(), new Promise((s, a) => {
      me.set(i, { resolve: s, reject: a });
    });
  }
  function fr(e, t, n, r, i) {
    const s = re(t), a = jt++;
    for (let h = 0;h < n.length; h++) {
      const d = n[h];
      if (typeof d == "number")
        Number.isInteger(d) ? C(29, a, 1, d | 0) : (ve[0] = d, C(29, a, 2, ye[0]));
      else if (typeof d == "boolean")
        C(29, a, 3, d ? 1 : 0);
      else if (typeof d == "string") {
        he(d);
        const w = te & 16777215, v = ne & 255;
        C(29, a, 4, w << 8 | v);
      } else
        C(29, a, 0, 0);
    }
    return C(30, e, s, a), x(), Z.set(a, { onValue: r, onError: i && i.onError, onDone: i && i.onDone }), function() {
      Z.has(a) && (Z.delete(a), C(31, a, 0, 0), x());
    };
  }
  var ut = new Map, cr = 1;
  function zt(e) {
    const t = cr++;
    return ut.set(t, e), t;
  }
  function gr(e, t, n) {
    C(21, e, t, n);
  }
  var ft = 0n, ie = null, Kt = Vt - it, ct = it >> 2, hr = it + Kt >> 2, _r = Kt / 16 | 0, Jt = new ArrayBuffer(4), dr = new Float32Array(Jt), vr = new Uint32Array(Jt), Er = new TextDecoder("utf-8");
  function gt(e, t) {
    return t === 0 ? "" : Er.decode(Ut.subarray(rt + e, rt + e + t));
  }
  globalThis.__skal_drainEvents = function() {
    const e = Atomics.load(st, Bn);
    if (e === ft)
      return;
    const t = ct + (M[$n] >> 2);
    let n = ct + (M[Mt] >> 2);
    const r = hr, i = ct;
    let s = _r;
    for (;n !== t && s-- > 0; ) {
      const a = M[n + 0], h = a & 255, d = a >>> 8 & 255, w = M[n + 1], v = M[n + 2], _ = M[n + 3];
      let b, I = false;
      if (d === 1)
        b = v | 0, I = true;
      else if (d === 2)
        vr[0] = v, b = dr[0], I = true;
      else if (d === 3)
        b = v !== 0, I = true;
      else if (d === 4)
        b = gt(_, v), I = true;
      else if (d === 5) {
        const S = gt(_, v);
        try {
          b = JSON.parse(S);
        } catch {
          b = S;
        }
        I = true;
      } else if (d === 6) {
        const S = gt(_, v);
        try {
          b = JSON.parse(S);
        } catch {
          b = [];
        }
        I = true;
      }
      if (h === 3) {
        const S = me.get(w);
        if (S) {
          me.delete(w);
          try {
            S.resolve(I ? b : undefined);
          } catch (c) {
            ie = c && (c.stack || c.message || String(c)) || "unknown";
          }
        }
      } else if (h === 4) {
        const S = me.get(w);
        if (S) {
          me.delete(w);
          try {
            const c = typeof b == "string" ? b : `skal RPC error (status ${b})`;
            S.reject(new Error(c));
          } catch (c) {
            ie = c && (c.stack || c.message || String(c)) || "unknown";
          }
        }
      } else if (h === 5) {
        const S = Z.get(w);
        if (S)
          try {
            S.onValue(I ? b : undefined);
          } catch (c) {
            ie = c && (c.stack || c.message || String(c)) || "unknown";
          }
      } else if (h === 6) {
        const S = Z.get(w);
        if (S) {
          Z.delete(w);
          try {
            S.onDone && S.onDone();
          } catch (c) {
            ie = c && (c.stack || c.message || String(c)) || "unknown";
          }
        }
      } else if (h === 7) {
        const S = Z.get(w);
        if (S) {
          Z.delete(w);
          try {
            S.onError && S.onError(new Error(typeof b == "string" ? b : "skal stream error"));
          } catch (c) {
            ie = c && (c.stack || c.message || String(c)) || "unknown";
          }
        }
      } else {
        const S = ut.get(w);
        if (S)
          try {
            I ? d === 6 && Array.isArray(b) ? S(...b) : S(b) : S();
          } catch (c) {
            ie = c && (c.stack || c.message || String(c)) || "unknown";
          }
      }
      n += 4, n >= r && (n = i);
    }
    M[Mt] = n - i << 2, ft = e;
  }, globalThis.skalStatus = () => JSON.stringify({ handlerCount: ut.size, opSeq: Number(Ve), lastEventSeq: Number(ft), lastHandlerError: ie, propWrites: Te, propSkips: Re });
  var fs = 1, Sr = 2;
  function Qt() {
    return Sr++;
  }
  var wr = { box: 0, column: 1, scrollView: 5, listView: 6, reorderableListView: 7, row: 2, text: 3, button: 4 }, br = { padding: [0, "u32"], paddingTop: [1, "u32"], paddingRight: [2, "u32"], paddingBottom: [3, "u32"], paddingLeft: [4, "u32"], width: [5, "dim"], height: [6, "dim"], weight: [7, "f32"], alignment: [8, "u32"], gap: [9, "u32"], background: [32, "color"], color: [33, "color"], cornerRadius: [34, "u32"], borderWidth: [35, "u32"], borderColor: [36, "color"], shadow: [37, "u32"], fontSize: [64, "u32"], fontWeight: [65, "u32"], fontFamily: [66, "u32"], textAlign: [67, "u32"], lineHeight: [68, "u32"], maxLines: [69, "u32"], textOverflow: [70, "u32"], src: [96, "str"], contentScale: [97, "u32"], placeholder: [128, "str"], value: [129, "str"], keyboardType: [130, "u32"], secureEntry: [131, "u32"], enabled: [160, "u32"], focusable: [161, "u32"], visible: [162, "u32"] }, Or = { opacity: Zn, translationX: er, translationY: tr, scaleX: nr, scaleY: rr, rotation: ir };
  function pr(e) {
    if (typeof e == "number")
      return e | 0;
    if (typeof e != "string")
      return 0;
    let t = e.trim();
    t.startsWith("#") && (t = t.slice(1));
    let n = 0, r = 0, i = 0, s = 255;
    return t.length === 3 ? (n = parseInt(t[0] + t[0], 16), r = parseInt(t[1] + t[1], 16), i = parseInt(t[2] + t[2], 16)) : t.length === 4 ? (n = parseInt(t[0] + t[0], 16), r = parseInt(t[1] + t[1], 16), i = parseInt(t[2] + t[2], 16), s = parseInt(t[3] + t[3], 16)) : t.length === 6 ? (n = parseInt(t.slice(0, 2), 16), r = parseInt(t.slice(2, 4), 16), i = parseInt(t.slice(4, 6), 16)) : t.length === 8 && (s = parseInt(t.slice(0, 2), 16), n = parseInt(t.slice(2, 4), 16), r = parseInt(t.slice(4, 6), 16), i = parseInt(t.slice(6, 8), 16)), (s & 255) << 24 | (n & 255) << 16 | (r & 255) << 8 | i & 255 | 0;
  }
  function Pr(e) {
    return typeof e == "number" ? e | 0 : e === "fill" ? Mn : e === "wrap" ? Un : -1;
  }
  function Tr(e, t, n) {
    if (n == null)
      return;
    if (t === "ref" && n && typeof n.__skalBind == "function") {
      n.__skalBind(e.id);
      return;
    }
    const r = typeof n;
    if (r === "function") {
      const i = zt(n);
      ar(e.id, t, i), x();
      return;
    }
    if (r === "number") {
      Number.isInteger(n) && n >= 0 && n <= 4294967295 && qt(e.id, t, n | 0), Xt(e.id, t, n), x();
      return;
    }
    if (r === "string") {
      lr(e.id, t, n), x();
      return;
    }
    if (r === "boolean") {
      qt(e.id, t, n ? 1 : 0), x();
      return;
    }
  }
  function Rr(e) {
    const t = [e];
    for (;t.length > 0; ) {
      const n = t.pop();
      Kn(n.id);
      let r = n.firstChild;
      for (;r; )
        t.push(r), r = r.nextSibling;
    }
  }
  var Ye = class {
    constructor(e, t, n = false, r = false) {
      this.tag = e, this.id = t, this.isText = n, this.isCustom = r, this.parent = null, this.firstChild = null, this.lastChild = null, this.nextSibling = null, this.prevSibling = null, this.text = "";
    }
  }, yr = Rn({ createElement(e) {
    const t = Qt(), n = wr[e];
    return n !== undefined ? (C(1, t, n, 0), x(), new Ye(e, t, false, false)) : (or(t, e), x(), new Ye(e, t, false, true));
  }, createTextNode(e) {
    const t = Qt();
    C(1, t, 3, 0);
    const n = e == null ? "" : String(e);
    n.length > 0 && lt(t, n), x();
    const r = new Ye("#text", t, true);
    return r.text = n, r;
  }, replaceText(e, t) {
    const n = t == null ? "" : String(t);
    e.text !== n && (e.text = n, lt(e.id, n), x());
  }, setProperty(e, t, n, r) {
    if (e.isCustom) {
      Tr(e, t, n);
      return;
    }
    if (t === "onClick" || t === "onclick") {
      if (typeof n == "function") {
        const a = zt(n);
        gr(e.id, 1, a), x();
      }
      return;
    }
    if (t === "label" && (e.tag === "button" || e.tag === "text")) {
      const a = n == null ? "" : String(n);
      lt(e.id, a), x();
      return;
    }
    const i = Or[t];
    if (i !== undefined) {
      typeof n == "number" && (i(e.id, n), x());
      return;
    }
    const s = br[t];
    if (s !== undefined) {
      const [a, h] = s;
      if (n == null)
        return;
      switch (h) {
        case "u32":
          typeof n == "number" ? (We(e.id, a, n | 0), x()) : typeof n == "boolean" && (We(e.id, a, n ? 1 : 0), x());
          return;
        case "f32":
          typeof n == "number" && (Jn(e.id, a, n), x());
          return;
        case "str":
          Qn(e.id, a, String(n)), x();
          return;
        case "color":
          We(e.id, a, pr(n)), x();
          return;
        case "dim":
          We(e.id, a, Pr(n)), x();
          return;
      }
      return;
    }
    if (t === "style" && n && typeof n == "object") {
      for (const a in n)
        this.setProperty(e, a, n[a]);
      return;
    }
  }, insertNode(e, t, n) {
    const r = n ? n.id : 0;
    C(3, e.id, t.id, r), x(), t.parent = e, n ? (t.nextSibling = n, t.prevSibling = n.prevSibling, n.prevSibling ? n.prevSibling.nextSibling = t : e.firstChild = t, n.prevSibling = t) : (t.prevSibling = e.lastChild, t.nextSibling = null, e.lastChild ? e.lastChild.nextSibling = t : e.firstChild = t, e.lastChild = t);
  }, removeNode(e, t) {
    C(2, t.id, 0, 0), Rr(t), x(), t.prevSibling ? t.prevSibling.nextSibling = t.nextSibling : e.firstChild = t.nextSibling, t.nextSibling ? t.nextSibling.prevSibling = t.prevSibling : e.lastChild = t.prevSibling, t.parent = null, t.prevSibling = null, t.nextSibling = null;
  }, isTextNode(e) {
    return e.isText;
  }, getParentNode(e) {
    return e.parent;
  }, getFirstChild(e) {
    return e.firstChild;
  }, getNextSibling(e) {
    return e.nextSibling;
  } }), { render: mr, effect: Zt, memo: cs, createComponent: qe, createElement: R, createTextNode: gs, insertNode: m, insert: Ae, spread: hs, setProp: l, mergeProps: _s, use: Ar } = yr;
  C(1, 1, 0, 0), x();
  var Ir = new Ye("box", 1, false);
  function Cr() {
    let e = 0;
    const t = function() {};
    return t.__skalBind = (n) => {
      e = n;
    }, new Proxy(t, { apply(n, r, i) {
      const s = i[0];
      s && typeof s.id == "number" && (e = s.id);
    }, get(n, r) {
      if (r === "__skalBind" || typeof r == "symbol")
        return t[r];
      if (typeof r == "string" && r.endsWith("$") && r.length > 1) {
        const i = r.slice(0, -1);
        return (...s) => {
          if (e === 0)
            throw new Error(`skal ref: cannot call .${String(r)}() before the host mounts. Move the call into a JSX event handler.`);
          const a = s[s.length - 1];
          if (typeof a != "function")
            throw new TypeError(`skal ref: .${String(r)}() requires a callback as its last argument (got ${typeof a})`);
          const h = s.slice(0, -1);
          return fr(e, i, h, a);
        };
      }
      return (...i) => e === 0 ? Promise.reject(new Error(`skal ref: cannot call .${String(r)}() before the host mounts. Move the call into a JSX event handler.`)) : ur(e, r, i);
    } });
  }
  var en = ["Just shipped a new feature, feeling great about how it turned out \uD83D\uDE80", "Hot take: the best APIs are the ones you don't have to read docs for", "Spent the morning refactoring legacy code \u2014 so much cleaner now", "There's no such thing as 'just a small change' in production code", "If your tests are slow, that's a smell. Fast tests = good tests", "Bun's startup time keeps surprising me, even after a year", "Why is naming things still the hardest part of programming?", "Found a 10\xD7 speedup in a critical path today. Profilers, not guesses", "Reading 'The Art of Unix Programming' for the third time", "Premature abstraction is somehow worse than premature optimization", "Latency is a feature, throughput is an artifact of how you measure", "Half of debugging is admitting your assumption was wrong", "You don't ship the codebase you have. You ship the codebase you understand", "Cache invalidation, naming things, off-by-one. The classics", "Every config file format eventually grows a turing-complete templating layer"], Fr = Array.from({ length: 15000 }, (e, t) => ({ author: `@user${t * 2654435761 >>> 17}`, body: en[t % en.length], num: t + 1 })), Nr = [50, 200, 500, 1000, 2000, 5000, 1e4], tn = "#FFF1F5F9", nn = "#FF475569", kr = "#FF22C55E", xr = "#FFEF4444", rn = "#FFFFFFFF";
  function Dr(e) {
    const [t, n] = B(0), [r, i] = B(false), [s, a] = B(0), [h, d] = B(false);
    return (() => {
      var w = R("column"), v = R("text"), _ = R("text"), b = R("row"), I = R("button"), S = R("button");
      return m(w, v), m(w, _), m(w, b), l(w, "background", "#FFFFFFFF"), l(w, "padding", 12), l(w, "cornerRadius", 10), l(w, "borderWidth", 1), l(w, "borderColor", "#FFE5E5EA"), l(w, "gap", 6), l(v, "fontWeight", 700), l(v, "fontSize", 14), l(v, "color", "#FF1DA1F2"), l(_, "fontSize", 14), l(_, "color", "#FF1F2937"), l(_, "maxLines", 3), l(_, "textOverflow", 1), m(b, I), m(b, S), l(b, "gap", 10), l(I, "fontSize", 12), l(I, "padding", 6), l(I, "cornerRadius", 16), l(I, "onClick", () => {
        const c = !r();
        i(c), n(t() + (c ? 1 : -1));
      }), l(S, "fontSize", 12), l(S, "padding", 6), l(S, "cornerRadius", 16), l(S, "onClick", () => {
        const c = !h();
        d(c), a(s() + (c ? 1 : -1));
      }), Zt((c) => {
        var A = `#${e.num} \xB7 ${e.author}`, $ = e.body, f = `\u2665 ${t()}`, u = r() ? kr : tn, o = r() ? rn : nn, E = `\u21A9 ${s()}`, P = h() ? xr : tn, T = h() ? rn : nn;
        return A !== c.e && (c.e = l(v, "label", A, c.e)), $ !== c.t && (c.t = l(_, "label", $, c.t)), f !== c.a && (c.a = l(I, "label", f, c.a)), u !== c.o && (c.o = l(I, "background", u, c.o)), o !== c.i && (c.i = l(I, "color", o, c.i)), E !== c.n && (c.n = l(S, "label", E, c.n)), P !== c.s && (c.s = l(S, "background", P, c.s)), T !== c.h && (c.h = l(S, "color", T, c.h)), c;
      }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined, n: undefined, s: undefined, h: undefined }), w;
    })();
  }
  function Lr() {
    const [e, t] = B(0), [n, r] = B("tap +1000 to benchmark fast-path"), [i, s] = B(50), [a, h] = B(""), [d, w] = B("\u2014 waiting for counter events \u2014"), v = Cr(), [_, b] = B("\u2014 tap a button to RPC the Ticker \u2014"), [I, S] = B(null), c = xe(() => Fr.slice(0, i()));
    return (() => {
      var A = R("listView"), $ = R("greeting"), f = R("shimmerFromColors"), u = R("greeting"), o = R("qrImageView"), E = R("box"), P = R("camera"), T = R("counter"), p = R("text"), O = R("ticker"), L = R("row"), W = R("button"), H = R("button"), Y = R("button"), se = R("button"), Se = R("button"), Ie = R("button"), ht = R("button"), _t = R("button"), dt = R("button"), Xe = R("text"), oe = R("stickers"), je = R("greeting"), ze = R("greeting"), Ke = R("greeting"), Ce = R("box"), Je = R("row"), vt = R("button"), Et = R("button"), St = R("button"), wt = R("row");
      return m(A, $), m(A, f), m(A, o), m(A, E), m(A, T), m(A, p), m(A, O), m(A, L), m(A, Xe), m(A, oe), m(A, Ce), m(A, Je), m(A, St), m(A, wt), l(A, "background", "#FFFAFAFA"), l(A, "padding", 16), l(A, "gap", 12), l($, "name", "Skal"), l($, "color", "#FF1DA1F2"), l($, "fontSize", 20), m(f, u), l(f, "baseColor", 4290624957), l(f, "highlightColor", 4292927712), l(f, "period", 1500), l(u, "name", "loading\u2026"), l(u, "color", "#FF333333"), l(u, "fontSize", 28), l(o, "data", "https://skal.dev"), l(o, "size", 200), m(E, P), l(E, "background", "#FF000000"), l(E, "padding", 4), l(E, "cornerRadius", 8), l(P, "resolutionIndex", 1), l(T, "initial", 0), l(T, "onChanged", (N) => w(`onChanged(${N})`)), l(T, "onReset", () => w("onReset()")), l(p, "fontSize", 14), l(p, "color", "#FF333333"), Ar(v, O), l(O, "intervalMs", 500), m(L, W), m(L, H), m(L, Y), m(L, se), m(L, Se), m(L, Ie), m(L, ht), m(L, _t), m(L, dt), l(L, "gap", 6), l(W, "label", "pause"), l(W, "onClick", async () => {
        await v.pause(), b("pause() \u2713");
      }), l(H, "label", "resume"), l(H, "onClick", async () => {
        await v.resume(), b("resume() \u2713");
      }), l(Y, "label", "reset"), l(Y, "onClick", async () => {
        await v.reset(), b("reset() \u2713");
      }), l(se, "label", "+10"), l(se, "onClick", async () => {
        await v.bump(10), b(`bump(10), now getValue() \u2192 ${await v.getValue()}`);
      }), l(Se, "label", "read"), l(Se, "onClick", async () => {
        b(`getValue() \u2192 ${await v.getValue()}, isPaused() \u2192 ${await v.isPaused()}`);
      }), l(Ie, "label", "describe"), l(Ie, "onClick", async () => {
        b(`describe() \u2192 ${await v.describe("hello from JSX")}`);
      }), l(ht, "label", "snapshot"), l(ht, "onClick", async () => {
        const N = await v.snapshot();
        b(`snapshot() \u2192 value=${N.value} paused=${N.paused} ts=${N.timestamp}`);
      }), l(_t, "label", "bogus"), l(_t, "onClick", async () => {
        try {
          await v.totallyMadeUp(), b("bogus(): unexpectedly resolved");
        } catch (N) {
          b(`bogus() rejected: ${N.message}`);
        }
      }), l(dt, "label", "sub/unsub"), l(dt, "onClick", () => {
        if (I())
          I()(), S(() => null), b("unsubscribed from ticks$");
        else {
          const N = v.ticks$((X) => {
            b(`stream tick: ${X}`);
          });
          S(() => N), b("subscribed to ticks$ \u2014 wait for emissions\u2026");
        }
      }), l(Xe, "fontSize", 14), l(Xe, "color", "#FF333333"), m(oe, je), m(oe, ze), m(oe, Ke), l(oe, "background", 4294959234), l(oe, "gap", 6), l(oe, "padding", 10), l(je, "name", "multi-child A"), l(je, "color", "#FF6B4F00"), l(je, "fontSize", 14), l(ze, "name", "multi-child B"), l(ze, "color", "#FF6B4F00"), l(ze, "fontSize", 14), l(Ke, "name", "multi-child C"), l(Ke, "color", "#FF6B4F00"), l(Ke, "fontSize", 14), l(Ce, "background", "#FF1DA1F2"), l(Ce, "padding", 12), l(Ce, "cornerRadius", 8), Ae(Ce, () => `Count: ${e()}`), m(Je, vt), m(Je, Et), l(Je, "gap", 8), l(vt, "label", "Increment"), l(vt, "onClick", () => t(e() + 1)), l(Et, "label", "Decrement"), l(Et, "onClick", () => t(e() - 1)), l(St, "label", "+1000 (benchmark)"), l(St, "onClick", () => {
        const N = e(), X = performance.now();
        let z = 0, le = -1, sn = "";
        try {
          for (;z < 1000; z++)
            t(e() + 1);
        } catch (bt) {
          le = z, sn = bt && (bt.message || String(bt)) || "unknown";
        }
        const $r = (performance.now() - X).toFixed(3), on = e() - N;
        le >= 0 ? r(`crashed @${le}: ${sn} \xB7 delta=${on}`) : r(`+1000 ${$r}ms \xB7 iter=${z} delta=${on}`);
      }), Ae(A, n, wt), Ae(wt, qe($t, { each: Nr, children: (N) => (() => {
        var X = R("button");
        return l(X, "label", `${N}`), l(X, "onClick", () => {
          const z = performance.now();
          try {
            s(N), h(`set to ${N} in ${(performance.now() - z).toFixed(3)} ms`);
          } catch (le) {
            h(`ERROR @ ${N}: ${le && (le.message || String(le)) || "unknown"}`);
          }
        }), X;
      })() })), Ae(A, a, null), Ae(A, qe($t, { get each() {
        return c();
      }, children: (N) => qe(Dr, { get author() {
        return N.author;
      }, get body() {
        return N.body;
      }, get num() {
        return N.num;
      } }) }), null), Zt((N) => {
        var X = d(), z = _();
        return X !== N.e && (N.e = l(p, "label", X, N.e)), z !== N.t && (N.t = l(Xe, "label", z, N.t)), N;
      }, { e: undefined, t: undefined }), A;
    })();
  }
  mr(() => qe(Lr, {}), Ir);
})();
})
