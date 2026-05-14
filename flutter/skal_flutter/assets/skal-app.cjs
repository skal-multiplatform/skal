// @bun @bytecode @bun-cjs
(function(exports, require, module, __filename, __dirname) {// ../flutter/skal_flutter/assets/skal-app.js
(function() {
  var ae = { context: undefined, registry: undefined, effects: undefined, done: false, getContextId() {
    return Rt(this.context.count);
  }, getNextContextId() {
    return Rt(this.context.count++);
  } };
  function Rt(e) {
    const t = String(e), n = t.length - 1;
    return ae.context.id + (n ? String.fromCharCode(96 + n) : "") + t;
  }
  function yt(e) {
    ae.context = e;
  }
  function un() {
    return { ...ae.context, id: ae.getNextContextId(), count: 0 };
  }
  var cn = (e, t) => e === t, tt = Symbol("solid-proxy"), fn = typeof Proxy == "function", gn = Symbol("solid-track"), ke = { equals: cn }, mt = null, hn = Dt, Y = 1, be = 2, At = { owned: null, cleanups: null, context: null, owner: null }, N = null, g = null, Oe = null, ue = null, k = null, D = null, V = null, xe = 0;
  function De(e, t) {
    const n = k, r = N, s = e.length === 0, i = t === undefined ? r : t, a = s ? At : { owned: null, cleanups: null, context: i ? i.context : null, owner: i }, h = s ? e : () => e(() => ce(() => Q(a)));
    N = a, k = null;
    try {
      return K(h, true);
    } finally {
      k = n, N = r;
    }
  }
  function B(e, t) {
    t = t ? Object.assign({}, ke, t) : ke;
    const n = { value: e, observers: null, observerSlots: null, comparator: t.equals || undefined }, r = (s) => (typeof s == "function" && (g && g.running && g.sources.has(n) ? s = s(n.tValue) : s = s(n.value)), Nt(n, s));
    return [Ft.bind(n), r];
  }
  function J(e, t, n) {
    const r = xt(e, t, false, Y);
    Oe && g && g.running ? D.push(r) : $e(r);
  }
  function Le(e, t, n) {
    n = n ? Object.assign({}, ke, n) : ke;
    const r = xt(e, t, true, 0);
    return r.observers = null, r.observerSlots = null, r.comparator = n.equals || undefined, Oe && g && g.running ? (r.tState = Y, D.push(r)) : $e(r), Ft.bind(r);
  }
  function ce(e) {
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
  function Ct(e) {
    return N === null || (N.cleanups === null ? N.cleanups = [e] : N.cleanups.push(e)), e;
  }
  function _n(e) {
    if (g && g.running)
      return e(), g.done;
    const t = k, n = N;
    return Promise.resolve().then(() => {
      k = t, N = n;
      let r;
      return (Oe || dn) && (r = g || (g = { sources: new Set, effects: [], promises: new Set, disposed: new Set, queue: new Set, running: true }), r.done || (r.done = new Promise((s) => r.resolve = s)), r.running = true), K(e, false), k = N = null, r ? r.done : undefined;
    });
  }
  var [Br, It] = B(false), dn;
  function Ft() {
    const e = g && g.running;
    if (this.sources && (e ? this.tState : this.state))
      if ((e ? this.tState : this.state) === Y)
        $e(this);
      else {
        const t = D;
        D = null, K(() => Ve(this), false), D = t;
      }
    if (k) {
      const t = this.observers ? this.observers.length : 0;
      k.sources ? (k.sources.push(this), k.sourceSlots.push(t)) : (k.sources = [this], k.sourceSlots = [t]), this.observers ? (this.observers.push(k), this.observerSlots.push(k.sources.length - 1)) : (this.observers = [k], this.observerSlots = [k.sources.length - 1]);
    }
    return e && g.sources.has(this) ? this.tValue : this.value;
  }
  function Nt(e, t, n) {
    let r = g && g.running && g.sources.has(e) ? e.tValue : e.value;
    if (!e.comparator || !e.comparator(r, t)) {
      if (g) {
        const s = g.running;
        (s || !n && g.sources.has(e)) && (g.sources.add(e), e.tValue = t), s || (e.value = t);
      } else
        e.value = t;
      e.observers && e.observers.length && K(() => {
        for (let s = 0;s < e.observers.length; s += 1) {
          const i = e.observers[s], a = g && g.running;
          a && g.disposed.has(i) || ((a ? !i.tState : !i.state) && (i.pure ? D.push(i) : V.push(i), i.observers && Lt(i)), a ? i.tState = Y : i.state = Y);
        }
        if (D.length > 1e6)
          throw D = [], new Error;
      }, false);
    }
    return t;
  }
  function $e(e) {
    if (!e.fn)
      return;
    Q(e);
    const t = xe;
    kt(e, g && g.running && g.sources.has(e) ? e.tValue : e.value, t), g && !g.running && g.sources.has(e) && queueMicrotask(() => {
      K(() => {
        g && (g.running = true), k = N = e, kt(e, e.tValue, t), k = N = null;
      }, false);
    });
  }
  function kt(e, t, n) {
    let r;
    const s = N, i = k;
    k = N = e;
    try {
      r = e.fn(t);
    } catch (a) {
      return e.pure && (g && g.running ? (e.tState = Y, e.tOwned && e.tOwned.forEach(Q), e.tOwned = undefined) : (e.state = Y, e.owned && e.owned.forEach(Q), e.owned = null)), e.updatedAt = n + 1, rt(a);
    } finally {
      k = i, N = s;
    }
    (!e.updatedAt || e.updatedAt <= n) && (e.updatedAt != null && ("observers" in e) ? Nt(e, r, true) : g && g.running && e.pure ? (g.sources.has(e) || (e.value = r), g.sources.add(e), e.tValue = r) : e.value = r, e.updatedAt = n);
  }
  function xt(e, t, n, r = Y, s) {
    const i = { fn: e, state: r, updatedAt: null, owned: null, sources: null, sourceSlots: null, cleanups: null, value: t, owner: N, context: N ? N.context : null, pure: n };
    if (g && g.running && (i.state = 0, i.tState = r), N === null || N !== At && (g && g.running && N.pure ? N.tOwned ? N.tOwned.push(i) : N.tOwned = [i] : N.owned ? N.owned.push(i) : N.owned = [i]), ue && i.fn) {
      const a = i.fn, [h, v] = B(undefined, { equals: false }), b = ue.factory(a, v);
      Ct(() => b.dispose());
      let d;
      const _ = () => _n(v).then(() => {
        d && (d.dispose(), d = undefined);
      });
      i.fn = (S) => (h(), g && g.running ? (d || (d = ue.factory(a, _)), d.track(S)) : b.track(S));
    }
    return i;
  }
  function nt(e) {
    const t = g && g.running;
    if ((t ? e.tState : e.state) === 0)
      return;
    if ((t ? e.tState : e.state) === be)
      return Ve(e);
    if (e.suspense && ce(e.suspense.inFallback))
      return e.suspense.effects.push(e);
    const n = [e];
    for (;(e = e.owner) && (!e.updatedAt || e.updatedAt < xe); ) {
      if (t && g.disposed.has(e))
        return;
      (t ? e.tState : e.state) && n.push(e);
    }
    for (let r = n.length - 1;r >= 0; r--) {
      if (e = n[r], t) {
        let s = e, i = n[r + 1];
        for (;(s = s.owner) && s !== i; )
          if (g.disposed.has(s))
            return;
      }
      if ((t ? e.tState : e.state) === Y)
        $e(e);
      else if ((t ? e.tState : e.state) === be) {
        const s = D;
        D = null, K(() => Ve(e, n[0]), false), D = s;
      }
    }
  }
  function K(e, t) {
    if (D)
      return e();
    let n = false;
    t || (D = []), V ? n = true : V = [], xe++;
    try {
      const r = e();
      return vn(n), r;
    } catch (r) {
      n || (V = null), D = null, rt(r);
    }
  }
  function vn(e) {
    if (D && (Oe && g && g.running ? En(D) : Dt(D), D = null), e)
      return;
    let t;
    if (g) {
      if (!g.promises.size && !g.queue.size) {
        const { sources: r, disposed: s } = g;
        V.push.apply(V, g.effects), t = g.resolve;
        for (const i of V)
          "tState" in i && (i.state = i.tState), delete i.tState;
        g = null, K(() => {
          for (const i of s)
            Q(i);
          for (const i of r) {
            if (i.value = i.tValue, i.owned)
              for (let a = 0, h = i.owned.length;a < h; a++)
                Q(i.owned[a]);
            i.tOwned && (i.owned = i.tOwned), delete i.tValue, delete i.tOwned, i.tState = 0;
          }
          It(false);
        }, false);
      } else if (g.running) {
        g.running = false, g.effects.push.apply(g.effects, V), V = null, It(true);
        return;
      }
    }
    const n = V;
    V = null, n.length && K(() => hn(n), false), t && t();
  }
  function Dt(e) {
    for (let t = 0;t < e.length; t++)
      nt(e[t]);
  }
  function En(e) {
    for (let t = 0;t < e.length; t++) {
      const n = e[t], r = g.queue;
      r.has(n) || (r.add(n), Oe(() => {
        r.delete(n), K(() => {
          g.running = true, nt(n);
        }, false), g && (g.running = false);
      }));
    }
  }
  function Ve(e, t) {
    const n = g && g.running;
    n ? e.tState = 0 : e.state = 0;
    for (let r = 0;r < e.sources.length; r += 1) {
      const s = e.sources[r];
      if (s.sources) {
        const i = n ? s.tState : s.state;
        i === Y ? s !== t && (!s.updatedAt || s.updatedAt < xe) && nt(s) : i === be && Ve(s, t);
      }
    }
  }
  function Lt(e) {
    const t = g && g.running;
    for (let n = 0;n < e.observers.length; n += 1) {
      const r = e.observers[n];
      (t ? !r.tState : !r.state) && (t ? r.tState = be : r.state = be, r.pure ? D.push(r) : V.push(r), r.observers && Lt(r));
    }
  }
  function Q(e) {
    let t;
    if (e.sources)
      for (;e.sources.length; ) {
        const n = e.sources.pop(), r = e.sourceSlots.pop(), s = n.observers;
        if (s && s.length) {
          const i = s.pop(), a = n.observerSlots.pop();
          r < s.length && (i.sourceSlots[a] = r, s[r] = i, n.observerSlots[r] = a);
        }
      }
    if (e.tOwned) {
      for (t = e.tOwned.length - 1;t >= 0; t--)
        Q(e.tOwned[t]);
      delete e.tOwned;
    }
    if (g && g.running && e.pure)
      $t(e, true);
    else if (e.owned) {
      for (t = e.owned.length - 1;t >= 0; t--)
        Q(e.owned[t]);
      e.owned = null;
    }
    if (e.cleanups) {
      for (t = e.cleanups.length - 1;t >= 0; t--)
        e.cleanups[t]();
      e.cleanups = null;
    }
    g && g.running ? e.tState = 0 : e.state = 0;
  }
  function $t(e, t) {
    if (t || (e.tState = 0, g.disposed.add(e)), e.owned)
      for (let n = 0;n < e.owned.length; n++)
        $t(e.owned[n]);
  }
  function Sn(e) {
    return e instanceof Error ? e : new Error(typeof e == "string" ? e : "Unknown error", { cause: e });
  }
  function Vt(e, t, n) {
    try {
      for (const r of t)
        r(e);
    } catch (r) {
      rt(r, n && n.owner || null);
    }
  }
  function rt(e, t = N) {
    const n = mt && t && t.context && t.context[mt], r = Sn(e);
    if (!n)
      throw r;
    V ? V.push({ fn() {
      Vt(r, n, t);
    }, state: Y }) : Vt(r, n, t);
  }
  var wn = Symbol("fallback");
  function Bt(e) {
    for (let t = 0;t < e.length; t++)
      e[t]();
  }
  function bn(e, t, n = {}) {
    let r = [], s = [], i = [], a = 0, h = t.length > 1 ? [] : null;
    return Ct(() => Bt(i)), () => {
      let v = e() || [], b = v.length, d, _;
      return v[gn], ce(() => {
        let C, w, f, A, $, c, u, l, E;
        if (b === 0)
          a !== 0 && (Bt(i), i = [], r = [], s = [], a = 0, h && (h = [])), n.fallback && (r = [wn], s[0] = De((P) => (i[0] = P, n.fallback())), a = 1);
        else if (a === 0) {
          for (s = new Array(b), _ = 0;_ < b; _++)
            r[_] = v[_], s[_] = De(S);
          a = b;
        } else {
          for (f = new Array(b), A = new Array(b), h && ($ = new Array(b)), c = 0, u = Math.min(a, b);c < u && r[c] === v[c]; c++)
            ;
          for (u = a - 1, l = b - 1;u >= c && l >= c && r[u] === v[l]; u--, l--)
            f[l] = s[u], A[l] = i[u], h && ($[l] = h[u]);
          for (C = new Map, w = new Array(l + 1), _ = l;_ >= c; _--)
            E = v[_], d = C.get(E), w[_] = d === undefined ? -1 : d, C.set(E, _);
          for (d = c;d <= u; d++)
            E = r[d], _ = C.get(E), _ !== undefined && _ !== -1 ? (f[_] = s[d], A[_] = i[d], h && ($[_] = h[d]), _ = w[_], C.set(E, _)) : i[d]();
          for (_ = c;_ < b; _++)
            _ in f ? (s[_] = f[_], i[_] = A[_], h && (h[_] = $[_], h[_](_))) : s[_] = De(S);
          s = s.slice(0, a = b), r = v.slice(0);
        }
        return s;
      });
      function S(C) {
        if (i[_] = C, h) {
          const [w, f] = B(_);
          return h[_] = f, t(v[_], w);
        }
        return t(v[_]);
      }
    };
  }
  var On = false;
  function pn(e, t) {
    if (On && ae.context) {
      const n = ae.context;
      yt(un());
      const r = ce(() => e(t || {}));
      return yt(n), r;
    }
    return ce(() => e(t || {}));
  }
  function Be() {
    return true;
  }
  var Pn = { get(e, t, n) {
    return t === tt ? n : e.get(t);
  }, has(e, t) {
    return t === tt ? true : e.has(t);
  }, set: Be, deleteProperty: Be, getOwnPropertyDescriptor(e, t) {
    return { configurable: true, enumerable: true, get() {
      return e.get(t);
    }, set: Be, deleteProperty: Be };
  }, ownKeys(e) {
    return e.keys();
  } };
  function st(e) {
    return (e = typeof e == "function" ? e() : e) ? e : {};
  }
  function Tn() {
    for (let e = 0, t = this.length;e < t; ++e) {
      const n = this[e]();
      if (n !== undefined)
        return n;
    }
  }
  function Ht(...e) {
    let t = false;
    for (let a = 0;a < e.length; a++) {
      const h = e[a];
      t = t || !!h && tt in h, e[a] = typeof h == "function" ? (t = true, Le(h)) : h;
    }
    if (fn && t)
      return new Proxy({ get(a) {
        for (let h = e.length - 1;h >= 0; h--) {
          const v = st(e[h])[a];
          if (v !== undefined)
            return v;
        }
      }, has(a) {
        for (let h = e.length - 1;h >= 0; h--)
          if (a in st(e[h]))
            return true;
        return false;
      }, keys() {
        const a = [];
        for (let h = 0;h < e.length; h++)
          a.push(...Object.keys(st(e[h])));
        return [...new Set(a)];
      } }, Pn);
    const n = {}, r = Object.create(null);
    for (let a = e.length - 1;a >= 0; a--) {
      const h = e[a];
      if (!h)
        continue;
      const v = Object.getOwnPropertyNames(h);
      for (let b = v.length - 1;b >= 0; b--) {
        const d = v[b];
        if (d === "__proto__" || d === "constructor")
          continue;
        const _ = Object.getOwnPropertyDescriptor(h, d);
        if (!r[d])
          r[d] = _.get ? { enumerable: true, configurable: true, get: Tn.bind(n[d] = [_.get.bind(h)]) } : _.value !== undefined ? _ : undefined;
        else {
          const S = n[d];
          S && (_.get ? S.push(_.get.bind(h)) : _.value !== undefined && S.push(() => _.value));
        }
      }
    }
    const s = {}, i = Object.keys(r);
    for (let a = i.length - 1;a >= 0; a--) {
      const h = i[a], v = r[h];
      v && v.get ? Object.defineProperty(s, h, v) : s[h] = v ? v.value : undefined;
    }
    return s;
  }
  function Mt(e) {
    const t = "fallback" in e && { fallback: () => e.fallback };
    return Le(bn(() => e.each, e.children, t || undefined));
  }
  var Rn = (e) => Le(() => e());
  function yn({ createElement: e, createTextNode: t, isTextNode: n, replaceText: r, insertNode: s, removeNode: i, setProperty: a, getParentNode: h, getFirstChild: v, getNextSibling: b }) {
    function d(c, u, l, E) {
      if (l !== undefined && !E && (E = []), typeof u != "function")
        return _(c, u, E, l);
      J((P) => _(c, u(), P, l), E);
    }
    function _(c, u, l, E, P) {
      for (;typeof l == "function"; )
        l = l();
      if (u === l)
        return l;
      const R = typeof u, p = E !== undefined;
      if (R === "string" || R === "number")
        if (R === "number" && (u = u.toString()), p) {
          let O = l[0];
          O && n(O) ? r(O, u) : O = t(u), l = w(c, l, E, O);
        } else
          l !== "" && typeof l == "string" ? r(v(c), l = u) : (w(c, l, E, t(u)), l = u);
      else if (u == null || R === "boolean")
        l = w(c, l, E);
      else {
        if (R === "function")
          return J(() => {
            let O = u();
            for (;typeof O == "function"; )
              O = O();
            l = _(c, O, l, E);
          }), () => l;
        if (Array.isArray(u)) {
          const O = [];
          if (S(O, u, P))
            return J(() => l = _(c, O, l, E, true)), () => l;
          if (O.length === 0) {
            const L = w(c, l, E);
            if (p)
              return l = L;
          } else
            Array.isArray(l) ? l.length === 0 ? f(c, O, E) : C(c, l, O) : l == null || l === "" ? f(c, O) : C(c, p && l || [v(c)], O);
          l = O;
        } else {
          if (Array.isArray(l)) {
            if (p)
              return l = w(c, l, E, u);
            w(c, l, null, u);
          } else
            l == null || l === "" || !v(c) ? s(c, u) : A(c, u, v(c));
          l = u;
        }
      }
      return l;
    }
    function S(c, u, l) {
      let E = false;
      for (let P = 0, R = u.length;P < R; P++) {
        let p = u[P], O;
        if (!(p == null || p === true || p === false))
          if (Array.isArray(p))
            E = S(c, p) || E;
          else if ((O = typeof p) == "string" || O === "number")
            c.push(t(p));
          else if (O === "function")
            if (l) {
              for (;typeof p == "function"; )
                p = p();
              E = S(c, Array.isArray(p) ? p : [p]) || E;
            } else
              c.push(p), E = true;
          else
            c.push(p);
      }
      return E;
    }
    function C(c, u, l) {
      let E = l.length, P = u.length, R = E, p = 0, O = 0, L = b(u[P - 1]), q = null;
      for (;p < P || O < R; ) {
        if (u[p] === l[O]) {
          p++, O++;
          continue;
        }
        for (;u[P - 1] === l[R - 1]; )
          P--, R--;
        if (P === p) {
          const H = R < E ? O ? b(l[O - 1]) : l[R - O] : L;
          for (;O < R; )
            s(c, l[O++], H);
        } else if (R === O)
          for (;p < P; )
            (!q || !q.has(u[p])) && i(c, u[p]), p++;
        else if (u[p] === l[R - 1] && l[O] === u[P - 1]) {
          const H = b(u[--P]);
          s(c, l[O++], b(u[p++])), s(c, l[--R], H), u[P] = l[R];
        } else {
          if (!q) {
            q = new Map;
            let X = O;
            for (;X < R; )
              q.set(l[X], X++);
          }
          const H = q.get(u[p]);
          if (H != null)
            if (O < H && H < R) {
              let X = p, oe = 1, Se;
              for (;++X < P && X < R && !((Se = q.get(u[X])) == null || Se !== H + oe); )
                oe++;
              if (oe > H - O) {
                const Ie = u[p];
                for (;O < H; )
                  s(c, l[O++], Ie);
              } else
                A(c, l[O++], u[p++]);
            } else
              p++;
          else
            i(c, u[p++]);
        }
      }
    }
    function w(c, u, l, E) {
      if (l === undefined) {
        let R;
        for (;R = v(c); )
          i(c, R);
        return E && s(c, E), "";
      }
      const P = E || t("");
      if (u.length) {
        let R = false;
        for (let p = u.length - 1;p >= 0; p--) {
          const O = u[p];
          if (P !== O) {
            const L = h(O) === c;
            !R && !p ? L ? A(c, P, O) : s(c, P, l) : L && i(c, O);
          } else
            R = true;
        }
      } else
        s(c, P, l);
      return [P];
    }
    function f(c, u, l) {
      for (let E = 0, P = u.length;E < P; E++)
        s(c, u[E], l);
    }
    function A(c, u, l) {
      s(c, u, l), i(c, l);
    }
    function $(c, u, l = {}, E) {
      return u || (u = {}), E || J(() => l.children = _(c, u.children, l.children)), J(() => u.ref && u.ref(c)), J(() => {
        for (const P in u) {
          if (P === "children" || P === "ref")
            continue;
          const R = u[P];
          R !== l[P] && (a(c, P, R, l[P]), l[P] = R);
        }
      }), l;
    }
    return { render(c, u) {
      let l;
      return De((E) => {
        l = E, d(u, c());
      }), l;
    }, insert: d, spread(c, u, l) {
      typeof u == "function" ? J((E) => $(c, u(), E, l)) : $(c, u, undefined, l);
    }, createElement: e, createTextNode: t, insertNode: s, setProp(c, u, l, E) {
      return a(c, u, l, E), l;
    }, mergeProps: Ht, effect: J, memo: Rn, createComponent: pn, use(c, u, l) {
      return ce(() => c(u, l));
    } };
  }
  function mn(e) {
    const t = yn(e);
    return t.mergeProps = Ht, t;
  }
  var Ut = 6 * 1024 * 1024, An = 64, Hr = An, Gt = 4 * 1024 * 1024, fe = 64 + Gt, it = 768 * 1024, ot = fe + it, Cn = 256 * 1024, lt = ot + Cn, Wt = fe + it, In = 0, Fn = 8, Nn = 12, kn = 16, xn = 24, Dn = 28, Ln = 32, $n = Fn >> 2, Vn = Nn >> 2, Bn = xn >> 2, Yt = Dn >> 2, Hn = In >> 3, Mn = kn >> 3, Un = Ln >> 3, Mr = 1, Ur = 2, Gr = 3, Wr = 4, Yr = 16, qr = 17, Xr = 20, jr = 21, zr = 22, Kr = 23, Jr = 24, Qr = 25, Zr = 26, es = 27, ts = 28, ns = 29, rs = 30, ss = 31, is = 32, os = 33, ls = 34, as = 35, us = 36, cs = 37, fs = 0, gs = 1, hs = 2, _s = 3, ds = 4, vs = 5, Es = 6, Ss = 7, ws = 1, bs = 3, Os = 4, ps = 5, Ps = 6, Ts = 7, Rs = 0, ys = 1, ms = 2, As = 3, Cs = 4, Is = 5, Fs = 6, Ns = 0, ks = 1, xs = 2, Ds = 3, Ls = 4, $s = 5, Vs = 6, Bs = 7, Hs = 8, Ms = 9, Us = 32, Gs = 33, Ws = 34, Ys = 35, qs = 36, Xs = 37, js = 64, zs = 65, Ks = 66, Js = 67, Qs = 68, Zs = 69, ei = 70, ti = 96, ni = 97, ri = 128, si = 129, ii = 130, oi = 131, li = 160, ai = 161, ui = 162, ci = -1, Gn = 2147483646, Wn = 2147483645, te = globalThis.__skal_acquireBridge();
  if (!te || te.byteLength !== Ut)
    throw new Error(`Skal: bridge buffer not available (got ${te && te.byteLength})`);
  var qt = new Uint8Array(te), M = new Uint32Array(te), at = new BigInt64Array(te), Yn = new TextEncoder, pe = 16, qn = 64 + Gt >> 2, Xn = 16384, jn = qn - 4, He = 0n, Z = pe, ge = fe, Me = pe;
  function ut() {
    M[$n] = Z - pe << 2, M[Vn] = ge - fe, He += 1n, Atomics.store(at, Hn, He), Me = Z;
  }
  function Xt() {
    ut();
    const e = He, t = performance.now() + 5000;
    for (;!(Atomics.load(at, Un) >= e); )
      if (performance.now() > t) {
        console.warn("Skal: drain spin timeout \u2014 UI thread slow; ring will overwrite");
        break;
      }
    Z = pe, ge = fe, Me = pe;
  }
  function I(e, t, n, r) {
    let s = Z;
    s >= jn && (Xt(), s = Z), M[s] = e >>> 0, M[s + 1] = t >>> 0, M[s + 2] = n >>> 0, M[s + 3] = r >>> 0, Z = s + 4, Z - Me >= Xn && ut();
  }
  var ne = 0, re = 0;
  function he(e) {
    ge + e.length * 3 > Wt && Xt();
    const t = ge - fe, n = qt.subarray(ge, Wt), { read: r, written: s } = Yn.encodeInto(e, n);
    if (r !== e.length)
      throw new Error(`Skal: string too large for heap (${e.length} code units > ${it} bytes)`);
    ge += s, ne = t, re = s;
  }
  function ct(e, t) {
    he(t), I(20, e, ne, re);
  }
  var ft = false;
  function zn() {
    ft = false, Z !== Me && ut();
  }
  function x() {
    ft || (ft = true, queueMicrotask(zn));
  }
  var z = 1024, y = new Int8Array(256);
  y.fill(-1), y[0] = 0, y[1] = 1, y[2] = 2, y[3] = 3, y[4] = 4, y[5] = 5, y[6] = 6, y[7] = 7, y[8] = 8, y[9] = 9, y[32] = 10, y[33] = 11, y[34] = 12, y[35] = 13, y[36] = 14, y[37] = 15, y[64] = 16, y[65] = 17, y[66] = 18, y[67] = 19, y[68] = 20, y[69] = 21, y[70] = 22, y[96] = 23, y[97] = 24, y[128] = 25, y[129] = 26, y[130] = 27, y[131] = 28, y[160] = 29, y[161] = 30, y[162] = 31;
  var U = 32, Ue = new Int32Array(z * U), Pe = new Float32Array(z * U), Ge = new Array(z * U), Te = new Uint8Array(z * U), _e = 6, de = new Float32Array(z * _e);
  de.fill(NaN);
  var We = new Map, jt = [], Kn = 0;
  function Jn() {
    const e = z * 2, t = z * U, n = e * U, r = z * _e, s = e * _e, i = new Int32Array(n);
    i.set(Ue), Ue = i;
    const a = new Uint8Array(n);
    a.set(Te), Te = a;
    const h = new Float32Array(n);
    h.set(Pe), h.fill(NaN, t), Pe = h;
    const v = new Float32Array(s);
    v.set(de), v.fill(NaN, r), de = v, Ge.length = n, z = e;
  }
  function Ye(e) {
    let t = We.get(e);
    if (t === undefined) {
      t = jt.pop(), t === undefined && (t = Kn++), t >= z && Jn(), We.set(e, t);
      const n = t * U;
      Te.fill(0, n, n + U), Pe.fill(NaN, n, n + U);
      for (let r = n;r < n + U; r++)
        Ge[r] = undefined;
    }
    return t;
  }
  function Qn(e) {
    const t = We.get(e);
    if (t !== undefined) {
      We.delete(e), jt.push(t);
      const n = t * _e;
      de.fill(NaN, n, n + _e);
    }
  }
  var Re = 0, ye = 0, ve = new Float32Array(1), me = new Uint32Array(ve.buffer);
  function qe(e, t, n) {
    const r = y[t];
    if (r < 0)
      return;
    const s = Ye(e) * U + r, i = n | 0;
    if (Te[s] !== 0 && Ue[s] === i) {
      ye++;
      return;
    }
    Ue[s] = i, Te[s] = 1, I(16, e, t, i), Re++;
  }
  function Zn(e, t, n) {
    const r = y[t];
    if (r < 0)
      return;
    const s = Ye(e) * U + r;
    if (Pe[s] === n) {
      ye++;
      return;
    }
    Pe[s] = n, ve[0] = n, I(17, e, t, me[0]), Re++;
  }
  function er(e, t, n) {
    const r = y[t];
    if (r < 0)
      return;
    const s = Ye(e) * U + r;
    if (Ge[s] === n) {
      ye++;
      return;
    }
    Ge[s] = n, he(n == null ? "" : String(n)), I(22, e, (t & 255) << 24 | ne & 16777215, re), Re++;
  }
  function Ee(e, t, n, r) {
    const s = Ye(e) * _e + n;
    if (de[s] === r) {
      ye++;
      return;
    }
    de[s] = r, ve[0] = r, I(t, e, 0, me[0]), Re++;
  }
  function tr(e, t) {
    Ee(e, 32, 0, t);
  }
  function nr(e, t) {
    Ee(e, 33, 1, t);
  }
  function rr(e, t) {
    Ee(e, 34, 2, t);
  }
  function sr(e, t) {
    Ee(e, 35, 3, t);
  }
  function ir(e, t) {
    Ee(e, 36, 4, t);
  }
  function or(e, t) {
    Ee(e, 37, 5, t);
  }
  var zt = new Map;
  function lr(e) {
    let t = 2166136261;
    for (let n = 0;n < e.length; n++)
      t ^= e.charCodeAt(n), t = Math.imul(t, 16777619) >>> 0;
    return t;
  }
  function se(e) {
    let t = zt.get(e);
    return t !== undefined || (t = lr(e), he(e), I(23, t, ne, re), zt.set(e, t)), t;
  }
  function ar(e, t) {
    I(4, e, se(t), 0);
  }
  function Kt(e, t, n) {
    I(24, e, se(t), n >>> 0);
  }
  function Jt(e, t, n) {
    const r = se(t);
    ve[0] = n, I(25, e, r, me[0]);
  }
  function ur(e, t, n) {
    const r = se(t);
    he(n == null ? "" : String(n));
    const s = ne & 16777215, i = re & 255;
    I(26, e, r, s << 8 | i);
  }
  function cr(e, t, n) {
    I(27, e, se(t), n);
  }
  var Ae = new Map, ee = new Map, Qt = 1;
  function fr(e, t, n) {
    const r = se(t), s = Qt++;
    for (let i = 0;i < n.length; i++) {
      const a = n[i];
      if (typeof a == "number")
        Number.isInteger(a) ? I(29, s, 1, a | 0) : (ve[0] = a, I(29, s, 2, me[0]));
      else if (typeof a == "boolean")
        I(29, s, 3, a ? 1 : 0);
      else if (typeof a == "string") {
        he(a);
        const h = ne & 16777215, v = re & 255;
        I(29, s, 4, h << 8 | v);
      } else
        I(29, s, 0, 0);
    }
    return I(28, e, r, s), x(), new Promise((i, a) => {
      Ae.set(s, { resolve: i, reject: a });
    });
  }
  function gr(e, t, n, r, s) {
    const i = se(t), a = Qt++;
    for (let h = 0;h < n.length; h++) {
      const v = n[h];
      if (typeof v == "number")
        Number.isInteger(v) ? I(29, a, 1, v | 0) : (ve[0] = v, I(29, a, 2, me[0]));
      else if (typeof v == "boolean")
        I(29, a, 3, v ? 1 : 0);
      else if (typeof v == "string") {
        he(v);
        const b = ne & 16777215, d = re & 255;
        I(29, a, 4, b << 8 | d);
      } else
        I(29, a, 0, 0);
    }
    return I(30, e, i, a), x(), ee.set(a, { onValue: r, onError: s && s.onError, onDone: s && s.onDone }), function() {
      ee.has(a) && (ee.delete(a), I(31, a, 0, 0), x());
    };
  }
  var gt = new Map, hr = 1;
  function Zt(e) {
    const t = hr++;
    return gt.set(t, e), t;
  }
  function _r(e, t, n) {
    I(21, e, t, n);
  }
  var ht = 0n, ie = null, en = Ut - lt, _t = lt >> 2, dr = lt + en >> 2, vr = en / 16 | 0, tn = new ArrayBuffer(4), Er = new Float32Array(tn), Sr = new Uint32Array(tn), wr = new TextDecoder("utf-8");
  function dt(e, t) {
    return t === 0 ? "" : wr.decode(qt.subarray(ot + e, ot + e + t));
  }
  globalThis.__skal_drainEvents = function() {
    const e = Atomics.load(at, Mn);
    if (e === ht)
      return;
    const t = _t + (M[Bn] >> 2);
    let n = _t + (M[Yt] >> 2);
    const r = dr, s = _t;
    let i = vr;
    for (;n !== t && i-- > 0; ) {
      const a = M[n + 0], h = a & 255, v = a >>> 8 & 255, b = M[n + 1], d = M[n + 2], _ = M[n + 3];
      let S, C = false;
      if (v === 1)
        S = d | 0, C = true;
      else if (v === 2)
        Sr[0] = d, S = Er[0], C = true;
      else if (v === 3)
        S = d !== 0, C = true;
      else if (v === 4)
        S = dt(_, d), C = true;
      else if (v === 5) {
        const w = dt(_, d);
        try {
          S = JSON.parse(w);
        } catch {
          S = w;
        }
        C = true;
      } else if (v === 6) {
        const w = dt(_, d);
        try {
          S = JSON.parse(w);
        } catch {
          S = [];
        }
        C = true;
      }
      if (h === 3) {
        const w = Ae.get(b);
        if (w) {
          Ae.delete(b);
          try {
            w.resolve(C ? S : undefined);
          } catch (f) {
            ie = f && (f.stack || f.message || String(f)) || "unknown";
          }
        }
      } else if (h === 4) {
        const w = Ae.get(b);
        if (w) {
          Ae.delete(b);
          try {
            const f = typeof S == "string" ? S : `skal RPC error (status ${S})`;
            w.reject(new Error(f));
          } catch (f) {
            ie = f && (f.stack || f.message || String(f)) || "unknown";
          }
        }
      } else if (h === 5) {
        const w = ee.get(b);
        if (w)
          try {
            w.onValue(C ? S : undefined);
          } catch (f) {
            ie = f && (f.stack || f.message || String(f)) || "unknown";
          }
      } else if (h === 6) {
        const w = ee.get(b);
        if (w) {
          ee.delete(b);
          try {
            w.onDone && w.onDone();
          } catch (f) {
            ie = f && (f.stack || f.message || String(f)) || "unknown";
          }
        }
      } else if (h === 7) {
        const w = ee.get(b);
        if (w) {
          ee.delete(b);
          try {
            w.onError && w.onError(new Error(typeof S == "string" ? S : "skal stream error"));
          } catch (f) {
            ie = f && (f.stack || f.message || String(f)) || "unknown";
          }
        }
      } else {
        const w = gt.get(b);
        if (w)
          try {
            C ? v === 6 && Array.isArray(S) ? w(...S) : w(S) : w();
          } catch (f) {
            ie = f && (f.stack || f.message || String(f)) || "unknown";
          }
      }
      n += 4, n >= r && (n = s);
    }
    M[Yt] = n - s << 2, ht = e;
  }, globalThis.skalStatus = () => JSON.stringify({ handlerCount: gt.size, opSeq: Number(He), lastEventSeq: Number(ht), lastHandlerError: ie, propWrites: Re, propSkips: ye });
  var fi = 1, br = 2;
  function nn() {
    return br++;
  }
  var Or = { box: 0, column: 1, scrollView: 5, listView: 6, reorderableListView: 7, row: 2, text: 3, button: 4 }, pr = { padding: [0, "u32"], paddingTop: [1, "u32"], paddingRight: [2, "u32"], paddingBottom: [3, "u32"], paddingLeft: [4, "u32"], width: [5, "dim"], height: [6, "dim"], weight: [7, "f32"], alignment: [8, "u32"], gap: [9, "u32"], background: [32, "color"], color: [33, "color"], cornerRadius: [34, "u32"], borderWidth: [35, "u32"], borderColor: [36, "color"], shadow: [37, "u32"], fontSize: [64, "u32"], fontWeight: [65, "u32"], fontFamily: [66, "u32"], textAlign: [67, "u32"], lineHeight: [68, "u32"], maxLines: [69, "u32"], textOverflow: [70, "u32"], src: [96, "str"], contentScale: [97, "u32"], placeholder: [128, "str"], value: [129, "str"], keyboardType: [130, "u32"], secureEntry: [131, "u32"], enabled: [160, "u32"], focusable: [161, "u32"], visible: [162, "u32"] }, Pr = { opacity: tr, translationX: nr, translationY: rr, scaleX: sr, scaleY: ir, rotation: or };
  function Tr(e) {
    if (typeof e == "number")
      return e | 0;
    if (typeof e != "string")
      return 0;
    let t = e.trim();
    t.startsWith("#") && (t = t.slice(1));
    let n = 0, r = 0, s = 0, i = 255;
    return t.length === 3 ? (n = parseInt(t[0] + t[0], 16), r = parseInt(t[1] + t[1], 16), s = parseInt(t[2] + t[2], 16)) : t.length === 4 ? (n = parseInt(t[0] + t[0], 16), r = parseInt(t[1] + t[1], 16), s = parseInt(t[2] + t[2], 16), i = parseInt(t[3] + t[3], 16)) : t.length === 6 ? (n = parseInt(t.slice(0, 2), 16), r = parseInt(t.slice(2, 4), 16), s = parseInt(t.slice(4, 6), 16)) : t.length === 8 && (i = parseInt(t.slice(0, 2), 16), n = parseInt(t.slice(2, 4), 16), r = parseInt(t.slice(4, 6), 16), s = parseInt(t.slice(6, 8), 16)), (i & 255) << 24 | (n & 255) << 16 | (r & 255) << 8 | s & 255 | 0;
  }
  function Rr(e) {
    return typeof e == "number" ? e | 0 : e === "fill" ? Gn : e === "wrap" ? Wn : -1;
  }
  function yr(e, t, n) {
    if (n == null)
      return;
    if (t === "ref" && n && typeof n.__skalBind == "function") {
      n.__skalBind(e.id);
      return;
    }
    const r = typeof n;
    if (r === "function") {
      const s = Zt(n);
      cr(e.id, t, s), x();
      return;
    }
    if (r === "number") {
      Number.isInteger(n) && n >= 0 && n <= 4294967295 && Kt(e.id, t, n | 0), Jt(e.id, t, n), x();
      return;
    }
    if (r === "string") {
      ur(e.id, t, n), x();
      return;
    }
    if (r === "boolean") {
      Kt(e.id, t, n ? 1 : 0), x();
      return;
    }
  }
  function mr(e) {
    const t = [e];
    for (;t.length > 0; ) {
      const n = t.pop();
      Qn(n.id);
      let r = n.firstChild;
      for (;r; )
        t.push(r), r = r.nextSibling;
    }
  }
  var Xe = class {
    constructor(e, t, n = false, r = false) {
      this.tag = e, this.id = t, this.isText = n, this.isCustom = r, this.parent = null, this.firstChild = null, this.lastChild = null, this.nextSibling = null, this.prevSibling = null, this.text = "";
    }
  }, Ar = mn({ createElement(e) {
    const t = nn(), n = Or[e];
    return n !== undefined ? (I(1, t, n, 0), x(), new Xe(e, t, false, false)) : (ar(t, e), x(), new Xe(e, t, false, true));
  }, createTextNode(e) {
    const t = nn();
    I(1, t, 3, 0);
    const n = e == null ? "" : String(e);
    n.length > 0 && ct(t, n), x();
    const r = new Xe("#text", t, true);
    return r.text = n, r;
  }, replaceText(e, t) {
    const n = t == null ? "" : String(t);
    e.text !== n && (e.text = n, ct(e.id, n), x());
  }, setProperty(e, t, n, r) {
    if (e.isCustom) {
      yr(e, t, n);
      return;
    }
    if (t === "onClick" || t === "onclick") {
      if (typeof n == "function") {
        const a = Zt(n);
        _r(e.id, 1, a), x();
      }
      return;
    }
    if (t === "label" && (e.tag === "button" || e.tag === "text")) {
      const a = n == null ? "" : String(n);
      ct(e.id, a), x();
      return;
    }
    const s = Pr[t];
    if (s !== undefined) {
      typeof n == "number" && (s(e.id, n), x());
      return;
    }
    const i = pr[t];
    if (i !== undefined) {
      const [a, h] = i;
      if (n == null)
        return;
      switch (h) {
        case "u32":
          typeof n == "number" ? (qe(e.id, a, n | 0), x()) : typeof n == "boolean" && (qe(e.id, a, n ? 1 : 0), x());
          return;
        case "f32":
          typeof n == "number" && (Zn(e.id, a, n), x());
          return;
        case "str":
          er(e.id, a, String(n)), x();
          return;
        case "color":
          qe(e.id, a, Tr(n)), x();
          return;
        case "dim":
          qe(e.id, a, Rr(n)), x();
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
    I(3, e.id, t.id, r), x(), t.parent = e, n ? (t.nextSibling = n, t.prevSibling = n.prevSibling, n.prevSibling ? n.prevSibling.nextSibling = t : e.firstChild = t, n.prevSibling = t) : (t.prevSibling = e.lastChild, t.nextSibling = null, e.lastChild ? e.lastChild.nextSibling = t : e.firstChild = t, e.lastChild = t);
  }, removeNode(e, t) {
    I(2, t.id, 0, 0), mr(t), x(), t.prevSibling ? t.prevSibling.nextSibling = t.nextSibling : e.firstChild = t.nextSibling, t.nextSibling ? t.nextSibling.prevSibling = t.prevSibling : e.lastChild = t.prevSibling, t.parent = null, t.prevSibling = null, t.nextSibling = null;
  }, isTextNode(e) {
    return e.isText;
  }, getParentNode(e) {
    return e.parent;
  }, getFirstChild(e) {
    return e.firstChild;
  }, getNextSibling(e) {
    return e.nextSibling;
  } }), { render: Cr, effect: rn, memo: gi, createComponent: je, createElement: T, createTextNode: hi, insertNode: m, insert: Ce, spread: _i, setProp: o, mergeProps: di, use: Ir } = Ar;
  I(1, 1, 0, 0), x();
  var Fr = new Xe("box", 1, false);
  function Nr() {
    let e = 0;
    const t = function() {};
    return t.__skalBind = (n) => {
      e = n;
    }, new Proxy(t, { apply(n, r, s) {
      const i = s[0];
      i && typeof i.id == "number" && (e = i.id);
    }, get(n, r) {
      if (r === "__skalBind" || typeof r == "symbol")
        return t[r];
      if (typeof r == "string" && r.endsWith("$") && r.length > 1) {
        const s = r.slice(0, -1);
        return (...i) => {
          if (e === 0)
            throw new Error(`skal ref: cannot call .${String(r)}() before the host mounts. Move the call into a JSX event handler.`);
          const a = i[i.length - 1];
          if (typeof a != "function")
            throw new TypeError(`skal ref: .${String(r)}() requires a callback as its last argument (got ${typeof a})`);
          const h = i.slice(0, -1);
          return gr(e, s, h, a);
        };
      }
      return (...s) => e === 0 ? Promise.reject(new Error(`skal ref: cannot call .${String(r)}() before the host mounts. Move the call into a JSX event handler.`)) : fr(e, r, s);
    } });
  }
  var sn = ["Just shipped a new feature, feeling great about how it turned out \uD83D\uDE80", "Hot take: the best APIs are the ones you don't have to read docs for", "Spent the morning refactoring legacy code \u2014 so much cleaner now", "There's no such thing as 'just a small change' in production code", "If your tests are slow, that's a smell. Fast tests = good tests", "Bun's startup time keeps surprising me, even after a year", "Why is naming things still the hardest part of programming?", "Found a 10\xD7 speedup in a critical path today. Profilers, not guesses", "Reading 'The Art of Unix Programming' for the third time", "Premature abstraction is somehow worse than premature optimization", "Latency is a feature, throughput is an artifact of how you measure", "Half of debugging is admitting your assumption was wrong", "You don't ship the codebase you have. You ship the codebase you understand", "Cache invalidation, naming things, off-by-one. The classics", "Every config file format eventually grows a turing-complete templating layer"], kr = Array.from({ length: 15000 }, (e, t) => ({ author: `@user${t * 2654435761 >>> 17}`, body: sn[t % sn.length], num: t + 1 })), xr = [50, 200, 500, 1000, 2000, 5000, 1e4], on = "#FFF1F5F9", ln = "#FF475569", Dr = "#FF22C55E", Lr = "#FFEF4444", an = "#FFFFFFFF";
  function $r(e) {
    const [t, n] = B(0), [r, s] = B(false), [i, a] = B(0), [h, v] = B(false);
    return (() => {
      var b = T("column"), d = T("text"), _ = T("text"), S = T("row"), C = T("button"), w = T("button");
      return m(b, d), m(b, _), m(b, S), o(b, "background", "#FFFFFFFF"), o(b, "padding", 12), o(b, "cornerRadius", 10), o(b, "borderWidth", 1), o(b, "borderColor", "#FFE5E5EA"), o(b, "gap", 6), o(d, "fontWeight", 700), o(d, "fontSize", 14), o(d, "color", "#FF1DA1F2"), o(_, "fontSize", 14), o(_, "color", "#FF1F2937"), o(_, "maxLines", 3), o(_, "textOverflow", 1), m(S, C), m(S, w), o(S, "gap", 10), o(C, "fontSize", 12), o(C, "padding", 6), o(C, "cornerRadius", 16), o(C, "onClick", () => {
        const f = !r();
        s(f), n(t() + (f ? 1 : -1));
      }), o(w, "fontSize", 12), o(w, "padding", 6), o(w, "cornerRadius", 16), o(w, "onClick", () => {
        const f = !h();
        v(f), a(i() + (f ? 1 : -1));
      }), rn((f) => {
        var A = `#${e.num} \xB7 ${e.author}`, $ = e.body, c = `\u2665 ${t()}`, u = r() ? Dr : on, l = r() ? an : ln, E = `\u21A9 ${i()}`, P = h() ? Lr : on, R = h() ? an : ln;
        return A !== f.e && (f.e = o(d, "label", A, f.e)), $ !== f.t && (f.t = o(_, "label", $, f.t)), c !== f.a && (f.a = o(C, "label", c, f.a)), u !== f.o && (f.o = o(C, "background", u, f.o)), l !== f.i && (f.i = o(C, "color", l, f.i)), E !== f.n && (f.n = o(w, "label", E, f.n)), P !== f.s && (f.s = o(w, "background", P, f.s)), R !== f.h && (f.h = o(w, "color", R, f.h)), f;
      }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined, n: undefined, s: undefined, h: undefined }), b;
    })();
  }
  function Vr() {
    const [e, t] = B(0), [n, r] = B("tap +1000 to benchmark fast-path"), [s, i] = B(50), [a, h] = B(""), [v, b] = B("\u2014 waiting for counter events \u2014"), d = Nr(), [_, S] = B("\u2014 tap a button to RPC the Ticker \u2014"), [C, w] = B(null), f = Le(() => kr.slice(0, s()));
    return (() => {
      var A = T("listView"), $ = T("greeting"), c = T("shimmerFromColors"), u = T("greeting"), l = T("qrImageView"), E = T("box"), P = T("camera"), R = T("counter"), p = T("text"), O = T("ticker"), L = T("row"), q = T("button"), H = T("button"), X = T("button"), oe = T("button"), Se = T("button"), Ie = T("button"), vt = T("button"), Et = T("button"), St = T("button"), wt = T("button"), ze = T("text"), le = T("stickers"), Ke = T("greeting"), Je = T("greeting"), Qe = T("greeting"), Fe = T("box"), Ze = T("row"), bt = T("button"), Ot = T("button"), pt = T("button"), Pt = T("row");
      return m(A, $), m(A, c), m(A, l), m(A, E), m(A, R), m(A, p), m(A, O), m(A, L), m(A, ze), m(A, le), m(A, Fe), m(A, Ze), m(A, pt), m(A, Pt), o(A, "background", "#FFFAFAFA"), o(A, "padding", 16), o(A, "gap", 12), o($, "name", "Skal"), o($, "color", "#FF1DA1F2"), o($, "fontSize", 20), m(c, u), o(c, "baseColor", 4290624957), o(c, "highlightColor", 4292927712), o(c, "period", 1500), o(u, "name", "loading\u2026"), o(u, "color", "#FF333333"), o(u, "fontSize", 28), o(l, "data", "https://skal.dev"), o(l, "size", 200), m(E, P), o(E, "background", "#FF000000"), o(E, "padding", 4), o(E, "cornerRadius", 8), o(P, "resolutionIndex", 1), o(R, "initial", 0), o(R, "onChanged", (F) => b(`onChanged(${F})`)), o(R, "onReset", () => b("onReset()")), o(p, "fontSize", 14), o(p, "color", "#FF333333"), Ir(d, O), o(O, "intervalMs", 500), m(L, q), m(L, H), m(L, X), m(L, oe), m(L, Se), m(L, Ie), m(L, vt), m(L, Et), m(L, St), m(L, wt), o(L, "gap", 6), o(q, "label", "pause"), o(q, "onClick", async () => {
        await d.pause(), S("pause() \u2713");
      }), o(H, "label", "resume"), o(H, "onClick", async () => {
        await d.resume(), S("resume() \u2713");
      }), o(X, "label", "reset"), o(X, "onClick", async () => {
        await d.reset(), S("reset() \u2713");
      }), o(oe, "label", "+10"), o(oe, "onClick", async () => {
        await d.bump(10), S(`bump(10), now getValue() \u2192 ${await d.getValue()}`);
      }), o(Se, "label", "read"), o(Se, "onClick", async () => {
        S(`getValue() \u2192 ${await d.getValue()}, isPaused() \u2192 ${await d.isPaused()}`);
      }), o(Ie, "label", "describe"), o(Ie, "onClick", async () => {
        S(`describe() \u2192 ${await d.describe("hello from JSX")}`);
      }), o(vt, "label", "snapshot"), o(vt, "onClick", async () => {
        const F = await d.snapshot();
        S(`snapshot() \u2192 value=${F.value} paused=${F.paused} ts=${F.timestamp}`);
      }), o(Et, "label", "bogus"), o(Et, "onClick", async () => {
        try {
          await d.totallyMadeUp(), S("bogus(): unexpectedly resolved");
        } catch (F) {
          S(`bogus() rejected: ${F.message}`);
        }
      }), o(St, "label", "stress 1000"), o(St, "onClick", async () => {
        const G = performance.now(), W = [];
        for (let we = 0;we < 1000; we++)
          W.push(d.getValue());
        const j = await Promise.all(W), Ne = (performance.now() - G).toFixed(2), Tt = Math.min(...j), et = Math.max(...j);
        S(`1000 RPCs in ${Ne}ms \xB7 resolved=${j.length}/1000 \xB7 min=${Tt} max=${et} \xB7 ${(Ne / 1000 * 1000).toFixed(0)}\xB5s/call`);
      }), o(wt, "label", "sub/unsub"), o(wt, "onClick", () => {
        if (C())
          C()(), w(() => null), S("unsubscribed from ticks$");
        else {
          const F = d.ticks$((G) => {
            S(`stream tick: ${G}`);
          });
          w(() => F), S("subscribed to ticks$ \u2014 wait for emissions\u2026");
        }
      }), o(ze, "fontSize", 14), o(ze, "color", "#FF333333"), m(le, Ke), m(le, Je), m(le, Qe), o(le, "background", 4294959234), o(le, "gap", 6), o(le, "padding", 10), o(Ke, "name", "multi-child A"), o(Ke, "color", "#FF6B4F00"), o(Ke, "fontSize", 14), o(Je, "name", "multi-child B"), o(Je, "color", "#FF6B4F00"), o(Je, "fontSize", 14), o(Qe, "name", "multi-child C"), o(Qe, "color", "#FF6B4F00"), o(Qe, "fontSize", 14), o(Fe, "background", "#FF1DA1F2"), o(Fe, "padding", 12), o(Fe, "cornerRadius", 8), Ce(Fe, () => `Count: ${e()}`), m(Ze, bt), m(Ze, Ot), o(Ze, "gap", 8), o(bt, "label", "Increment"), o(bt, "onClick", () => t(e() + 1)), o(Ot, "label", "Decrement"), o(Ot, "onClick", () => t(e() - 1)), o(pt, "label", "+1000 (benchmark)"), o(pt, "onClick", () => {
        const F = e(), G = performance.now();
        let W = 0, j = -1, Ne = "";
        try {
          for (;W < 1000; W++)
            t(e() + 1);
        } catch (we) {
          j = W, Ne = we && (we.message || String(we)) || "unknown";
        }
        const Tt = (performance.now() - G).toFixed(3), et = e() - F;
        j >= 0 ? r(`crashed @${j}: ${Ne} \xB7 delta=${et}`) : r(`+1000 ${Tt}ms \xB7 iter=${W} delta=${et}`);
      }), Ce(A, n, Pt), Ce(Pt, je(Mt, { each: xr, children: (F) => (() => {
        var G = T("button");
        return o(G, "label", `${F}`), o(G, "onClick", () => {
          const W = performance.now();
          try {
            i(F), h(`set to ${F} in ${(performance.now() - W).toFixed(3)} ms`);
          } catch (j) {
            h(`ERROR @ ${F}: ${j && (j.message || String(j)) || "unknown"}`);
          }
        }), G;
      })() })), Ce(A, a, null), Ce(A, je(Mt, { get each() {
        return f();
      }, children: (F) => je($r, { get author() {
        return F.author;
      }, get body() {
        return F.body;
      }, get num() {
        return F.num;
      } }) }), null), rn((F) => {
        var G = v(), W = _();
        return G !== F.e && (F.e = o(p, "label", G, F.e)), W !== F.t && (F.t = o(ze, "label", W, F.t)), F;
      }, { e: undefined, t: undefined }), A;
    })();
  }
  Cr(() => je(Vr, {}), Fr);
})();
})
