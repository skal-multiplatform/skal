// @bun @bytecode @bun-cjs
(function(exports, require, module, __filename, __dirname) {// ../android-app/app/src/main/assets/skal-app.js
(function() {
  var K = { context: undefined, registry: undefined, effects: undefined, done: false, getContextId() {
    return Vt(this.context.count);
  }, getNextContextId() {
    return Vt(this.context.count++);
  } };
  function Vt(t) {
    const e = String(t), n = e.length - 1;
    return K.context.id + (n ? String.fromCharCode(96 + n) : "") + e;
  }
  function Ut(t) {
    K.context = t;
  }
  function pe() {
    return { ...K.context, id: K.getNextContextId(), count: 0 };
  }
  var we = (t, e) => t === e, wt = Symbol("solid-proxy"), Pe = typeof Proxy == "function", be = Symbol("solid-track"), ot = { equals: we }, Mt = null, Te = zt, k = 1, et = 2, $t = { owned: null, cleanups: null, context: null, owner: null }, T = null, u = null, nt = null, Z = null, R = null, C = null, N = null, at = 0;
  function ut(t, e) {
    const n = R, r = T, i = t.length === 0, l = e === undefined ? r : e, f = i ? $t : { owned: null, cleanups: null, context: l ? l.context : null, owner: l }, h = i ? t : () => t(() => z(() => $(f)));
    T = f, R = null;
    try {
      return U(h, true);
    } finally {
      R = n, T = r;
    }
  }
  function D(t, e) {
    e = e ? Object.assign({}, ot, e) : ot;
    const n = { value: t, observers: null, observerSlots: null, comparator: e.equals || undefined }, r = (i) => (typeof i == "function" && (u && u.running && u.sources.has(n) ? i = i(n.tValue) : i = i(n.value)), jt(n, i));
    return [qt.bind(n), r];
  }
  function M(t, e, n) {
    const r = Zt(t, e, false, k);
    nt && u && u.running ? C.push(r) : ct(r);
  }
  function ft(t, e, n) {
    n = n ? Object.assign({}, ot, n) : ot;
    const r = Zt(t, e, true, 0);
    return r.observers = null, r.observerSlots = null, r.comparator = n.equals || undefined, nt && u && u.running ? (r.tState = k, C.push(r)) : ct(r), qt.bind(r);
  }
  function z(t) {
    if (!Z && R === null)
      return t();
    const e = R;
    R = null;
    try {
      return Z ? Z.untrack(t) : t();
    } finally {
      R = e;
    }
  }
  function Yt(t) {
    return T === null || (T.cleanups === null ? T.cleanups = [t] : T.cleanups.push(t)), t;
  }
  function Re(t) {
    if (u && u.running)
      return t(), u.done;
    const e = R, n = T;
    return Promise.resolve().then(() => {
      R = e, T = n;
      let r;
      return (nt || ye) && (r = u || (u = { sources: new Set, effects: [], promises: new Set, disposed: new Set, queue: new Set, running: true }), r.done || (r.done = new Promise((i) => r.resolve = i)), r.running = true), U(t, false), R = T = null, r ? r.done : undefined;
    });
  }
  var [Wn, Xt] = D(false), ye;
  function qt() {
    const t = u && u.running;
    if (this.sources && (t ? this.tState : this.state))
      if ((t ? this.tState : this.state) === k)
        ct(this);
      else {
        const e = C;
        C = null, U(() => ht(this), false), C = e;
      }
    if (R) {
      const e = this.observers ? this.observers.length : 0;
      R.sources ? (R.sources.push(this), R.sourceSlots.push(e)) : (R.sources = [this], R.sourceSlots = [e]), this.observers ? (this.observers.push(R), this.observerSlots.push(R.sources.length - 1)) : (this.observers = [R], this.observerSlots = [R.sources.length - 1]);
    }
    return t && u.sources.has(this) ? this.tValue : this.value;
  }
  function jt(t, e, n) {
    let r = u && u.running && u.sources.has(t) ? t.tValue : t.value;
    if (!t.comparator || !t.comparator(r, e)) {
      if (u) {
        const i = u.running;
        (i || !n && u.sources.has(t)) && (u.sources.add(t), t.tValue = e), i || (t.value = e);
      } else
        t.value = e;
      t.observers && t.observers.length && U(() => {
        for (let i = 0;i < t.observers.length; i += 1) {
          const l = t.observers[i], f = u && u.running;
          f && u.disposed.has(l) || ((f ? !l.tState : !l.state) && (l.pure ? C.push(l) : N.push(l), l.observers && Qt(l)), f ? l.tState = k : l.state = k);
        }
        if (C.length > 1e6)
          throw C = [], new Error;
      }, false);
    }
    return e;
  }
  function ct(t) {
    if (!t.fn)
      return;
    $(t);
    const e = at;
    Kt(t, u && u.running && u.sources.has(t) ? t.tValue : t.value, e), u && !u.running && u.sources.has(t) && queueMicrotask(() => {
      U(() => {
        u && (u.running = true), R = T = t, Kt(t, t.tValue, e), R = T = null;
      }, false);
    });
  }
  function Kt(t, e, n) {
    let r;
    const i = T, l = R;
    R = T = t;
    try {
      r = t.fn(e);
    } catch (f) {
      return t.pure && (u && u.running ? (t.tState = k, t.tOwned && t.tOwned.forEach($), t.tOwned = undefined) : (t.state = k, t.owned && t.owned.forEach($), t.owned = null)), t.updatedAt = n + 1, bt(f);
    } finally {
      R = l, T = i;
    }
    (!t.updatedAt || t.updatedAt <= n) && (t.updatedAt != null && ("observers" in t) ? jt(t, r, true) : u && u.running && t.pure ? (u.sources.has(t) || (t.value = r), u.sources.add(t), t.tValue = r) : t.value = r, t.updatedAt = n);
  }
  function Zt(t, e, n, r = k, i) {
    const l = { fn: t, state: r, updatedAt: null, owned: null, sources: null, sourceSlots: null, cleanups: null, value: e, owner: T, context: T ? T.context : null, pure: n };
    if (u && u.running && (l.state = 0, l.tState = r), T === null || T !== $t && (u && u.running && T.pure ? T.tOwned ? T.tOwned.push(l) : T.tOwned = [l] : T.owned ? T.owned.push(l) : T.owned = [l]), Z && l.fn) {
      const f = l.fn, [h, w] = D(undefined, { equals: false }), v = Z.factory(f, w);
      Yt(() => v.dispose());
      let p;
      const c = () => Re(w).then(() => {
        p && (p.dispose(), p = undefined);
      });
      l.fn = (I) => (h(), u && u.running ? (p || (p = Z.factory(f, c)), p.track(I)) : v.track(I));
    }
    return l;
  }
  function Pt(t) {
    const e = u && u.running;
    if ((e ? t.tState : t.state) === 0)
      return;
    if ((e ? t.tState : t.state) === et)
      return ht(t);
    if (t.suspense && z(t.suspense.inFallback))
      return t.suspense.effects.push(t);
    const n = [t];
    for (;(t = t.owner) && (!t.updatedAt || t.updatedAt < at); ) {
      if (e && u.disposed.has(t))
        return;
      (e ? t.tState : t.state) && n.push(t);
    }
    for (let r = n.length - 1;r >= 0; r--) {
      if (t = n[r], e) {
        let i = t, l = n[r + 1];
        for (;(i = i.owner) && i !== l; )
          if (u.disposed.has(i))
            return;
      }
      if ((e ? t.tState : t.state) === k)
        ct(t);
      else if ((e ? t.tState : t.state) === et) {
        const i = C;
        C = null, U(() => ht(t, n[0]), false), C = i;
      }
    }
  }
  function U(t, e) {
    if (C)
      return t();
    let n = false;
    e || (C = []), N ? n = true : N = [], at++;
    try {
      const r = t();
      return Ae(n), r;
    } catch (r) {
      n || (N = null), C = null, bt(r);
    }
  }
  function Ae(t) {
    if (C && (nt && u && u.running ? Ie(C) : zt(C), C = null), t)
      return;
    let e;
    if (u) {
      if (!u.promises.size && !u.queue.size) {
        const { sources: r, disposed: i } = u;
        N.push.apply(N, u.effects), e = u.resolve;
        for (const l of N)
          "tState" in l && (l.state = l.tState), delete l.tState;
        u = null, U(() => {
          for (const l of i)
            $(l);
          for (const l of r) {
            if (l.value = l.tValue, l.owned)
              for (let f = 0, h = l.owned.length;f < h; f++)
                $(l.owned[f]);
            l.tOwned && (l.owned = l.tOwned), delete l.tValue, delete l.tOwned, l.tState = 0;
          }
          Xt(false);
        }, false);
      } else if (u.running) {
        u.running = false, u.effects.push.apply(u.effects, N), N = null, Xt(true);
        return;
      }
    }
    const n = N;
    N = null, n.length && U(() => Te(n), false), e && e();
  }
  function zt(t) {
    for (let e = 0;e < t.length; e++)
      Pt(t[e]);
  }
  function Ie(t) {
    for (let e = 0;e < t.length; e++) {
      const n = t[e], r = u.queue;
      r.has(n) || (r.add(n), nt(() => {
        r.delete(n), U(() => {
          u.running = true, Pt(n);
        }, false), u && (u.running = false);
      }));
    }
  }
  function ht(t, e) {
    const n = u && u.running;
    n ? t.tState = 0 : t.state = 0;
    for (let r = 0;r < t.sources.length; r += 1) {
      const i = t.sources[r];
      if (i.sources) {
        const l = n ? i.tState : i.state;
        l === k ? i !== e && (!i.updatedAt || i.updatedAt < at) && Pt(i) : l === et && ht(i, e);
      }
    }
  }
  function Qt(t) {
    const e = u && u.running;
    for (let n = 0;n < t.observers.length; n += 1) {
      const r = t.observers[n];
      (e ? !r.tState : !r.state) && (e ? r.tState = et : r.state = et, r.pure ? C.push(r) : N.push(r), r.observers && Qt(r));
    }
  }
  function $(t) {
    let e;
    if (t.sources)
      for (;t.sources.length; ) {
        const n = t.sources.pop(), r = t.sourceSlots.pop(), i = n.observers;
        if (i && i.length) {
          const l = i.pop(), f = n.observerSlots.pop();
          r < i.length && (l.sourceSlots[f] = r, i[r] = l, n.observerSlots[r] = f);
        }
      }
    if (t.tOwned) {
      for (e = t.tOwned.length - 1;e >= 0; e--)
        $(t.tOwned[e]);
      delete t.tOwned;
    }
    if (u && u.running && t.pure)
      Jt(t, true);
    else if (t.owned) {
      for (e = t.owned.length - 1;e >= 0; e--)
        $(t.owned[e]);
      t.owned = null;
    }
    if (t.cleanups) {
      for (e = t.cleanups.length - 1;e >= 0; e--)
        t.cleanups[e]();
      t.cleanups = null;
    }
    u && u.running ? t.tState = 0 : t.state = 0;
  }
  function Jt(t, e) {
    if (e || (t.tState = 0, u.disposed.add(t)), t.owned)
      for (let n = 0;n < t.owned.length; n++)
        Jt(t.owned[n]);
  }
  function me(t) {
    return t instanceof Error ? t : new Error(typeof t == "string" ? t : "Unknown error", { cause: t });
  }
  function te(t, e, n) {
    try {
      for (const r of e)
        r(t);
    } catch (r) {
      bt(r, n && n.owner || null);
    }
  }
  function bt(t, e = T) {
    const n = Mt && e && e.context && e.context[Mt], r = me(t);
    if (!n)
      throw r;
    N ? N.push({ fn() {
      te(r, n, e);
    }, state: k }) : te(r, n, e);
  }
  var Ce = Symbol("fallback");
  function ee(t) {
    for (let e = 0;e < t.length; e++)
      t[e]();
  }
  function Fe(t, e, n = {}) {
    let r = [], i = [], l = [], f = 0, h = e.length > 1 ? [] : null;
    return Yt(() => ee(l)), () => {
      let w = t() || [], v = w.length, p, c;
      return w[be], z(() => {
        let A, y, _, m, F, a, o, s, g;
        if (v === 0)
          f !== 0 && (ee(l), l = [], r = [], i = [], f = 0, h && (h = [])), n.fallback && (r = [Ce], i[0] = ut((S) => (l[0] = S, n.fallback())), f = 1);
        else if (f === 0) {
          for (i = new Array(v), c = 0;c < v; c++)
            r[c] = w[c], i[c] = ut(I);
          f = v;
        } else {
          for (_ = new Array(v), m = new Array(v), h && (F = new Array(v)), a = 0, o = Math.min(f, v);a < o && r[a] === w[a]; a++)
            ;
          for (o = f - 1, s = v - 1;o >= a && s >= a && r[o] === w[s]; o--, s--)
            _[s] = i[o], m[s] = l[o], h && (F[s] = h[o]);
          for (A = new Map, y = new Array(s + 1), c = s;c >= a; c--)
            g = w[c], p = A.get(g), y[c] = p === undefined ? -1 : p, A.set(g, c);
          for (p = a;p <= o; p++)
            g = r[p], c = A.get(g), c !== undefined && c !== -1 ? (_[c] = i[p], m[c] = l[p], h && (F[c] = h[p]), c = y[c], A.set(g, c)) : l[p]();
          for (c = a;c < v; c++)
            c in _ ? (i[c] = _[c], l[c] = m[c], h && (h[c] = F[c], h[c](c))) : i[c] = ut(I);
          i = i.slice(0, f = v), r = w.slice(0);
        }
        return i;
      });
      function I(A) {
        if (l[c] = A, h) {
          const [y, _] = D(c);
          return h[c] = _, e(w[c], y);
        }
        return e(w[c]);
      }
    };
  }
  var xe = false;
  function Ne(t, e) {
    if (xe && K.context) {
      const n = K.context;
      Ut(pe());
      const r = z(() => t(e || {}));
      return Ut(n), r;
    }
    return z(() => t(e || {}));
  }
  function gt() {
    return true;
  }
  var Le = { get(t, e, n) {
    return e === wt ? n : t.get(e);
  }, has(t, e) {
    return e === wt ? true : t.has(e);
  }, set: gt, deleteProperty: gt, getOwnPropertyDescriptor(t, e) {
    return { configurable: true, enumerable: true, get() {
      return t.get(e);
    }, set: gt, deleteProperty: gt };
  }, ownKeys(t) {
    return t.keys();
  } };
  function Tt(t) {
    return (t = typeof t == "function" ? t() : t) ? t : {};
  }
  function ke() {
    for (let t = 0, e = this.length;t < e; ++t) {
      const n = this[t]();
      if (n !== undefined)
        return n;
    }
  }
  function ne(...t) {
    let e = false;
    for (let f = 0;f < t.length; f++) {
      const h = t[f];
      e = e || !!h && wt in h, t[f] = typeof h == "function" ? (e = true, ft(h)) : h;
    }
    if (Pe && e)
      return new Proxy({ get(f) {
        for (let h = t.length - 1;h >= 0; h--) {
          const w = Tt(t[h])[f];
          if (w !== undefined)
            return w;
        }
      }, has(f) {
        for (let h = t.length - 1;h >= 0; h--)
          if (f in Tt(t[h]))
            return true;
        return false;
      }, keys() {
        const f = [];
        for (let h = 0;h < t.length; h++)
          f.push(...Object.keys(Tt(t[h])));
        return [...new Set(f)];
      } }, Le);
    const n = {}, r = Object.create(null);
    for (let f = t.length - 1;f >= 0; f--) {
      const h = t[f];
      if (!h)
        continue;
      const w = Object.getOwnPropertyNames(h);
      for (let v = w.length - 1;v >= 0; v--) {
        const p = w[v];
        if (p === "__proto__" || p === "constructor")
          continue;
        const c = Object.getOwnPropertyDescriptor(h, p);
        if (!r[p])
          r[p] = c.get ? { enumerable: true, configurable: true, get: ke.bind(n[p] = [c.get.bind(h)]) } : c.value !== undefined ? c : undefined;
        else {
          const I = n[p];
          I && (c.get ? I.push(c.get.bind(h)) : c.value !== undefined && I.push(() => c.value));
        }
      }
    }
    const i = {}, l = Object.keys(r);
    for (let f = l.length - 1;f >= 0; f--) {
      const h = l[f], w = r[h];
      w && w.get ? Object.defineProperty(i, h, w) : i[h] = w ? w.value : undefined;
    }
    return i;
  }
  function re(t) {
    const e = "fallback" in t && { fallback: () => t.fallback };
    return ft(Fe(() => t.each, t.children, e || undefined));
  }
  var De = (t) => ft(() => t());
  function He({ createElement: t, createTextNode: e, isTextNode: n, replaceText: r, insertNode: i, removeNode: l, setProperty: f, getParentNode: h, getFirstChild: w, getNextSibling: v }) {
    function p(a, o, s, g) {
      if (s !== undefined && !g && (g = []), typeof o != "function")
        return c(a, o, g, s);
      M((S) => c(a, o(), S, s), g);
    }
    function c(a, o, s, g, S) {
      for (;typeof s == "function"; )
        s = s();
      if (o === s)
        return s;
      const P = typeof o, O = g !== undefined;
      if (P === "string" || P === "number")
        if (P === "number" && (o = o.toString()), O) {
          let d = s[0];
          d && n(d) ? r(d, o) : d = e(o), s = y(a, s, g, d);
        } else
          s !== "" && typeof s == "string" ? r(w(a), s = o) : (y(a, s, g, e(o)), s = o);
      else if (o == null || P === "boolean")
        s = y(a, s, g);
      else {
        if (P === "function")
          return M(() => {
            let d = o();
            for (;typeof d == "function"; )
              d = d();
            s = c(a, d, s, g);
          }), () => s;
        if (Array.isArray(o)) {
          const d = [];
          if (I(d, o, S))
            return M(() => s = c(a, d, s, g, true)), () => s;
          if (d.length === 0) {
            const tt = y(a, s, g);
            if (O)
              return s = tt;
          } else
            Array.isArray(s) ? s.length === 0 ? _(a, d, g) : A(a, s, d) : s == null || s === "" ? _(a, d) : A(a, O && s || [w(a)], d);
          s = d;
        } else {
          if (Array.isArray(s)) {
            if (O)
              return s = y(a, s, g, o);
            y(a, s, null, o);
          } else
            s == null || s === "" || !w(a) ? i(a, o) : m(a, o, w(a));
          s = o;
        }
      }
      return s;
    }
    function I(a, o, s) {
      let g = false;
      for (let S = 0, P = o.length;S < P; S++) {
        let O = o[S], d;
        if (!(O == null || O === true || O === false))
          if (Array.isArray(O))
            g = I(a, O) || g;
          else if ((d = typeof O) == "string" || d === "number")
            a.push(e(O));
          else if (d === "function")
            if (s) {
              for (;typeof O == "function"; )
                O = O();
              g = I(a, Array.isArray(O) ? O : [O]) || g;
            } else
              a.push(O), g = true;
          else
            a.push(O);
      }
      return g;
    }
    function A(a, o, s) {
      let g = s.length, S = o.length, P = g, O = 0, d = 0, tt = v(o[S - 1]), q = null;
      for (;O < S || d < P; ) {
        if (o[O] === s[d]) {
          O++, d++;
          continue;
        }
        for (;o[S - 1] === s[P - 1]; )
          S--, P--;
        if (S === O) {
          const V = P < g ? d ? v(s[d - 1]) : s[P - d] : tt;
          for (;d < P; )
            i(a, s[d++], V);
        } else if (P === d)
          for (;O < S; )
            (!q || !q.has(o[O])) && l(a, o[O]), O++;
        else if (o[O] === s[P - 1] && s[d] === o[S - 1]) {
          const V = v(o[--S]);
          i(a, s[d++], v(o[O++])), i(a, s[--P], V), o[S] = s[P];
        } else {
          if (!q) {
            q = new Map;
            let j = d;
            for (;j < P; )
              q.set(s[j], j++);
          }
          const V = q.get(o[O]);
          if (V != null)
            if (d < V && V < P) {
              let j = O, Wt = 1, Oe;
              for (;++j < S && j < P && !((Oe = q.get(o[j])) == null || Oe !== V + Wt); )
                Wt++;
              if (Wt > V - d) {
                const Gn = o[O];
                for (;d < V; )
                  i(a, s[d++], Gn);
              } else
                m(a, s[d++], o[O++]);
            } else
              O++;
          else
            l(a, o[O++]);
        }
      }
    }
    function y(a, o, s, g) {
      if (s === undefined) {
        let P;
        for (;P = w(a); )
          l(a, P);
        return g && i(a, g), "";
      }
      const S = g || e("");
      if (o.length) {
        let P = false;
        for (let O = o.length - 1;O >= 0; O--) {
          const d = o[O];
          if (S !== d) {
            const tt = h(d) === a;
            !P && !O ? tt ? m(a, S, d) : i(a, S, s) : tt && l(a, d);
          } else
            P = true;
        }
      } else
        i(a, S, s);
      return [S];
    }
    function _(a, o, s) {
      for (let g = 0, S = o.length;g < S; g++)
        i(a, o[g], s);
    }
    function m(a, o, s) {
      i(a, o, s), l(a, s);
    }
    function F(a, o, s = {}, g) {
      return o || (o = {}), g || M(() => s.children = c(a, o.children, s.children)), M(() => o.ref && o.ref(a)), M(() => {
        for (const S in o) {
          if (S === "children" || S === "ref")
            continue;
          const P = o[S];
          P !== s[S] && (f(a, S, P, s[S]), s[S] = P);
        }
      }), s;
    }
    return { render(a, o) {
      let s;
      return ut((g) => {
        s = g, p(o, a());
      }), s;
    }, insert: p, spread(a, o, s) {
      typeof o == "function" ? M((g) => F(a, o(), g, s)) : F(a, o, undefined, s);
    }, createElement: t, createTextNode: e, insertNode: i, setProp(a, o, s, g) {
      return f(a, o, s, g), s;
    }, mergeProps: ne, effect: M, memo: De, createComponent: Ne, use(a, o, s) {
      return z(() => a(o, s));
    } };
  }
  function Be(t) {
    const e = He(t);
    return e.mergeProps = ne, e;
  }
  var Ge = 2 * 1024 * 1024, We = 64, Vn = We, ie = 1024 * 1024, Q = 64 + ie, se = 512 * 1024, Rt = Q + se, Ve = Q + se, Ue = 0, Me = 8, $e = 12, Ye = 16, Xe = 24, qe = 28, je = Me >> 2, Ke = $e >> 2, Ze = Xe >> 2, le = qe >> 2, ze = Ue >> 3, Qe = Ye >> 3, Un = 1, Mn = 2, $n = 3, Yn = 16, Xn = 17, qn = 20, jn = 21, Kn = 22, Zn = 32, zn = 33, Qn = 34, Jn = 35, tr = 36, er = 37, nr = 0, rr = 1, ir = 2, sr = 3, lr = 4, or = 5, ar = 1, ur = 0, fr = 1, cr = 2, hr = 3, gr = 4, vr = 5, _r = 6, dr = 7, Er = 8, Sr = 9, Or = 32, pr = 33, wr = 34, Pr = 35, br = 36, Tr = 37, Rr = 64, yr = 65, Ar = 66, Ir = 67, mr = 68, Cr = 69, Fr = 70, xr = 96, Nr = 97, Lr = 128, kr = 129, Dr = 130, Hr = 131, Br = 160, Gr = 161, Wr = 162, Vr = -1, Je = 2147483646, tn = 2147483645, Y = globalThis.__skal_acquireBridge();
  if (!Y || Y.byteLength !== Ge)
    throw new Error(`Skal: bridge buffer not available (got ${Y && Y.byteLength})`);
  var en = new Uint8Array(Y), W = new Uint32Array(Y), oe = new BigInt64Array(Y), nn = new TextEncoder, yt = 16, rn = 64 + ie >> 2, At = 0n, vt = yt, rt = Q;
  function sn() {
    vt = yt, rt = Q;
  }
  function H(t, e, n, r) {
    const i = vt;
    if (i + 4 > rn)
      throw new Error("Skal: op ring overflow");
    W[i] = t >>> 0, W[i + 1] = e >>> 0, W[i + 2] = n >>> 0, W[i + 3] = r >>> 0, vt = i + 4;
  }
  var It = 0, mt = 0;
  function ae(t) {
    const e = rt - Q, n = en.subarray(rt, Ve), { read: r, written: i } = nn.encodeInto(t, n);
    if (r !== t.length)
      throw new Error(`Skal: string heap full (need ${t.length} code units, fit ${r})`);
    rt += i, It = e, mt = i;
  }
  function Ct(t, e) {
    ae(e), H(20, t, It, mt);
  }
  var Ft = false;
  function ln() {
    Ft = false, W[je] = vt - yt << 2, W[Ke] = rt - Q, At += 1n, Atomics.store(oe, ze, At), sn();
  }
  function x() {
    Ft || (Ft = true, queueMicrotask(ln));
  }
  var X = 8192, b = new Int8Array(256);
  b.fill(-1), b[0] = 0, b[1] = 1, b[2] = 2, b[3] = 3, b[4] = 4, b[5] = 5, b[6] = 6, b[7] = 7, b[8] = 8, b[9] = 9, b[32] = 10, b[33] = 11, b[34] = 12, b[35] = 13, b[36] = 14, b[37] = 15, b[64] = 16, b[65] = 17, b[66] = 18, b[67] = 19, b[68] = 20, b[69] = 21, b[70] = 22, b[96] = 23, b[97] = 24, b[128] = 25, b[129] = 26, b[130] = 27, b[131] = 28, b[160] = 29, b[161] = 30, b[162] = 31;
  var B = 32, ue = new Int32Array(X * B), xt = new Float32Array(X * B), Nt = new Array(X * B), Lt = new Uint8Array(X * B), _t = 6, dt = new Float32Array(X * _t);
  dt.fill(NaN);
  var Et = new Map, fe = [], on = 0;
  function St(t) {
    let e = Et.get(t);
    if (e === undefined) {
      if (e = fe.pop(), e === undefined && (e = on++), e >= X)
        throw new Error(`Skal: diff cache exhausted (>${X} active nodes)`);
      Et.set(t, e);
      const n = e * B;
      Lt.fill(0, n, n + B), xt.fill(NaN, n, n + B);
      for (let r = n;r < n + B; r++)
        Nt[r] = undefined;
    }
    return e;
  }
  function an(t) {
    const e = Et.get(t);
    if (e !== undefined) {
      Et.delete(t), fe.push(e);
      const n = e * _t;
      dt.fill(NaN, n, n + _t);
    }
  }
  var it = 0, st = 0, kt = new Float32Array(1), ce = new Uint32Array(kt.buffer);
  function Ot(t, e, n) {
    const r = b[e];
    if (r < 0)
      return;
    const i = St(t) * B + r, l = n | 0;
    if (Lt[i] !== 0 && ue[i] === l) {
      st++;
      return;
    }
    ue[i] = l, Lt[i] = 1, H(16, t, e, l), it++;
  }
  function un(t, e, n) {
    const r = b[e];
    if (r < 0)
      return;
    const i = St(t) * B + r;
    if (xt[i] === n) {
      st++;
      return;
    }
    xt[i] = n, kt[0] = n, H(17, t, e, ce[0]), it++;
  }
  function fn(t, e, n) {
    const r = b[e];
    if (r < 0)
      return;
    const i = St(t) * B + r;
    if (Nt[i] === n) {
      st++;
      return;
    }
    Nt[i] = n, ae(n == null ? "" : String(n)), H(22, t, (e & 255) << 24 | It & 16777215, mt), it++;
  }
  function J(t, e, n, r) {
    const i = St(t) * _t + n;
    if (dt[i] === r) {
      st++;
      return;
    }
    dt[i] = r, kt[0] = r, H(e, t, 0, ce[0]), it++;
  }
  function cn(t, e) {
    J(t, 32, 0, e);
  }
  function hn(t, e) {
    J(t, 33, 1, e);
  }
  function gn(t, e) {
    J(t, 34, 2, e);
  }
  function vn(t, e) {
    J(t, 35, 3, e);
  }
  function _n(t, e) {
    J(t, 36, 4, e);
  }
  function dn(t, e) {
    J(t, 37, 5, e);
  }
  var Dt = new Map, En = 1;
  function Sn(t) {
    const e = En++;
    return Dt.set(e, t), e;
  }
  function On(t, e, n) {
    H(21, t, e, n);
  }
  var Ht = 0n, he = null, ge = 2 * 1024 * 1024 - Rt, Bt = Rt >> 2, pn = Rt + ge >> 2, wn = ge / 16 | 0;
  globalThis.__skal_drainEvents = function() {
    const t = Atomics.load(oe, Qe);
    if (t === Ht)
      return;
    const e = Bt + (W[Ze] >> 2);
    let n = Bt + (W[le] >> 2);
    const r = pn, i = Bt;
    let l = wn;
    for (;n !== e && l-- > 0; ) {
      const f = W[n + 1], h = Dt.get(f);
      if (h)
        try {
          h();
        } catch (w) {
          he = w && (w.stack || w.message || String(w)) || "unknown";
        }
      n += 4, n >= r && (n = i);
    }
    W[le] = n - i << 2, Ht = t;
  }, globalThis.skalStatus = () => JSON.stringify({ handlerCount: Dt.size, opSeq: Number(At), lastEventSeq: Number(Ht), lastHandlerError: he, propWrites: it, propSkips: st });
  var Ur = 1, Pn = 2;
  function ve() {
    return Pn++;
  }
  var bn = { box: 0, column: 1, scrollColumn: 5, row: 2, text: 3, button: 4 }, Tn = { padding: [0, "u32"], paddingTop: [1, "u32"], paddingRight: [2, "u32"], paddingBottom: [3, "u32"], paddingLeft: [4, "u32"], width: [5, "dim"], height: [6, "dim"], weight: [7, "f32"], alignment: [8, "u32"], gap: [9, "u32"], background: [32, "color"], color: [33, "color"], cornerRadius: [34, "u32"], borderWidth: [35, "u32"], borderColor: [36, "color"], shadow: [37, "u32"], fontSize: [64, "u32"], fontWeight: [65, "u32"], fontFamily: [66, "u32"], textAlign: [67, "u32"], lineHeight: [68, "u32"], maxLines: [69, "u32"], textOverflow: [70, "u32"], src: [96, "str"], contentScale: [97, "u32"], placeholder: [128, "str"], value: [129, "str"], keyboardType: [130, "u32"], secureEntry: [131, "u32"], enabled: [160, "u32"], focusable: [161, "u32"], visible: [162, "u32"] }, Rn = { opacity: cn, translationX: hn, translationY: gn, scaleX: vn, scaleY: _n, rotation: dn };
  function yn(t) {
    if (typeof t == "number")
      return t | 0;
    if (typeof t != "string")
      return 0;
    let e = t.trim();
    e.startsWith("#") && (e = e.slice(1));
    let n = 0, r = 0, i = 0, l = 255;
    return e.length === 3 ? (n = parseInt(e[0] + e[0], 16), r = parseInt(e[1] + e[1], 16), i = parseInt(e[2] + e[2], 16)) : e.length === 4 ? (n = parseInt(e[0] + e[0], 16), r = parseInt(e[1] + e[1], 16), i = parseInt(e[2] + e[2], 16), l = parseInt(e[3] + e[3], 16)) : e.length === 6 ? (n = parseInt(e.slice(0, 2), 16), r = parseInt(e.slice(2, 4), 16), i = parseInt(e.slice(4, 6), 16)) : e.length === 8 && (l = parseInt(e.slice(0, 2), 16), n = parseInt(e.slice(2, 4), 16), r = parseInt(e.slice(4, 6), 16), i = parseInt(e.slice(6, 8), 16)), (l & 255) << 24 | (n & 255) << 16 | (r & 255) << 8 | i & 255 | 0;
  }
  function An(t) {
    return typeof t == "number" ? t | 0 : t === "fill" ? Je : t === "wrap" ? tn : -1;
  }
  function In(t) {
    const e = [t];
    for (;e.length > 0; ) {
      const n = e.pop();
      an(n.id);
      let r = n.firstChild;
      for (;r; )
        e.push(r), r = r.nextSibling;
    }
  }
  var Gt = class {
    constructor(t, e, n = false) {
      this.tag = t, this.id = e, this.isText = n, this.parent = null, this.firstChild = null, this.lastChild = null, this.nextSibling = null, this.prevSibling = null, this.text = "";
    }
  }, mn = Be({ createElement(t) {
    const e = bn[t];
    if (e === undefined)
      throw new Error(`Skal: unknown JSX tag <${t}>`);
    const n = ve();
    return H(1, n, e, 0), x(), new Gt(t, n, false);
  }, createTextNode(t) {
    const e = ve();
    H(1, e, 3, 0);
    const n = t == null ? "" : String(t);
    n.length > 0 && Ct(e, n), x();
    const r = new Gt("#text", e, true);
    return r.text = n, r;
  }, replaceText(t, e) {
    const n = e == null ? "" : String(e);
    t.text !== n && (t.text = n, Ct(t.id, n), x());
  }, setProperty(t, e, n, r) {
    if (e === "onClick" || e === "onclick") {
      if (typeof n == "function") {
        const f = Sn(n);
        On(t.id, 1, f), x();
      }
      return;
    }
    if (e === "label" && (t.tag === "button" || t.tag === "text")) {
      const f = n == null ? "" : String(n);
      Ct(t.id, f), x();
      return;
    }
    const i = Rn[e];
    if (i !== undefined) {
      typeof n == "number" && (i(t.id, n), x());
      return;
    }
    const l = Tn[e];
    if (l !== undefined) {
      const [f, h] = l;
      if (n == null)
        return;
      switch (h) {
        case "u32":
          typeof n == "number" ? (Ot(t.id, f, n | 0), x()) : typeof n == "boolean" && (Ot(t.id, f, n ? 1 : 0), x());
          return;
        case "f32":
          typeof n == "number" && (un(t.id, f, n), x());
          return;
        case "str":
          fn(t.id, f, String(n)), x();
          return;
        case "color":
          Ot(t.id, f, yn(n)), x();
          return;
        case "dim":
          Ot(t.id, f, An(n)), x();
          return;
      }
      return;
    }
    if (e === "style" && n && typeof n == "object") {
      for (const f in n)
        this.setProperty(t, f, n[f]);
      return;
    }
  }, insertNode(t, e, n) {
    const r = n ? n.id : 0;
    H(3, t.id, e.id, r), x(), e.parent = t, n ? (e.nextSibling = n, e.prevSibling = n.prevSibling, n.prevSibling ? n.prevSibling.nextSibling = e : t.firstChild = e, n.prevSibling = e) : (e.prevSibling = t.lastChild, e.nextSibling = null, t.lastChild ? t.lastChild.nextSibling = e : t.firstChild = e, t.lastChild = e);
  }, removeNode(t, e) {
    H(2, e.id, 0, 0), In(e), x(), e.prevSibling ? e.prevSibling.nextSibling = e.nextSibling : t.firstChild = e.nextSibling, e.nextSibling ? e.nextSibling.prevSibling = e.prevSibling : t.lastChild = e.prevSibling, e.parent = null, e.prevSibling = null, e.nextSibling = null;
  }, isTextNode(t) {
    return t.isText;
  }, getParentNode(t) {
    return t.parent;
  }, getFirstChild(t) {
    return t.firstChild;
  }, getNextSibling(t) {
    return t.nextSibling;
  } }), { render: Cn, effect: Fn, memo: Mr, createComponent: pt, createElement: L, createTextNode: $r, insertNode: G, insert: lt, spread: Yr, setProp: E, mergeProps: Xr, use: qr } = mn;
  H(1, 1, 5, 0), x();
  var xn = new Gt("scrollColumn", 1, false), _e = ["Just shipped a new feature, feeling great about how it turned out \uD83D\uDE80", "Hot take: the best APIs are the ones you don't have to read docs for", "Spent the morning refactoring legacy code \u2014 so much cleaner now", "Compose Multiplatform is genuinely maturing into something special", "If your tests are slow, that's a smell. Fast tests = good tests", "Bun's startup time keeps surprising me, even after a year", "Why is naming things still the hardest part of programming?", "Found a 10\xD7 speedup in a critical path today. Profilers, not guesses", "Reading 'The Art of Unix Programming' for the third time", "Premature abstraction is somehow worse than premature optimization", "Latency is a feature, throughput is an artifact of how you measure", "Half of debugging is admitting your assumption was wrong", "You don't ship the codebase you have. You ship the codebase you understand", "Cache invalidation, naming things, off-by-one. The classics", "Every config file format eventually grows a turing-complete templating layer"], Nn = Array.from({ length: 5000 }, (t, e) => ({ author: `@user${e * 2654435761 >>> 17}`, body: _e[e % _e.length], num: e + 1 })), Ln = [50, 200, 500, 1000, 2000, 5000], de = "#FFF1F5F9", Ee = "#FF475569", kn = "#FF22C55E", Dn = "#FFEF4444", Se = "#FFFFFFFF";
  function Hn(t) {
    const [e, n] = D(0), [r, i] = D(false), [l, f] = D(0), [h, w] = D(false);
    return (() => {
      var v = L("column"), p = L("text"), c = L("text"), I = L("row"), A = L("button"), y = L("button");
      return G(v, p), G(v, c), G(v, I), E(v, "background", "#FFFFFFFF"), E(v, "padding", 12), E(v, "cornerRadius", 10), E(v, "borderWidth", 1), E(v, "borderColor", "#FFE5E5EA"), E(v, "gap", 6), E(p, "fontWeight", 700), E(p, "fontSize", 14), E(p, "color", "#FF1DA1F2"), E(c, "fontSize", 14), E(c, "color", "#FF1F2937"), E(c, "maxLines", 3), E(c, "textOverflow", 1), G(I, A), G(I, y), E(I, "gap", 10), E(A, "fontSize", 12), E(A, "padding", 6), E(A, "cornerRadius", 16), E(A, "onClick", () => {
        const _ = !r();
        i(_), n(e() + (_ ? 1 : -1));
      }), E(y, "fontSize", 12), E(y, "padding", 6), E(y, "cornerRadius", 16), E(y, "onClick", () => {
        const _ = !h();
        w(_), f(l() + (_ ? 1 : -1));
      }), Fn((_) => {
        var { author: m, body: F } = t, a = `\u2665 ${e()}`, o = r() ? kn : de, s = r() ? Se : Ee, g = `\u21A9 ${l()}`, S = h() ? Dn : de, P = h() ? Se : Ee;
        return m !== _.e && (_.e = E(p, "label", m, _.e)), F !== _.t && (_.t = E(c, "label", F, _.t)), a !== _.a && (_.a = E(A, "label", a, _.a)), o !== _.o && (_.o = E(A, "background", o, _.o)), s !== _.i && (_.i = E(A, "color", s, _.i)), g !== _.n && (_.n = E(y, "label", g, _.n)), S !== _.s && (_.s = E(y, "background", S, _.s)), P !== _.h && (_.h = E(y, "color", P, _.h)), _;
      }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined, n: undefined, s: undefined, h: undefined }), v;
    })();
  }
  function Bn() {
    const [t, e] = D(0), [n, r] = D("tap +1000 to benchmark fast-path"), [i, l] = D(50), [f, h] = D(""), w = ft(() => Nn.slice(0, i()));
    return (() => {
      var v = L("column"), p = L("box"), c = L("row"), I = L("button"), A = L("button"), y = L("button"), _ = L("row");
      return G(v, p), G(v, c), G(v, y), G(v, _), E(v, "background", "#FFFAFAFA"), E(v, "padding", 16), E(v, "gap", 12), E(p, "background", "#FF1DA1F2"), E(p, "padding", 12), E(p, "cornerRadius", 8), lt(p, () => `Count: ${t()}`), G(c, I), G(c, A), E(c, "gap", 8), E(I, "label", "Increment"), E(I, "onClick", () => e(t() + 1)), E(A, "label", "Decrement"), E(A, "onClick", () => e(t() - 1)), E(y, "label", "+1000 (benchmark)"), E(y, "onClick", () => {
        const m = t(), F = performance.now();
        let a = 0, o = -1, s = "";
        try {
          for (;a < 1000; a++)
            e(t() + 1);
        } catch (P) {
          o = a, s = P && (P.message || String(P)) || "unknown";
        }
        const g = (performance.now() - F).toFixed(3), S = t() - m;
        o >= 0 ? r(`crashed @${o}: ${s} \xB7 delta=${S}`) : r(`+1000 ${g}ms \xB7 iter=${a} delta=${S}`);
      }), lt(v, n, _), lt(_, pt(re, { each: Ln, children: (m) => (() => {
        var F = L("button");
        return E(F, "label", `${m}`), E(F, "onClick", () => {
          const a = performance.now();
          l(m), h(`set to ${m} in ${(performance.now() - a).toFixed(3)} ms (handler)`);
        }), F;
      })() })), lt(v, f, null), lt(v, pt(re, { get each() {
        return w();
      }, children: (m) => pt(Hn, { get author() {
        return m.author;
      }, get body() {
        return m.body;
      }, get num() {
        return m.num;
      } }) }), null), v;
    })();
  }
  Cn(() => pt(Bn, {}), xn);
})();
})
