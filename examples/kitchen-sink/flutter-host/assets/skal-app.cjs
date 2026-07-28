// @bun @bytecode @bun-cjs
(function(exports, require, module, __filename, __dirname) {// flutter-host/assets/skal-app.js
globalThis.__SKAL_BUILDER_PROPS__ = {};
(function() {
  var _e = { context: undefined, registry: undefined, effects: undefined, done: false, getContextId() {
    return Hn(this.context.count);
  }, getNextContextId() {
    return Hn(this.context.count++);
  } };
  function Hn(e) {
    const r = String(e), n = r.length - 1;
    return _e.context.id + (n ? String.fromCharCode(96 + n) : "") + r;
  }
  function Br(e) {
    _e.context = e;
  }
  function To() {
    return { ..._e.context, id: _e.getNextContextId(), count: 0 };
  }
  var Eo = (e, r) => e === r, Me = Symbol("solid-proxy"), Ro = typeof Proxy == "function", hr = Symbol("solid-track"), gr = { equals: Eo }, Un = null, Gn = Qn, Ie = 1, Ht = 2, jn = { owned: null, cleanups: null, context: null, owner: null }, ie = null, V = null, Ut = null, Tt = null, ae = null, ge = null, me = null, pr = 0;
  function et(e, r) {
    const n = ae, i = ie, a = e.length === 0, l = r === undefined ? i : r, c = a ? jn : { owned: null, cleanups: null, context: l ? l.context : null, owner: l }, g = a ? e : () => e(() => rt(() => nt(c)));
    ie = c, ae = null;
    try {
      return Be(g, true);
    } finally {
      ae = n, ie = i;
    }
  }
  function K(e, r) {
    r = r ? Object.assign({}, gr, r) : gr;
    const n = { value: e, observers: null, observerSlots: null, comparator: r.equals || undefined }, i = (a) => (typeof a == "function" && (V && V.running && V.sources.has(n) ? a = a(n.tValue) : a = a(n.value)), Jn(n, a));
    return [Yn.bind(n), i];
  }
  function tt(e, r, n) {
    const i = Hr(e, r, false, Ie);
    Ut && V && V.running ? ge.push(i) : qt(i);
  }
  function Et(e, r, n) {
    Gn = Oo;
    const i = Hr(e, r, false, Ie), a = Wr && Po(Wr);
    a && (i.suspense = a), (!n || !n.render) && (i.user = true), me ? me.push(i) : qt(i);
  }
  function Gt(e, r, n) {
    n = n ? Object.assign({}, gr, n) : gr;
    const i = Hr(e, r, true, 0);
    return i.observers = null, i.observerSlots = null, i.comparator = n.equals || undefined, Ut && V && V.running ? (i.tState = Ie, ge.push(i)) : qt(i), Yn.bind(i);
  }
  function qn(e) {
    return Be(e, false);
  }
  function rt(e) {
    if (!Tt && ae === null)
      return e();
    const r = ae;
    ae = null;
    try {
      return Tt ? Tt.untrack(e) : e();
    } finally {
      ae = r;
    }
  }
  function Xn(e) {
    Et(() => rt(e));
  }
  function dt(e) {
    return ie === null || (ie.cleanups === null ? ie.cleanups = [e] : ie.cleanups.push(e)), e;
  }
  function Vr() {
    return ae;
  }
  function jt() {
    return ie;
  }
  function $o(e) {
    if (V && V.running)
      return e(), V.done;
    const r = ae, n = ie;
    return Promise.resolve().then(() => {
      ae = r, ie = n;
      let i;
      return (Ut || Wr) && (i = V || (V = { sources: new Set, effects: [], promises: new Set, disposed: new Set, queue: new Set, running: true }), i.done || (i.done = new Promise((a) => i.resolve = a)), i.running = true), Be(e, false), ae = ie = null, i ? i.done : undefined;
    });
  }
  var [Il, Kn] = K(false);
  function Po(e) {
    let r;
    return ie && ie.context && (r = ie.context[e.id]) !== undefined ? r : e.defaultValue;
  }
  var Wr;
  function Yn() {
    const e = V && V.running;
    if (this.sources && (e ? this.tState : this.state))
      if ((e ? this.tState : this.state) === Ie)
        qt(this);
      else {
        const r = ge;
        ge = null, Be(() => br(this), false), ge = r;
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
  function Jn(e, r, n) {
    let i = V && V.running && V.sources.has(e) ? e.tValue : e.value;
    if (!e.comparator || !e.comparator(i, r)) {
      if (V) {
        const a = V.running;
        (a || !n && V.sources.has(e)) && (V.sources.add(e), e.tValue = r), a || (e.value = r);
      } else
        e.value = r;
      e.observers && e.observers.length && Be(() => {
        for (let a = 0;a < e.observers.length; a += 1) {
          const l = e.observers[a], c = V && V.running;
          c && V.disposed.has(l) || ((c ? !l.tState : !l.state) && (l.pure ? ge.push(l) : me.push(l), l.observers && ei(l)), c ? l.tState = Ie : l.state = Ie);
        }
        if (ge.length > 1e6)
          throw ge = [], new Error;
      }, false);
    }
    return r;
  }
  function qt(e) {
    if (!e.fn)
      return;
    nt(e);
    const r = pr;
    Zn(e, V && V.running && V.sources.has(e) ? e.tValue : e.value, r), V && !V.running && V.sources.has(e) && queueMicrotask(() => {
      Be(() => {
        V && (V.running = true), ae = ie = e, Zn(e, e.tValue, r), ae = ie = null;
      }, false);
    });
  }
  function Zn(e, r, n) {
    let i;
    const a = ie, l = ae;
    ae = ie = e;
    try {
      i = e.fn(r);
    } catch (c) {
      return e.pure && (V && V.running ? (e.tState = Ie, e.tOwned && e.tOwned.forEach(nt), e.tOwned = undefined) : (e.state = Ie, e.owned && e.owned.forEach(nt), e.owned = null)), e.updatedAt = n + 1, Ur(c);
    } finally {
      ae = l, ie = a;
    }
    (!e.updatedAt || e.updatedAt <= n) && (e.updatedAt != null && ("observers" in e) ? Jn(e, i, true) : V && V.running && e.pure ? (V.sources.has(e) || (e.value = i), V.sources.add(e), e.tValue = i) : e.value = i, e.updatedAt = n);
  }
  function Hr(e, r, n, i = Ie, a) {
    const l = { fn: e, state: i, updatedAt: null, owned: null, sources: null, sourceSlots: null, cleanups: null, value: r, owner: ie, context: ie ? ie.context : null, pure: n };
    if (V && V.running && (l.state = 0, l.tState = i), ie === null || ie !== jn && (V && V.running && ie.pure ? ie.tOwned ? ie.tOwned.push(l) : ie.tOwned = [l] : ie.owned ? ie.owned.push(l) : ie.owned = [l]), Tt && l.fn) {
      const c = l.fn, [g, f] = K(undefined, { equals: false }), _ = Tt.factory(c, f);
      dt(() => _.dispose());
      let x;
      const y = () => $o(f).then(() => {
        x && (x.dispose(), x = undefined);
      });
      l.fn = (P) => (g(), V && V.running ? (x || (x = Tt.factory(c, y)), x.track(P)) : _.track(P));
    }
    return l;
  }
  function Xt(e) {
    const r = V && V.running;
    if ((r ? e.tState : e.state) === 0)
      return;
    if ((r ? e.tState : e.state) === Ht)
      return br(e);
    if (e.suspense && rt(e.suspense.inFallback))
      return e.suspense.effects.push(e);
    const n = [e];
    for (;(e = e.owner) && (!e.updatedAt || e.updatedAt < pr); ) {
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
      if ((r ? e.tState : e.state) === Ie)
        qt(e);
      else if ((r ? e.tState : e.state) === Ht) {
        const a = ge;
        ge = null, Be(() => br(e, n[0]), false), ge = a;
      }
    }
  }
  function Be(e, r) {
    if (ge)
      return e();
    let n = false;
    r || (ge = []), me ? n = true : me = [], pr++;
    try {
      const i = e();
      return Ao(n), i;
    } catch (i) {
      n || (me = null), ge = null, Ur(i);
    }
  }
  function Ao(e) {
    if (ge && (Ut && V && V.running ? Fo(ge) : Qn(ge), ge = null), e)
      return;
    let r;
    if (V) {
      if (!V.promises.size && !V.queue.size) {
        const { sources: i, disposed: a } = V;
        me.push.apply(me, V.effects), r = V.resolve;
        for (const l of me)
          "tState" in l && (l.state = l.tState), delete l.tState;
        V = null, Be(() => {
          for (const l of a)
            nt(l);
          for (const l of i) {
            if (l.value = l.tValue, l.owned)
              for (let c = 0, g = l.owned.length;c < g; c++)
                nt(l.owned[c]);
            l.tOwned && (l.owned = l.tOwned), delete l.tValue, delete l.tOwned, l.tState = 0;
          }
          Kn(false);
        }, false);
      } else if (V.running) {
        V.running = false, V.effects.push.apply(V.effects, me), me = null, Kn(true);
        return;
      }
    }
    const n = me;
    me = null, n.length && Be(() => Gn(n), false), r && r();
  }
  function Qn(e) {
    for (let r = 0;r < e.length; r++)
      Xt(e[r]);
  }
  function Fo(e) {
    for (let r = 0;r < e.length; r++) {
      const n = e[r], i = V.queue;
      i.has(n) || (i.add(n), Ut(() => {
        i.delete(n), Be(() => {
          V.running = true, Xt(n);
        }, false), V && (V.running = false);
      }));
    }
  }
  function Oo(e) {
    let r, n = 0;
    for (r = 0;r < e.length; r++) {
      const i = e[r];
      i.user ? e[n++] = i : Xt(i);
    }
    if (_e.context) {
      if (_e.count) {
        _e.effects || (_e.effects = []), _e.effects.push(...e.slice(0, n));
        return;
      }
      Br();
    }
    for (_e.effects && (_e.done || !_e.count) && (e = [..._e.effects, ...e], n += _e.effects.length, delete _e.effects), r = 0;r < n; r++)
      Xt(e[r]);
  }
  function br(e, r) {
    const n = V && V.running;
    n ? e.tState = 0 : e.state = 0;
    for (let i = 0;i < e.sources.length; i += 1) {
      const a = e.sources[i];
      if (a.sources) {
        const l = n ? a.tState : a.state;
        l === Ie ? a !== r && (!a.updatedAt || a.updatedAt < pr) && Xt(a) : l === Ht && br(a, r);
      }
    }
  }
  function ei(e) {
    const r = V && V.running;
    for (let n = 0;n < e.observers.length; n += 1) {
      const i = e.observers[n];
      (r ? !i.tState : !i.state) && (r ? i.tState = Ht : i.state = Ht, i.pure ? ge.push(i) : me.push(i), i.observers && ei(i));
    }
  }
  function nt(e) {
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
        nt(e.tOwned[r]);
      delete e.tOwned;
    }
    if (V && V.running && e.pure)
      ti(e, true);
    else if (e.owned) {
      for (r = e.owned.length - 1;r >= 0; r--)
        nt(e.owned[r]);
      e.owned = null;
    }
    if (e.cleanups) {
      for (r = e.cleanups.length - 1;r >= 0; r--)
        e.cleanups[r]();
      e.cleanups = null;
    }
    V && V.running ? e.tState = 0 : e.state = 0;
  }
  function ti(e, r) {
    if (r || (e.tState = 0, V.disposed.add(e)), e.owned)
      for (let n = 0;n < e.owned.length; n++)
        ti(e.owned[n]);
  }
  function Co(e) {
    return e instanceof Error ? e : new Error(typeof e == "string" ? e : "Unknown error", { cause: e });
  }
  function ri(e, r, n) {
    try {
      for (const i of r)
        i(e);
    } catch (i) {
      Ur(i, n && n.owner || null);
    }
  }
  function Ur(e, r = ie) {
    const n = Un && r && r.context && r.context[Un], i = Co(e);
    if (!n)
      throw i;
    me ? me.push({ fn() {
      ri(i, n, r);
    }, state: Ie }) : ri(i, n, r);
  }
  var Io = Symbol("fallback");
  function ni(e) {
    for (let r = 0;r < e.length; r++)
      e[r]();
  }
  function Do(e, r, n = {}) {
    let i = [], a = [], l = [], c = 0, g = r.length > 1 ? [] : null;
    return dt(() => ni(l)), () => {
      let f = e() || [], _ = f.length, x, y;
      return f[hr], rt(() => {
        let p, I, T, F, L, k, A, h, S;
        if (_ === 0)
          c !== 0 && (ni(l), l = [], i = [], a = [], c = 0, g && (g = [])), n.fallback && (i = [Io], a[0] = et((E) => (l[0] = E, n.fallback())), c = 1);
        else if (c === 0) {
          for (a = new Array(_), y = 0;y < _; y++)
            i[y] = f[y], a[y] = et(P);
          c = _;
        } else {
          for (T = new Array(_), F = new Array(_), g && (L = new Array(_)), k = 0, A = Math.min(c, _);k < A && i[k] === f[k]; k++)
            ;
          for (A = c - 1, h = _ - 1;A >= k && h >= k && i[A] === f[h]; A--, h--)
            T[h] = a[A], F[h] = l[A], g && (L[h] = g[A]);
          for (p = new Map, I = new Array(h + 1), y = h;y >= k; y--)
            S = f[y], x = p.get(S), I[y] = x === undefined ? -1 : x, p.set(S, y);
          for (x = k;x <= A; x++)
            S = i[x], y = p.get(S), y !== undefined && y !== -1 ? (T[y] = a[x], F[y] = l[x], g && (L[y] = g[x]), y = I[y], p.set(S, y)) : l[x]();
          for (y = k;y < _; y++)
            y in T ? (a[y] = T[y], l[y] = F[y], g && (g[y] = L[y], g[y](y))) : a[y] = et(P);
          a = a.slice(0, c = _), i = f.slice(0);
        }
        return a;
      });
      function P(p) {
        if (l[y] = p, g) {
          const [I, T] = K(y);
          return g[y] = T, r(f[y], I);
        }
        return r(f[y]);
      }
    };
  }
  var zo = false;
  function Lo(e, r) {
    if (zo && _e.context) {
      const n = _e.context;
      Br(To());
      const i = rt(() => e(r || {}));
      return Br(n), i;
    }
    return rt(() => e(r || {}));
  }
  function _r() {
    return true;
  }
  var Mo = { get(e, r, n) {
    return r === Me ? n : e.get(r);
  }, has(e, r) {
    return r === Me ? true : e.has(r);
  }, set: _r, deleteProperty: _r, getOwnPropertyDescriptor(e, r) {
    return { configurable: true, enumerable: true, get() {
      return e.get(r);
    }, set: _r, deleteProperty: _r };
  }, ownKeys(e) {
    return e.keys();
  } };
  function Gr(e) {
    return (e = typeof e == "function" ? e() : e) ? e : {};
  }
  function No() {
    for (let e = 0, r = this.length;e < r; ++e) {
      const n = this[e]();
      if (n !== undefined)
        return n;
    }
  }
  function ii(...e) {
    let r = false;
    for (let c = 0;c < e.length; c++) {
      const g = e[c];
      r = r || !!g && Me in g, e[c] = typeof g == "function" ? (r = true, Gt(g)) : g;
    }
    if (Ro && r)
      return new Proxy({ get(c) {
        for (let g = e.length - 1;g >= 0; g--) {
          const f = Gr(e[g])[c];
          if (f !== undefined)
            return f;
        }
      }, has(c) {
        for (let g = e.length - 1;g >= 0; g--)
          if (c in Gr(e[g]))
            return true;
        return false;
      }, keys() {
        const c = [];
        for (let g = 0;g < e.length; g++)
          c.push(...Object.keys(Gr(e[g])));
        return [...new Set(c)];
      } }, Mo);
    const n = {}, i = Object.create(null);
    for (let c = e.length - 1;c >= 0; c--) {
      const g = e[c];
      if (!g)
        continue;
      const f = Object.getOwnPropertyNames(g);
      for (let _ = f.length - 1;_ >= 0; _--) {
        const x = f[_];
        if (x === "__proto__" || x === "constructor")
          continue;
        const y = Object.getOwnPropertyDescriptor(g, x);
        if (!i[x])
          i[x] = y.get ? { enumerable: true, configurable: true, get: No.bind(n[x] = [y.get.bind(g)]) } : y.value !== undefined ? y : undefined;
        else {
          const P = n[x];
          P && (y.get ? P.push(y.get.bind(g)) : y.value !== undefined && P.push(() => y.value));
        }
      }
    }
    const a = {}, l = Object.keys(i);
    for (let c = l.length - 1;c >= 0; c--) {
      const g = l[c], f = i[g];
      f && f.get ? Object.defineProperty(a, g, f) : a[g] = f ? f.value : undefined;
    }
    return a;
  }
  function ue(e) {
    const r = "fallback" in e && { fallback: () => e.fallback };
    return Gt(Do(() => e.each, e.children, r || undefined));
  }
  var Bo = (e) => Gt(() => e());
  function Vo({ createElement: e, createTextNode: r, isTextNode: n, replaceText: i, insertNode: a, removeNode: l, setProperty: c, getParentNode: g, getFirstChild: f, getNextSibling: _ }) {
    function x(k, A, h, S) {
      if (h !== undefined && !S && (S = []), typeof A != "function")
        return y(k, A, S, h);
      tt((E) => y(k, A(), E, h), S);
    }
    function y(k, A, h, S, E) {
      for (;typeof h == "function"; )
        h = h();
      if (A === h)
        return h;
      const z = typeof A, N = S !== undefined;
      if (z === "string" || z === "number")
        if (z === "number" && (A = A.toString()), N) {
          let j = h[0];
          j && n(j) ? i(j, A) : j = r(A), h = I(k, h, S, j);
        } else
          h !== "" && typeof h == "string" ? i(f(k), h = A) : (I(k, h, S, r(A)), h = A);
      else if (A == null || z === "boolean")
        h = I(k, h, S);
      else {
        if (z === "function")
          return tt(() => {
            let j = A();
            for (;typeof j == "function"; )
              j = j();
            h = y(k, j, h, S);
          }), () => h;
        if (Array.isArray(A)) {
          const j = [];
          if (P(j, A, E))
            return tt(() => h = y(k, j, h, S, true)), () => h;
          if (j.length === 0) {
            const he = I(k, h, S);
            if (N)
              return h = he;
          } else
            Array.isArray(h) ? h.length === 0 ? T(k, j, S) : p(k, h, j) : h == null || h === "" ? T(k, j) : p(k, N && h || [f(k)], j);
          h = j;
        } else {
          if (Array.isArray(h)) {
            if (N)
              return h = I(k, h, S, A);
            I(k, h, null, A);
          } else
            h == null || h === "" || !f(k) ? a(k, A) : F(k, A, f(k));
          h = A;
        }
      }
      return h;
    }
    function P(k, A, h) {
      let S = false;
      for (let E = 0, z = A.length;E < z; E++) {
        let N = A[E], j;
        if (!(N == null || N === true || N === false))
          if (Array.isArray(N))
            S = P(k, N) || S;
          else if ((j = typeof N) == "string" || j === "number")
            k.push(r(N));
          else if (j === "function")
            if (h) {
              for (;typeof N == "function"; )
                N = N();
              S = P(k, Array.isArray(N) ? N : [N]) || S;
            } else
              k.push(N), S = true;
          else
            k.push(N);
      }
      return S;
    }
    function p(k, A, h) {
      let S = h.length, E = A.length, z = S, N = 0, j = 0, he = _(A[E - 1]), oe = null;
      for (;N < E || j < z; ) {
        if (A[N] === h[j]) {
          N++, j++;
          continue;
        }
        for (;A[E - 1] === h[z - 1]; )
          E--, z--;
        if (E === N) {
          const $e = z < S ? j ? _(h[j - 1]) : h[z - j] : he;
          for (;j < z; )
            a(k, h[j++], $e);
        } else if (z === j)
          for (;N < E; )
            (!oe || !oe.has(A[N])) && l(k, A[N]), N++;
        else if (A[N] === h[z - 1] && h[j] === A[E - 1]) {
          const $e = _(A[--E]);
          a(k, h[j++], _(A[N++])), a(k, h[--z], $e), A[E] = h[z];
        } else {
          if (!oe) {
            oe = new Map;
            let ce = j;
            for (;ce < z; )
              oe.set(h[ce], ce++);
          }
          const $e = oe.get(A[N]);
          if ($e != null)
            if (j < $e && $e < z) {
              let ce = N, Pe = 1, St;
              for (;++ce < E && ce < z && !((St = oe.get(A[ce])) == null || St !== $e + Pe); )
                Pe++;
              if (Pe > $e - j) {
                const Nt = A[N];
                for (;j < $e; )
                  a(k, h[j++], Nt);
              } else
                F(k, h[j++], A[N++]);
            } else
              N++;
          else
            l(k, A[N++]);
        }
      }
    }
    function I(k, A, h, S) {
      if (h === undefined) {
        let z;
        for (;z = f(k); )
          l(k, z);
        return S && a(k, S), "";
      }
      const E = S || r("");
      if (A.length) {
        let z = false;
        for (let N = A.length - 1;N >= 0; N--) {
          const j = A[N];
          if (E !== j) {
            const he = g(j) === k;
            !z && !N ? he ? F(k, E, j) : a(k, E, h) : he && l(k, j);
          } else
            z = true;
        }
      } else
        a(k, E, h);
      return [E];
    }
    function T(k, A, h) {
      for (let S = 0, E = A.length;S < E; S++)
        a(k, A[S], h);
    }
    function F(k, A, h) {
      a(k, A, h), l(k, h);
    }
    function L(k, A, h = {}, S) {
      return A || (A = {}), S || tt(() => h.children = y(k, A.children, h.children)), tt(() => A.ref && A.ref(k)), tt(() => {
        for (const E in A) {
          if (E === "children" || E === "ref")
            continue;
          const z = A[E];
          z !== h[E] && (c(k, E, z, h[E]), h[E] = z);
        }
      }), h;
    }
    return { render(k, A) {
      let h;
      return et((S) => {
        h = S, x(A, k());
      }), h;
    }, insert: x, spread(k, A, h) {
      typeof A == "function" ? tt((S) => L(k, A(), S, h)) : L(k, A, undefined, h);
    }, createElement: e, createTextNode: r, insertNode: a, setProp(k, A, h, S) {
      return c(k, A, h, S), h;
    }, mergeProps: ii, effect: tt, memo: Bo, createComponent: Lo, use(k, A, h) {
      return rt(() => k(A, h));
    } };
  }
  function oi(e) {
    const r = Vo(e);
    return r.mergeProps = ii, r;
  }
  function Wo() {
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
  var ai = 6 * 1024 * 1024, Kt = 4194368, Ho = 768 * 1024, si = 4980800, li = 4980800, ci = 2, ui = 3, Uo = 6, di = 7, Go = 10, fi = 12, hi = 0, jo = 2, gi = 4, Dl = 1, zl = 2, Ll = 3, Ml = 4, Nl = 16, Bl = 17, Vl = 20, Wl = 21, Hl = 22, Ul = 23, Gl = 24, jl = 25, ql = 26, Xl = 44, Kl = 45, Yl = 27, Jl = 28, Zl = 29, Ql = 30, ec = 31, tc = 32, rc = 33, nc = 34, ic = 35, oc = 36, ac = 37, sc = 38, lc = 39, cc = 40, uc = 41, dc = 42, fc = 43, hc = 0, gc = 1, pc = 2, bc = 3, _c = 4, vc = 5, mc = 6, wc = 7, Sc = 9, yc = 10, xc = 11, kc = 12, Tc = 13, Ec = 14, Rc = 15, $c = 16, Pc = 17, Ac = 18, Fc = 19, Oc = 20, Cc = 21, Ic = 22, Dc = 23, zc = 24, Lc = 25, Mc = 26, Nc = 27, Bc = 28, Vc = 29, Wc = 30, Hc = 31, Uc = 32, Gc = 33, jc = 34, qc = 35, Xc = 36, Kc = 37, Yc = 38, Jc = 39, Zc = 40, Qc = 41, eu = 42, tu = 43, ru = 44, nu = 45, iu = 46, ou = 47, au = 48, su = 49, lu = 1, cu = 2, uu = 3, du = 4, fu = 5, hu = 6, gu = 7, pu = 8, bu = 9, _u = 10, vu = 11, mu = 12, wu = 13, Su = 14, yu = 15, xu = 16, ku = 17, Tu = 18, Eu = 19, Ru = 20, $u = 21, Pu = 22, Au = 23, Fu = 24, Ou = 0, Cu = 1, Iu = 2, Du = 3, zu = 4, Lu = 5, Mu = 6, Nu = 7, Bu = 0, Vu = 1, Wu = 2, Hu = 3, Uu = 4, Gu = 5, ju = 6, qu = 7, Xu = 8, Ku = 9, Yu = 10, Ju = 11, Zu = 12, Qu = 13, ed = 14, td = 15, rd = 16, nd = 17, id = 32, od = 33, ad = 34, sd = 35, ld = 36, cd = 37, ud = 64, dd = 65, fd = 66, hd = 67, gd = 68, pd = 69, bd = 70, _d = 71, vd = 72, md = 73, wd = 74, Sd = 75, yd = 76, xd = 96, kd = 97, Td = 98, Ed = 99, Rd = 128, $d = 129, Pd = 130, Ad = 131, Fd = 132, Od = 133, Cd = 134, Id = 135, Dd = 136, zd = 137, Ld = 160, Md = 161, Nd = 162, Bd = 163, Vd = 164, Wd = 165, Hd = 166, Ud = 167, Gd = 168, jd = 169, qd = 170, Xd = 171, Kd = 172, Yd = 173, Jd = 174, Zd = 175, Qd = 176, ef = 177, tf = 178, rf = 179, nf = 180, of = 181, af = 182, sf = 183, lf = -1, qo = 2147483646, Xo = 2147483645, vr = typeof globalThis.__skal_acquireBridge == "function", Xe;
  if (vr) {
    if (Xe = globalThis.__skal_acquireBridge(), !Xe || Xe.byteLength !== ai)
      throw new Error(`Skal: bridge buffer not available (got ${Xe && Xe.byteLength})`);
  } else
    Xe = new ArrayBuffer(ai);
  var jr = new Uint8Array(Xe), pe = new Uint32Array(Xe), Yt = new BigInt64Array(Xe), Ko = new TextEncoder, Jt = 16, Yo = 1048592, Jo = 16384, Zo = Yo - 4, pi = pe[ci], bi = pe[ui], Zt = Atomics.load(Yt, hi), Ke = pi ? (pi >> 2) + Jt : Jt, Rt = bi ? bi + Kt : Kt, mr = Ke, qr = false, Xr = false, Kr = false;
  function Yr() {
    Ke = Jt, Rt = Kt, mr = Jt, qr = true;
  }
  function Jr() {
    pe[ci] = Ke - Jt << 2, pe[ui] = Rt - Kt, qr && (pe[fi] = pe[fi] + 1 >>> 0, qr = false), Zt += 1n, Atomics.store(Yt, hi, Zt), mr = Ke, _i();
  }
  function _i() {
    wi && (Atomics.load(Yt, gi) < Si || (Si = Zt, wi()));
  }
  function vi() {
    Kr = true;
    try {
      Jr();
      const e = Zt, r = globalThis.__skal_drainOpsSync;
      if (typeof r == "function") {
        if (globalThis.__skal_opRingResets = (globalThis.__skal_opRingResets | 0) + 1, Xr)
          console.warn("Skal: op ring re-overflowed during inline drain \u2014 chunk large renders to avoid stale ops");
        else {
          Xr = true;
          try {
            r();
          } finally {
            Xr = false;
          }
        }
        Yr();
        return;
      }
      const n = performance.now() + 5000;
      for (;!(Atomics.load(Yt, gi) >= e); )
        if (performance.now() > n) {
          console.warn("Skal: drain spin timeout \u2014 UI thread slow; ring will overwrite");
          break;
        }
      Yr();
    } finally {
      Kr = false;
    }
  }
  function ee(e, r, n, i) {
    let a = Ke;
    a >= Zo && (vi(), a = Ke), pe[a] = e >>> 0, pe[a + 1] = r >>> 0, pe[a + 2] = n >>> 0, pe[a + 3] = i >>> 0, Ke = a + 4, Ke - mr >= Jo && Jr();
  }
  var Ye = 0, Ve = 0;
  function it(e) {
    Rt + e.length * 3 > li && vi();
    const r = Rt - Kt, n = jr.subarray(Rt, li), { read: i, written: a } = Ko.encodeInto(e, n);
    if (i !== e.length)
      throw new Error(`Skal: string too large for heap (${e.length} code units > ${Ho} bytes)`);
    Rt += a, Ye = r, Ve = a;
  }
  function wr(e, r) {
    it(r), ee(20, e, Ye, Ve);
  }
  var mi = 8192, Qo = (e, r) => typeof r == "bigint" ? `${r}n` : r;
  function ea(e) {
    if (typeof e == "string")
      return e;
    if (e instanceof Error)
      return e.stack || e.message || String(e);
    if (typeof e == "object" && e !== null)
      try {
        return JSON.stringify(e, Qo);
      } catch {
        return String(e);
      }
    return String(e);
  }
  var Zr = false;
  function ft(e, r) {
    if (!(Zr || Kr)) {
      Zr = true;
      try {
        let n = "";
        for (let i = 0;i < r.length; i++)
          i && (n += " "), n += ea(r[i]);
        if (n.length === 0)
          return;
        n.length > mi && (n = n.slice(0, mi) + "\u2026"), it(n), ee(40, e, Ye, Ve), te();
      } catch {} finally {
        Zr = false;
      }
    }
  }
  function ta() {
    const e = { log: function() {
      ft(0, arguments);
    }, info: function() {
      ft(1, arguments);
    }, warn: function() {
      ft(2, arguments);
    }, error: function() {
      ft(3, arguments);
    }, debug: function() {
      ft(4, arguments);
    }, trace: function() {
      ft(4, arguments);
    } };
    e.dir = e.log, e.dirxml = e.log, e.table = e.log, e.group = e.log, e.groupCollapsed = e.log, e.assert = function(n) {
      if (!n) {
        const i = Array.prototype.slice.call(arguments, 1);
        ft(3, ["Assertion failed:"].concat(i));
      }
    };
    const r = function() {};
    globalThis.console = new Proxy(e, { get(n, i) {
      const a = n[i];
      return a !== undefined ? a : r;
    } });
  }
  vr && typeof window > "u" && ta();
  var Qr = false, wi = typeof globalThis.__skal_notifyHost == "function" ? globalThis.__skal_notifyHost : null, en = false, Si = 0n;
  function yi(e) {
    e === 1 && (en = true);
  }
  function xi() {
    Qr = false, Ke !== mr ? Jr() : en && _i(), en = false;
  }
  function te() {
    Qr || (Qr = true, queueMicrotask(xi));
  }
  function ra() {
    Yr(), ee(41, 1, 0, 0), xi();
  }
  var We = 1024, U = new Int8Array(256);
  U.fill(-1), U[0] = 0, U[1] = 1, U[2] = 2, U[3] = 3, U[4] = 4, U[5] = 5, U[6] = 6, U[7] = 7, U[8] = 8, U[9] = 9, U[32] = 10, U[33] = 11, U[34] = 12, U[35] = 13, U[36] = 14, U[37] = 15, U[64] = 16, U[65] = 17, U[66] = 18, U[67] = 19, U[68] = 20, U[69] = 21, U[70] = 22, U[96] = 23, U[97] = 24, U[128] = 25, U[129] = 26, U[130] = 27, U[131] = 28, U[160] = 29, U[161] = 30, U[162] = 31, U[10] = 32, U[11] = 33, U[12] = 34, U[13] = 35, U[14] = 36, U[15] = 37, U[16] = 38, U[132] = 39, U[133] = 40, U[134] = 41, U[135] = 42, U[136] = 43, U[163] = 44, U[164] = 45, U[165] = 46, U[166] = 47, U[71] = 48, U[98] = 49, U[137] = 50, U[72] = 51, U[167] = 52, U[168] = 53, U[169] = 54, U[170] = 55, U[171] = 56, U[172] = 57, U[173] = 58, U[174] = 59, U[73] = 60, U[99] = 61, U[175] = 62, U[74] = 63;
  var Te = 64, Sr = new Int32Array(We * Te), $t = new Float32Array(We * Te), Qt = new Array(We * Te), ki = 1, na = 2, ia = 4, Je = new Uint8Array(We * Te), Pt = 6, At = new Float32Array(We * Pt);
  At.fill(NaN);
  var yr = new Map, Ti = [], oa = 0;
  function aa() {
    const e = We * 2, r = We * Te, n = e * Te, i = We * Pt, a = e * Pt, l = new Int32Array(n);
    l.set(Sr), Sr = l;
    const c = new Uint8Array(n);
    c.set(Je), Je = c;
    const g = new Float32Array(n);
    g.set($t), g.fill(NaN, r), $t = g;
    const f = new Float32Array(a);
    f.set(At), f.fill(NaN, i), At = f, Qt.length = n, We = e;
  }
  function er(e) {
    let r = yr.get(e);
    if (r === undefined) {
      r = Ti.pop(), r === undefined && (r = oa++), r >= We && aa(), yr.set(e, r);
      const n = r * Te;
      Je.fill(0, n, n + Te), $t.fill(NaN, n, n + Te);
      for (let i = n;i < n + Te; i++)
        Qt[i] = undefined;
    }
    return r;
  }
  var tn = new Map, rn = new Map, nn = new Map, Ft = new Map;
  function on(e, r) {
    const n = Ft.get(e);
    n && (n.delete(r), n.size === 0 && Ft.delete(e));
  }
  function sa(e) {
    const r = yr.get(e);
    if (r !== undefined) {
      yr.delete(e), Ti.push(r);
      const n = r * Pt;
      At.fill(NaN, n, n + Pt);
    }
    tn.delete(e), rn.delete(e), nn.delete(e), Fa(e);
  }
  var Fe = 0, Ze = 0, Ot = new Float32Array(1), tr = new Uint32Array(Ot.buffer);
  function we(e, r, n) {
    const i = n | 0, a = U[r];
    if (a < 0) {
      ee(16, e, r, i), Fe++;
      return;
    }
    const l = er(e) * Te + a;
    if ((Je[l] & ki) !== 0 && Sr[l] === i) {
      Ze++;
      return;
    }
    Sr[l] = i, Je[l] |= ki, ee(16, e, r, i), Fe++;
  }
  function la(e, r) {
    const n = U[r];
    if (n >= 0) {
      const i = er(e) * Te + n;
      if (Je[i] === 0) {
        Ze++;
        return;
      }
      Je[i] = 0, $t[i] = NaN, Qt[i] = undefined;
    }
    ee(45, e, r, 0), Fe++;
  }
  function Ei(e, r, n) {
    const i = U[r];
    if (i < 0) {
      Ot[0] = n, ee(17, e, r, tr[0]), Fe++;
      return;
    }
    const a = er(e) * Te + i;
    if ($t[a] === n) {
      Ze++;
      return;
    }
    $t[a] = n, Je[a] |= na, Ot[0] = n, ee(17, e, r, tr[0]), Fe++;
  }
  function ca(e, r, n) {
    const i = U[r];
    if (i < 0) {
      it(n == null ? "" : String(n)), ee(22, e, (r & 255) << 24 | Ye & 16777215, Ve), Fe++;
      return;
    }
    const a = er(e) * Te + i;
    if (Qt[a] === n) {
      Ze++;
      return;
    }
    Qt[a] = n, Je[a] |= ia, it(n == null ? "" : String(n)), ee(22, e, (r & 255) << 24 | Ye & 16777215, Ve), Fe++;
  }
  function Ct(e, r, n, i) {
    const a = er(e) * Pt + n;
    if (At[a] === i) {
      Ze++;
      return;
    }
    At[a] = i, Ot[0] = i, ee(r, e, 0, tr[0]), Fe++;
  }
  function ua(e, r) {
    Ct(e, 32, 0, r);
  }
  function da(e, r) {
    Ct(e, 33, 1, r);
  }
  function fa(e, r) {
    Ct(e, 34, 2, r);
  }
  function ha(e, r) {
    Ct(e, 35, 3, r);
  }
  function ga(e, r) {
    Ct(e, 36, 4, r);
  }
  function pa(e, r) {
    Ct(e, 37, 5, r);
  }
  var ba = { material: 0, cupertino: 1, adaptive: 2 }, _a = { light: 0, dark: 1 };
  function va(e, r) {
    ee(38, typeof e == "string" ? ba[e] ?? 0 : e | 0, typeof r == "string" ? _a[r] ?? 0 : r | 0, 0), te();
  }
  function ma(e) {
    ee(39, e, 0, 0), te();
  }
  function wa(e, r, n) {
    ee(42, e, r, n);
  }
  function Sa(e, r) {
    ee(43, e, r, 0);
  }
  function Ri(e) {
    return gt(1, "showDialog", [JSON.stringify(e || {})]);
  }
  function ya(e) {
    return gt(1, "showActionSheet", [JSON.stringify(e || {})]);
  }
  function $i(e) {
    return gt(1, "showSnackbar", [JSON.stringify(typeof e == "string" ? { message: e } : e || {})]);
  }
  function xa(e) {
    return gt(1, "showDatePicker", [JSON.stringify(e || {})]);
  }
  function ka(e) {
    return gt(1, "showTimePicker", [JSON.stringify(e || {})]);
  }
  function Ta() {
    return gt(1, "getDataDir", []);
  }
  var Pi = new Map;
  function Ea(e) {
    let r = 2166136261;
    for (let n = 0;n < e.length; n++)
      r ^= e.charCodeAt(n), r = Math.imul(r, 16777619) >>> 0;
    return r;
  }
  function ot(e) {
    let r = Pi.get(e);
    return r !== undefined || (r = Ea(e), it(e), ee(23, r, Ye, Ve), Pi.set(e, r)), r;
  }
  function Ra(e, r) {
    ee(4, e, ot(r), 0);
  }
  function an(e, r) {
    let n = e.get(r);
    return n === undefined && (n = new Map, e.set(r, n)), n;
  }
  function Ai(e, r, n) {
    const i = ot(r), a = n >>> 0, l = an(tn, e);
    if (l.get(i) === a) {
      Ze++;
      return;
    }
    l.set(i, a), ee(24, e, i, a), Fe++;
  }
  function Fi(e, r, n) {
    const i = ot(r), a = an(rn, e);
    if (a.get(i) === n) {
      Ze++;
      return;
    }
    a.set(i, n), Ot[0] = n, ee(25, e, i, tr[0]), Fe++;
  }
  var sn = 255, Oi = new Set;
  function Ci(e, r, n) {
    const i = ot(r), a = n == null ? "" : String(n), l = an(nn, e);
    if (l.get(i) === a) {
      Ze++;
      return;
    }
    l.set(i, a), it(a);
    const c = Ye;
    let g = Ve;
    if (g > sn) {
      for (g = sn;g > 0 && (jr[4194368 + c + g] & 192) === 128; )
        g--;
      ee(26, e, i, (c & 16777215) << 8 | g), Fe++, Oi.has(r) || (Oi.add(r), console.warn(`Skal: custom prop "${r}" is ${Ve} UTF-8 bytes; the wire format carries at most ${sn}. Truncated to ${g}. Use an enum-keyed prop, or split the value across several props.`));
      return;
    }
    ee(26, e, i, (c & 16777215) << 8 | g), Fe++;
  }
  function $a(e, r) {
    const n = ot(r);
    tn.get(e)?.delete(n), rn.get(e)?.delete(n), nn.get(e)?.delete(n), ee(44, e, n, 0);
  }
  function Pa(e, r, n) {
    ee(27, e, ot(r), n);
  }
  var ht = new Map, He = new Map, ln = globalThis.__skalNextCallId || 1;
  function Ii(e, r, n) {
    try {
      it(r);
    } catch {
      return console.warn(`[skal] RPC arg dropped: string/JSON arg exceeds the string heap (${r.length} chars). Pass a path or handle instead of bulk bytes \u2014 see PERFORMANCE.md payload law.`), false;
    }
    const i = Ye >>> 0;
    return ee(29, e, n | (Ve & 16777215) << 8, i), true;
  }
  function Di(e, r) {
    for (let n = 0;n < r.length; n++) {
      const i = r[n];
      if (typeof i == "number")
        if (Number.isInteger(i) && i >= -2147483648 && i <= 2147483647)
          ee(29, e, 1, i | 0);
        else if (!Number.isInteger(i) && Math.fround(i) === i)
          Ot[0] = i, ee(29, e, 2, tr[0]);
        else if (Number.isFinite(i)) {
          it(String(i));
          const a = Ye >>> 0;
          ee(29, e, 5 | (Ve & 16777215) << 8, a);
        } else
          ee(29, e, 0, 0);
      else if (typeof i == "boolean")
        ee(29, e, 3, i ? 1 : 0);
      else if (typeof i == "string")
        Ii(e, i, 4) || ee(29, e, 0, 0);
      else if (i !== null && typeof i == "object") {
        let a;
        try {
          a = JSON.stringify(i);
        } catch {
          a = undefined;
        }
        (a === undefined || !Ii(e, a, 5)) && ee(29, e, 0, 0);
      } else
        ee(29, e, 0, 0);
    }
  }
  function gt(e, r, n) {
    const i = ot(r), a = ln++;
    return Di(a, n), ee(28, e, i, a), yi(e), te(), new Promise((l, c) => {
      ht.set(a, { resolve: l, reject: c });
    });
  }
  function Aa(e, r, n, i, a) {
    const l = ot(r), c = ln++;
    Di(c, n), ee(30, e, l, c), yi(e), te(), He.set(c, { nodeId: e, onValue: i, onError: a && a.onError, onDone: a && a.onDone });
    let g = Ft.get(e);
    return g === undefined && (g = new Set, Ft.set(e, g)), g.add(c), function() {
      He.has(c) && (He.delete(c), on(e, c), ee(31, c, 0, 0), te());
    };
  }
  function Fa(e) {
    const r = Ft.get(e);
    if (r !== undefined) {
      for (const n of r)
        He.has(n) && (He.delete(n), ee(31, n, 0, 0));
      Ft.delete(e), te();
    }
  }
  var xr = new Map, zi = globalThis.__skalNextHandlerId || 1;
  function kr(e) {
    const r = zi++;
    return xr.set(r, e), r;
  }
  function Tr(e) {
    xr.delete(e);
  }
  function Oa(e) {
    Qe = e && (e.stack || e.message || String(e)) || "unknown";
    try {
      console.error("skal:", Qe);
    } catch {}
  }
  function cn(e, r, n) {
    ee(21, e, r, n);
  }
  var un = 0n, Qe = null, dn = 1310736, Ca = 1572864, Ia = 65532, Li = new ArrayBuffer(4), fn = new Float32Array(Li), hn = new Uint32Array(Li), Da = new TextDecoder("utf-8");
  function gn(e, r) {
    return r === 0 ? "" : Da.decode(jr.subarray(si + e, si + e + r));
  }
  function pn(e, r) {
    pe[Go] = e + r;
  }
  function Mi() {
    const e = Atomics.load(Yt, jo);
    if (e === un)
      return;
    const r = dn + (pe[Uo] >> 2);
    let n = dn + (pe[di] >> 2);
    const i = Ca, a = dn;
    let l = Ia;
    for (;n !== r && l-- > 0; ) {
      const c = pe[n + 0], g = c & 255, f = c >>> 8 & 255, _ = pe[n + 1], x = pe[n + 2], y = pe[n + 3];
      let P, p = false;
      if (f === 1)
        P = x | 0, p = true;
      else if (f === 2)
        hn[0] = x, P = fn[0], p = true;
      else if (f === 3)
        P = x !== 0, p = true;
      else if (f === 4)
        P = gn(y, x), p = true, pn(y, x);
      else if (f === 5) {
        const I = gn(y, x);
        try {
          P = JSON.parse(I);
        } catch {
          P = I;
        }
        p = true, pn(y, x);
      } else if (f === 6) {
        const I = gn(y, x);
        try {
          P = JSON.parse(I);
        } catch {
          P = [];
        }
        p = true, pn(y, x);
      } else if (f === 7) {
        hn[0] = x;
        const I = fn[0];
        hn[0] = y, P = [I, fn[0]], p = true;
      }
      if (g === 3) {
        const I = ht.get(_);
        if (I) {
          ht.delete(_);
          try {
            I.resolve(p ? P : undefined);
          } catch (T) {
            Qe = T && (T.stack || T.message || String(T)) || "unknown";
          }
        }
      } else if (g === 4) {
        const I = ht.get(_);
        if (I) {
          ht.delete(_);
          try {
            const T = typeof P == "string" ? P : `skal RPC error (status ${P})`;
            I.reject(new Error(T));
          } catch (T) {
            Qe = T && (T.stack || T.message || String(T)) || "unknown";
          }
        }
      } else if (g === 5) {
        const I = He.get(_);
        if (I)
          try {
            I.onValue(p ? P : undefined);
          } catch (T) {
            Qe = T && (T.stack || T.message || String(T)) || "unknown";
          }
      } else if (g === 6) {
        const I = He.get(_);
        if (I) {
          He.delete(_), on(I.nodeId, _);
          try {
            I.onDone && I.onDone();
          } catch (T) {
            Qe = T && (T.stack || T.message || String(T)) || "unknown";
          }
        }
      } else if (g === 7) {
        const I = He.get(_);
        if (I) {
          He.delete(_), on(I.nodeId, _);
          try {
            I.onError && I.onError(new Error(typeof P == "string" ? P : "skal stream error"));
          } catch (T) {
            Qe = T && (T.stack || T.message || String(T)) || "unknown";
          }
        }
      } else {
        const I = xr.get(_);
        if (I)
          try {
            p ? (f === 6 || f === 7) && Array.isArray(P) ? I(...P) : I(P) : I();
          } catch (T) {
            Qe = T && (T.stack || T.message || String(T)) || "unknown";
          }
      }
      n += 4, n >= i && (n = a);
    }
    pe[di] = n - a << 2, un = e;
  }
  if (vr && typeof window > "u" && !globalThis.__skalRelease) {
    const e = Wo();
    e.setDrain(Mi), e.configure({ cleanup() {
      globalThis.__skalNextCallId = ln, globalThis.__skalNextHandlerId = zi;
      for (const r of ht.values())
        try {
          r.reject(new Error("skal: hot reload"));
        } catch {}
      ht.clear();
    } });
  } else
    globalThis.__skal_drainEvents = Mi;
  globalThis.skalStatus = () => JSON.stringify({ handlerCount: xr.size, opSeq: Number(Zt), lastEventSeq: Number(un), lastHandlerError: Qe, propWrites: Fe, propSkips: Ze });
  var cf = 1, za = 2;
  function Ni() {
    return za++;
  }
  var La = { box: 0, column: 1, scrollView: 5, listView: 6, reorderableListView: 7, row: 2, text: 3, button: 4, image: 9, stack: 10, switch: 11, slider: 12, checkbox: 13, activityIndicator: 14, progressBar: 15, lazyGrid: 16, wrap: 17, safeArea: 18, richText: 19, textInput: 20, navigator: 21, screen: 22, tabs: 23, tab: 24, animatedList: 25, crossFade: 26, hero: 27, listTile: 28, pageView: 29, dismissible: 30, customScrollView: 31, sliverAppBar: 32, sliverList: 33, sliverGrid: 34, canvas: 35, dragItem: 36, dropZone: 37, radio: 38, chip: 39, segmentedButton: 40, expansionTile: 41, dropdown: 42, stepper: 43, step: 44, drawer: 45, bottomSheet: 46, backdropFilter: 47, interactiveViewer: 48, htmlEmbed: 49 };
  function Ma() {
    const e = [], r = { _cmds: e, fillStyle(n) {
      return e.push(["fillStyle", bn(n)]), r;
    }, strokeStyle(n) {
      return e.push(["strokeStyle", bn(n)]), r;
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
  var Na = { padding: [0, "u32"], paddingTop: [1, "u32"], paddingRight: [2, "u32"], paddingBottom: [3, "u32"], paddingLeft: [4, "u32"], width: [5, "dim"], height: [6, "dim"], weight: [7, "f32"], alignment: [8, "u32"], gap: [9, "u32"], axis: [10, "u32"], top: [11, "u32"], right: [12, "u32"], bottom: [13, "u32"], left: [14, "u32"], crossAxisCount: [15, "u32"], aspectRatio: [16, "f32"], background: [32, "color"], color: [33, "color"], cornerRadius: [34, "u32"], borderWidth: [35, "u32"], borderColor: [36, "color"], shadow: [37, "u32"], fontSize: [64, "u32"], fontWeight: [65, "u32"], fontFamily: [66, "u32"], textAlign: [67, "u32"], lineHeight: [68, "u32"], maxLines: [69, "u32"], textOverflow: [70, "u32"], src: [96, "str"], contentScale: [97, "u32"], placeholder: [128, "str"], value: [129, "str"], keyboardType: [130, "u32"], secureEntry: [131, "u32"], checked: [132, "u32"], min: [134, "f32"], max: [135, "f32"], progress: [136, "f32"], initialSize: [176, "f32"], minSize: [177, "f32"], maxSize: [178, "f32"], presentation: [166, "u32"], title: [71, "str"], icon: [98, "str"], leadingIcon: [98, "str"], subtitle: [73, "str"], trailingIcon: [99, "str"], activeTab: [137, "u32"], tag: [72, "str"], transition: [171, "u32"], enabled: [160, "u32"], focusable: [161, "u32"], visible: [162, "u32"], draggable: [172, "u32"], spring: [173, "u32"], release: [174, "u32"], sliverMode: [175, "u32"], dragData: [74, "str"], scrollbar: [179, "u32"], blurRadius: [180, "u32"], minScale: [181, "f32"], maxScale: [182, "f32"], viewType: [183, "str"], semanticLabel: [75, "str"], testID: [76, "str"] }, Ba = { opacity: ua, translationX: da, translationY: fa, scaleX: ha, scaleY: ga, rotation: pa }, Va = { opacity: 1, translationX: 0, translationY: 0, scaleX: 1, scaleY: 1, rotation: 0 }, Wa = { onClick: 1, onclick: 1, onTap: 1, onLongPress: 8, onDoubleTap: 9, onChange: 2, onSubmit: 10, onReorder: 11, onPop: 12, onDismiss: 20, onPanStart: 13, onPanUpdate: 14, onPanEnd: 15, onScaleStart: 16, onScaleUpdate: 17, onScaleEnd: 18, onDrop: 21, onHover: 22, onKey: 23 }, Ha = { linear: 0, easeIn: 1, easeOut: 2, easeInOut: 3, bounce: 4, elastic: 5, fastOutSlowIn: 6 }, Ua = { gentle: 1, bouncy: 2, stiff: 3 };
  function bn(e) {
    if (typeof e == "number")
      return e | 0;
    if (typeof e != "string")
      return 0;
    let r = e.trim();
    r.startsWith("#") && (r = r.slice(1));
    let n = 0, i = 0, a = 0, l = 255;
    return r.length === 3 ? (n = parseInt(r[0] + r[0], 16), i = parseInt(r[1] + r[1], 16), a = parseInt(r[2] + r[2], 16)) : r.length === 4 ? (n = parseInt(r[0] + r[0], 16), i = parseInt(r[1] + r[1], 16), a = parseInt(r[2] + r[2], 16), l = parseInt(r[3] + r[3], 16)) : r.length === 6 ? (n = parseInt(r.slice(0, 2), 16), i = parseInt(r.slice(2, 4), 16), a = parseInt(r.slice(4, 6), 16)) : r.length === 8 && (l = parseInt(r.slice(0, 2), 16), n = parseInt(r.slice(2, 4), 16), i = parseInt(r.slice(4, 6), 16), a = parseInt(r.slice(6, 8), 16)), (l & 255) << 24 | (n & 255) << 16 | (i & 255) << 8 | a & 255 | 0;
  }
  function Ga(e) {
    return typeof e == "number" ? e | 0 : e === "fill" ? qo : e === "wrap" ? Xo : -1;
  }
  function ja(e) {
    if (Array.isArray(e))
      return true;
    const r = Object.getPrototypeOf(e);
    return r === Object.prototype || r === null;
  }
  function qa(e, r) {
    return e === "number" ? "num" : e === "boolean" ? "bool" : e === "string" ? "str" : e === "object" ? "json" : null;
  }
  function Xa(e, r, n) {
    if (n == null)
      return;
    if (r === "ref" && n && typeof n.__skalBind == "function") {
      n.__skalBind(e.id);
      return;
    }
    const i = typeof n, a = qa(i, n);
    if (a !== null) {
      const l = e._skalPropKinds || (e._skalPropKinds = {}), c = l[r];
      c !== undefined && c !== a && $a(e.id, r), l[r] = a;
    }
    if (i === "object" && ja(n)) {
      Ci(e.id, r, JSON.stringify(n)), te();
      return;
    }
    if (i === "function") {
      if (Ja(e.tag, r)) {
        e._skalRowCount = 2147483647, e._skalRowOverscan = 0, Wi(e, n);
        return;
      }
      const l = kr(n);
      Pa(e.id, r, l), jt() && dt(() => Tr(l)), te();
      return;
    }
    if (i === "number") {
      Number.isInteger(n) && n >= 0 && n <= 4294967295 && Ai(e.id, r, n | 0), Fi(e.id, r, n), te();
      return;
    }
    if (i === "string") {
      Ci(e.id, r, n), te();
      return;
    }
    if (i === "boolean") {
      Ai(e.id, r, n ? 1 : 0), te();
      return;
    }
  }
  function _n(e) {
    const r = [e];
    for (;r.length > 0; ) {
      const n = r.pop();
      sa(n.id);
      let i = n.firstChild;
      for (;i; )
        r.push(i), i = i.nextSibling;
    }
  }
  var Ka = 8, Bi = 300, vn = new Set, Vi = false;
  function Ya() {
    const e = globalThis.__SKAL_BUILDER_PROPS__;
    if (!(!e || typeof e != "object")) {
      Vi = true;
      for (const r of Object.keys(e)) {
        const n = e[r];
        if (Array.isArray(n))
          for (const i of n)
            vn.add(`${r}:${i}`);
      }
    }
  }
  function Ja(e, r) {
    return Vi || Ya(), vn.size === 0 ? false : vn.has(`${e}:${r}`);
  }
  function Wi(e, r) {
    const n = e._skalRenderItem && e._skalRenderItem !== r;
    if (e._skalRenderItem = r, e._skalRows) {
      n && es(e);
      return;
    }
    e._skalRows = new Map;
    const i = kr((...a) => Qa(e, a));
    e._skalRowHandlerId = i, cn(e.id, 24, i), jt() && dt(() => Hi(e)), te();
  }
  function Za(e, r) {
    const n = e._skalRows;
    et((i) => {
      const a = s("box");
      B(a, () => {
        try {
          return e._skalRenderItem(r);
        } catch (l) {
          return Oa(l), null;
        }
      }), wa(e.id, r, a.id), n.set(r, { el: a, dispose: i });
    });
  }
  function Qa(e, r) {
    const n = e._skalRows, i = e._skalRowCount | 0;
    if (!e._skalRenderItem || !n || i <= 0 || !r.length)
      return;
    let a = 1 / 0, l = -1 / 0;
    const c = new Set;
    for (const _ of r) {
      const x = _ | 0;
      if (x < 0 || x >= i)
        continue;
      x < a && (a = x), x > l && (l = x);
      const y = e._skalRowOverscan ?? Ka, P = Math.max(0, x - y), p = Math.min(i - 1, x + y);
      for (let I = P;I <= p; I++)
        c.add(I);
    }
    if (l < 0)
      return;
    for (const _ of c)
      n.has(_) || Za(e, _);
    const g = a - Bi, f = l + Bi;
    for (const [_, x] of n)
      _ >= g && _ <= f && _ < i || (n.delete(_), mn(e, _, x));
    te();
  }
  function mn(e, r, n) {
    Sa(e.id, r), _n(n.el);
    try {
      n.dispose();
    } catch {}
  }
  function es(e) {
    const r = e._skalRows;
    if (r) {
      for (const [n, i] of r)
        mn(e, n, i);
      r.clear(), te();
    }
  }
  function Hi(e) {
    const r = e._skalRows;
    if (r) {
      e._skalRows = null, e._skalRenderItem = null, e._skalRowHandlerId && (Tr(e._skalRowHandlerId), e._skalRowHandlerId = 0);
      for (const n of r.values()) {
        _n(n.el);
        try {
          n.dispose();
        } catch {}
      }
      r.clear();
    }
  }
  var Er = class {
    constructor(e, r, n = false, i = false) {
      this.tag = e, this.id = r, this.isText = n, this.isCustom = i, this.parent = null, this.firstChild = null, this.lastChild = null, this.nextSibling = null, this.prevSibling = null, this.text = "";
    }
  }, ts = oi({ createElement(e) {
    const r = Ni(), n = La[e];
    return n !== undefined ? (ee(1, r, n, 0), te(), new Er(e, r, false, false)) : (Ra(r, e), te(), new Er(e, r, false, true));
  }, createTextNode(e) {
    const r = Ni();
    ee(1, r, 3, 0);
    const n = e == null ? "" : String(e);
    n.length > 0 && wr(r, n), te();
    const i = new Er("#text", r, true);
    return i.text = n, i;
  }, replaceText(e, r) {
    const n = r == null ? "" : String(r);
    e.text !== n && (e.text = n, wr(e.id, n), te());
  }, setProperty(e, r, n, i) {
    if (e.isCustom) {
      Xa(e, r, n);
      return;
    }
    if (r === "onRefresh") {
      if (typeof n == "function") {
        const g = e.id, f = n, x = kr(async () => {
          try {
            await f();
          } finally {
            ma(g);
          }
        });
        cn(e.id, 19, x), jt() && dt(() => Tr(x)), te();
      }
      return;
    }
    if (r === "renderItem" && e.tag === "listView") {
      typeof n == "function" && Wi(e, n);
      return;
    }
    if (r === "count" && e.tag === "listView") {
      const g = Math.max(0, n | 0), f = e._skalRowCount | 0;
      e._skalRowCount = g, we(e.id, 17, g);
      const _ = e._skalRows;
      if (_ && g < f)
        for (const [x, y] of _)
          x < g || (_.delete(x), mn(e, x, y));
      te();
      return;
    }
    if (r === "draw" && typeof n == "function") {
      const g = n, f = e;
      Et(() => {
        const _ = Ma();
        try {
          g(_);
        } catch {}
        const x = JSON.stringify(_._cmds);
        x !== f._skalCanvasProgram && (f._skalCanvasProgram = x, wr(f.id, x), te());
      });
      return;
    }
    const a = Wa[r];
    if (a !== undefined) {
      if (typeof n == "function") {
        const g = kr(n);
        cn(e.id, a, g), jt() && dt(() => Tr(g)), te();
      }
      return;
    }
    if (r === "value" && e.tag === "slider") {
      Ei(e.id, 133, Number(n) || 0), te();
      return;
    }
    if (r === "draggable" && typeof n == "string") {
      we(e.id, 172, { free: 1, both: 1, horizontal: 2, x: 2, vertical: 3, y: 3 }[n] ?? 0), te();
      return;
    }
    if (r === "spring" && typeof n == "string") {
      we(e.id, 173, { gentle: 1, bouncy: 2, stiff: 3, wobbly: 2 }[n] ?? 0), te();
      return;
    }
    if (r === "release" && typeof n == "string") {
      we(e.id, 174, { none: 0, glide: 1, friction: 1, springback: 2, spring: 2 }[n.toLowerCase()] ?? 0), te();
      return;
    }
    if (r === "sliverMode" && typeof n == "string") {
      we(e.id, 175, { normal: 0, pinned: 1, floating: 2, both: 3 }[n.toLowerCase()] ?? 0), te();
      return;
    }
    if (r === "animate" && n && typeof n == "object") {
      if (we(e.id, 163, n.duration | 0), n.curve != null) {
        const g = typeof n.curve == "string" ? Ha[n.curve] ?? 0 : n.curve | 0;
        we(e.id, 164, g);
      }
      if (n.delay != null && we(e.id, 165, n.delay | 0), n.repeat != null && we(e.id, 167, n.repeat ? 1 : 0), n.reverse != null && we(e.id, 168, n.reverse ? 1 : 0), n.loop != null && we(e.id, 169, n.loop | 0), n.spring != null) {
        const g = typeof n.spring == "string" ? Ua[n.spring] ?? 0 : n.spring ? 2 : 0;
        we(e.id, 170, g);
      }
      te();
      return;
    }
    if (r === "label" && (e.tag === "button" || e.tag === "text" || e.tag === "chip")) {
      const g = n == null ? "" : String(n);
      wr(e.id, g), te();
      return;
    }
    const l = Ba[r];
    if (l !== undefined) {
      typeof n == "number" ? (l(e.id, n), te()) : n == null && (l(e.id, Va[r]), te());
      return;
    }
    const c = Na[r];
    if (c !== undefined) {
      const [g, f] = c;
      if (n == null) {
        la(e.id, g), te();
        return;
      }
      switch (f) {
        case "u32":
          typeof n == "number" ? (we(e.id, g, n | 0), te()) : typeof n == "boolean" && (we(e.id, g, n ? 1 : 0), te());
          return;
        case "f32":
          typeof n == "number" && (Ei(e.id, g, n), te());
          return;
        case "str":
          ca(e.id, g, String(n)), te();
          return;
        case "color":
          we(e.id, g, bn(n)), te();
          return;
        case "dim":
          we(e.id, g, Ga(n)), te();
          return;
      }
      return;
    }
    if (r === "style" && n && typeof n == "object") {
      for (const g in n)
        this.setProperty(e, g, n[g]);
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
    ee(3, e.id, r.id, i), te(), r.parent = e, n ? (r.nextSibling = n, r.prevSibling = n.prevSibling, n.prevSibling ? n.prevSibling.nextSibling = r : e.firstChild = r, n.prevSibling = r) : (r.prevSibling = e.lastChild, r.nextSibling = null, e.lastChild ? e.lastChild.nextSibling = r : e.firstChild = r, e.lastChild = r);
  }, removeNode(e, r) {
    r._skalRows && Hi(r), ee(2, r.id, 0, 0), _n(r), te(), r.prevSibling ? r.prevSibling.nextSibling = r.nextSibling : e.firstChild = r.nextSibling, r.nextSibling ? r.nextSibling.prevSibling = r.prevSibling : e.lastChild = r.prevSibling, r.parent = null, r.prevSibling = null, r.nextSibling = null;
  }, isTextNode(e) {
    return e.isText;
  }, getParentNode(e) {
    return e.parent;
  }, getFirstChild(e) {
    return e.firstChild;
  }, getNextSibling(e) {
    return e.nextSibling;
  } }), { render: wn, effect: q, memo: Sn, createComponent: M, createElement: s, createTextNode: uf, insertNode: v, insert: B, spread: df, setProp: t, mergeProps: ff, use: rs } = ts;
  ee(1, 1, 0, 0), te();
  var yn = new Er("box", 1, false);
  globalThis.__skalHot && globalThis.__skalHot.configure({ render: (e) => wn(e, yn), reset: () => ra() });
  var Ui = "/flutter-web-plugins", It = null;
  async function Gi() {
    return It || (globalThis.__skalPluginCall ? (It = Promise.resolve(), It) : (It = ns(), It));
  }
  async function ns() {
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
    n.src = `${Ui}/flutter_bootstrap.js`, n.async = true;
    const i = new Promise((a, l) => {
      n.onerror = () => l(new Error(`Skal plugin bridge: failed to load ${n.src}. Did you build the plugin host (\`bun run build:flutter-plugins\`) and is the vite middleware (Phase 3) serving ${Ui}/*?`));
    });
    if (document.head.appendChild(n), await Promise.race([r, i]), typeof globalThis.__skalPluginCall != "function")
      throw new Error(`Skal plugin bridge: host signaled ready but __skalPluginCall is not a function (got ${typeof globalThis.__skalPluginCall}).`);
  }
  var xn = Promise.resolve();
  async function is(e) {
    await Gi();
    const r = globalThis.__skalFlutterApp;
    if (!r || typeof r.addView != "function")
      throw new Error("Skal plugin bridge: addView not available. Multi-view requires Flutter Web 3.10+ with multiViewEnabled:true in the bootstrap config.");
    return xn = xn.catch(() => {}).then(async () => {
      const n = await r.addView({ hostElement: e });
      return await new Promise((i) => requestAnimationFrame(i)), n;
    }), xn;
  }
  async function os(e) {
    const r = globalThis.__skalFlutterApp;
    !r || typeof r.removeView != "function" || await r.removeView(e);
  }
  async function kn(e, r) {
    await Gi();
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
  var as = { column: "div", scrollView: "div", listView: "div", reorderableListView: "div", row: "div", box: "div", text: "span", button: "button", image: "img", stack: "div", switch: "input", slider: "input", checkbox: "input", activityIndicator: "div", progressBar: "progress", lazyGrid: "div", wrap: "div", safeArea: "div", richText: "span", textInput: "input", navigator: "div", screen: "div", tabs: "div", tab: "div", animatedList: "div", crossFade: "div", hero: "div", listTile: "div", pageView: "div", dismissible: "div", flutterEmbed: "div", customScrollView: "div", sliverAppBar: "div", sliverList: "div", sliverGrid: "div", canvas: "canvas", dragItem: "div", dropZone: "div", radio: "input", chip: "div", segmentedButton: "div", expansionTile: "div", dropdown: "select", stepper: "div", step: "div", drawer: "aside", bottomSheet: "div", backdropFilter: "div", interactiveViewer: "div" };
  if (typeof document < "u" && !document.getElementById("skal-kf")) {
    const e = document.createElement("style");
    e.id = "skal-kf", e.textContent = "@keyframes skal-spin{to{transform:rotate(360deg)}}", document.head.appendChild(e);
  }
  var ss = { grid: "\u25A6", list: "\u2630", explore: "\u29BF", code: "\u27E8\u27E9", storage: "\u2630", home: "\u2302", settings: "\u2699", search: "\uD83D\uDD0D", user: "\u263B", heart: "\u2661", star: "\u2605", plus: "+" }, ls = "#0A84FF", cs = "#8E8E93", us = "#F2F2F7", ds = "#E5E5EA";
  function fs(e) {
    const r = [];
    for (const n of e.children)
      n._skalTag === "tab" && r.push(n);
    return r;
  }
  function hs(e) {
    let r = e._skalBar;
    return r && r.parentElement === e || (r = document.createElement("div"), r.setAttribute("role", "tablist"), r.style.cssText = `display:flex;flex-direction:row;align-items:stretch;flex:0 0 auto;border-top:1px solid ${ds};background:${us};padding:6px 4px;padding-bottom:calc(6px + env(safe-area-inset-bottom, 0px));min-height:50px;gap:4px;user-select:none;box-sizing:border-box;`, e.appendChild(r), e._skalBar = r), r;
  }
  function gs(e) {
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
  async function ps(e) {
    return e._skalViewPromise || (e._skalViewPromise = (async () => {
      if (await gs(e), e._skalEmbedRemoved)
        throw new Error("Skal <flutterEmbed>: removed before view could be added");
      const r = await is(e);
      return typeof window < "u" && requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      }), r;
    })()), e._skalViewPromise;
  }
  function Tn(e) {
    e._skalSyncScheduled || (e._skalSyncScheduled = true, queueMicrotask(async () => {
      e._skalSyncScheduled = false;
      const r = e._skalEmbedWidget;
      if (r)
        try {
          const n = await ps(e);
          if (e._skalEmbedRemoved)
            return;
          await kn("embed.setSpec", { viewId: n, widget: r, props: e._skalEmbedProps || {} });
        } catch (n) {
          console.error(`Skal <flutterEmbed widget="${r}"> failed:`, n);
        }
    }));
  }
  async function bs(e) {
    if (e._skalEmbedRemoved = true, !!e._skalViewPromise)
      try {
        const r = await e._skalViewPromise;
        try {
          await kn("embed.unsetSpec", { viewId: r });
        } catch {}
        await os(r);
      } catch (r) {
        console.warn("Skal <flutterEmbed> teardown failed:", r);
      }
  }
  function Rr(e) {
    e._skalTabsRenderScheduled || (e._skalTabsRenderScheduled = true, queueMicrotask(() => {
      e._skalTabsRenderScheduled = false, _s(e);
    }));
  }
  function _s(e) {
    const r = fs(e), n = e._skalActiveTab | 0, i = r.length === 0 ? 0 : Math.min(Math.max(n, 0), r.length - 1);
    for (let l = 0;l < r.length; l++) {
      const c = r[l];
      l === i ? (c.style.display = "flex", c.style.flexDirection = "column", c.style.flex = "1 1 auto", c.style.minHeight = "0", c.style.overflow = "auto") : c.style.display = "none";
    }
    const a = hs(e);
    a.innerHTML = "";
    for (let l = 0;l < r.length; l++) {
      const c = r[l], g = l === i, f = document.createElement("button");
      f.type = "button", f.setAttribute("role", "tab"), f.setAttribute("aria-selected", g ? "true" : "false"), f.style.cssText = "flex:1 1 0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:transparent;border:0;cursor:pointer;font:inherit;padding:4px 2px;gap:2px;line-height:1.15;font-size:11px;color:" + (g ? ls : cs) + ";";
      const _ = c._skalIcon;
      if (_) {
        const y = document.createElement("span");
        y.textContent = ss[_] || "\u25CF", y.style.cssText = "font-size:20px;line-height:1;", f.appendChild(y);
      }
      const x = c._skalTitle;
      if (x) {
        const y = document.createElement("span");
        y.textContent = x, f.appendChild(y);
      }
      f.onclick = () => {
        const y = e._skalOnChange;
        typeof y == "function" && y(l);
      }, a.appendChild(f);
    }
  }
  function vs(e, r) {
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
        n.display = "flex", n.flexDirection = "row", n.boxSizing = "border-box";
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
  var ms = ["contain", "cover", "fill", "contain", "contain", "none", "scale-down"];
  function En(e) {
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
  function ji(e) {
    return typeof e == "number" ? `${e}px` : e === "fill" ? "100%" : e === "wrap" ? "auto" : typeof e == "string" ? e : null;
  }
  var qi = { 0: 'system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, sans-serif', 1: '"Times New Roman", Times, serif', 2: 'ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace', 3: 'system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, sans-serif' }, ws = { linear: 0, easeIn: 1, easeOut: 2, easeInOut: 3, bounce: 4, elastic: 5, fastOutSlowIn: 6 }, Ss = ["linear", "ease-in", "ease-out", "ease-in-out", "cubic-bezier(.4,0,.2,1)", "cubic-bezier(.4,0,.2,1)", "cubic-bezier(.4,0,.2,1)"], ys = ["start", "center", "end", "justify"], xs = ["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"];
  function at(e) {
    return e._skalHot || (e._skalHot = { tx: 0, ty: 0, sx: 1, sy: 1, rz: 0 }, e.style.willChange = "transform, opacity"), e._skalHot;
  }
  function Ue(e) {
    const r = e._skalHot;
    if (r) {
      if (r.tx === 0 && r.ty === 0 && r.sx === 1 && r.sy === 1 && r.rz === 0) {
        e.style.transform = "", e.style.willChange = "", e._skalHot = null;
        return;
      }
      e.style.transform = `translate(${r.tx}px, ${r.ty}px) scale(${r.sx}, ${r.sy}) rotate(${r.rz}deg)`;
    }
  }
  function Rn(e) {
    if (e._skalGAttached)
      return;
    e._skalGAttached = true, e.style.touchAction = "none";
    const r = new Map;
    let n = -1, i = 0, a = 0, l = 0, c = 0, g = 0, f = 1, _ = 0, x = false;
    e.addEventListener("pointerdown", (P) => {
      const p = e._skalG;
      if (!p)
        return;
      r.set(P.pointerId, { x: P.clientX, y: P.clientY });
      const I = p.scaleStart || p.scaleUpdate || p.scaleEnd;
      if (r.size === 2 && I) {
        const [F, L] = [...r.values()];
        f = Math.hypot(F.x - L.x, F.y - L.y) || 1, _ = Math.atan2(L.y - F.y, L.x - F.x), x = true, p.scaleStart && p.scaleStart();
        return;
      }
      const T = p.panStart || p.panUpdate || p.panEnd || p.draggable;
      if (n === -1 && T && !I) {
        e._skalReleaseCancel && (e._skalReleaseCancel(), e._skalReleaseCancel = null), n = P.pointerId, e.setPointerCapture(P.pointerId);
        const F = e.getBoundingClientRect();
        i = P.clientX, a = P.clientY, l = P.timeStamp, c = 0, g = 0, p.panStart && p.panStart(P.clientX - F.left, P.clientY - F.top);
      }
    }), e.addEventListener("pointermove", (P) => {
      const p = e._skalG;
      if (!p)
        return;
      if (r.has(P.pointerId) && r.set(P.pointerId, { x: P.clientX, y: P.clientY }), x && r.size >= 2) {
        const [L, k] = [...r.values()], A = Math.hypot(L.x - k.x, L.y - k.y), h = Math.atan2(k.y - L.y, k.x - L.x) - _;
        p.scaleUpdate && p.scaleUpdate(A / f, h);
        return;
      }
      if (P.pointerId !== n)
        return;
      const I = P.clientX - i, T = P.clientY - a, F = Math.max(1, P.timeStamp - l);
      if (c = I / F * 1000, g = T / F * 1000, i = P.clientX, a = P.clientY, l = P.timeStamp, p.draggable) {
        const L = at(e);
        p.draggable !== 3 && (L.tx += I), p.draggable !== 2 && (L.ty += T), Ue(e);
      } else
        p.panUpdate && p.panUpdate(I, T);
    });
    const y = (P) => {
      const p = e._skalG;
      if (r.delete(P.pointerId), x && r.size < 2 && (x = false, p && p.scaleEnd && p.scaleEnd()), P.pointerId === n && (n = -1, !!p)) {
        if (p.draggable && p.release)
          ks(e, p, c, g);
        else if (p.panEnd)
          if (p.draggable) {
            const I = e._skalHot || { tx: 0, ty: 0 };
            p.panEnd(I.tx, I.ty);
          } else
            p.panEnd(c, g);
      }
    };
    e.addEventListener("pointerup", y), e.addEventListener("pointercancel", y);
  }
  function ks(e, r, n, i) {
    const a = at(e), l = r.release === 2, c = 2 * Math.sqrt(200) * 0.7;
    r.draggable === 2 && (i = 0), r.draggable === 3 && (n = 0);
    let g = performance.now(), f = 0;
    const _ = (x) => {
      let y = (x - g) / 1000;
      if (g = x, y > 0.05 && (y = 0.05), l) {
        if (n += (-200 * a.tx - c * n) * y, i += (-200 * a.ty - c * i) * y, a.tx += n * y, a.ty += i * y, Math.abs(a.tx) < 0.5 && Math.abs(a.ty) < 0.5 && Math.abs(n) < 5 && Math.abs(i) < 5) {
          a.tx = 0, a.ty = 0, Ue(e), e._skalReleaseCancel = null, r.panEnd && r.panEnd(0, 0);
          return;
        }
      } else {
        const P = Math.exp(-3 * y);
        if (n *= P, i *= P, a.tx += n * y, a.ty += i * y, Math.abs(n) < 5 && Math.abs(i) < 5) {
          Ue(e), e._skalReleaseCancel = null, r.panEnd && r.panEnd(a.tx, a.ty);
          return;
        }
      }
      Ue(e), f = requestAnimationFrame(_);
    };
    e._skalReleaseCancel = () => {
      f && cancelAnimationFrame(f);
    }, f = requestAnimationFrame(_);
  }
  var Ts = { onPanStart: "panStart", onPanUpdate: "panUpdate", onPanEnd: "panEnd", onScaleStart: "scaleStart", onScaleUpdate: "scaleUpdate", onScaleEnd: "scaleEnd" }, Es = { free: 1, both: 1, horizontal: 2, x: 2, vertical: 3, y: 3 }, Rs = { none: 0, glide: 1, friction: 1, springback: 2, spring: 2 }, $s = { gentle: 1, bouncy: 2, stiff: 3, wobbly: 2 }, se = (...e) => (r, n) => {
    for (let i = 0;i < e.length; i++)
      n[e[i]] = "";
  }, rr = (e, r) => (n) => {
    at(n)[e] = r, Ue(n);
  }, Ps = { padding: se("padding"), paddingTop: se("paddingTop"), paddingRight: se("paddingRight"), paddingBottom: se("paddingBottom"), paddingLeft: se("paddingLeft"), width: se("width"), height: se("height"), weight: se("flexGrow"), gap: se("gap"), alignment: se("justifyContent"), axis: se("flexDirection", "overflowX", "overflowY"), crossAxisCount: se("gridTemplateColumns"), aspectRatio: () => {}, top: (e, r) => {
    r.top = "", $r(r);
  }, right: (e, r) => {
    r.right = "", $r(r);
  }, bottom: (e, r) => {
    r.bottom = "", $r(r);
  }, left: (e, r) => {
    r.left = "", $r(r);
  }, background: se("background"), color: se("color"), cornerRadius: se("borderRadius"), borderWidth: (e, r) => {
    r.borderWidth = "", r.borderColor || (r.borderStyle = "");
  }, borderColor: (e, r) => {
    r.borderColor = "", r.borderWidth || (r.borderStyle = "");
  }, shadow: se("boxShadow"), fontSize: se("fontSize"), fontWeight: se("fontWeight"), fontFamily: se("fontFamily"), textAlign: se("textAlign"), lineHeight: se("lineHeight"), maxLines: se("display", "webkitLineClamp", "webkitBoxOrient", "overflow"), textOverflow: se("textOverflow", "overflow"), src: (e) => {
    e._skalTag === "image" && e.removeAttribute("src");
  }, contentScale: se("objectFit"), checked: (e) => {
    e.checked = false;
  }, min: (e) => {
    e.removeAttribute("min");
  }, max: (e) => {
    e.removeAttribute("max");
  }, progress: (e) => {
    e.removeAttribute("value");
  }, placeholder: (e) => {
    e._skalTag !== "button" && (e.placeholder = "");
  }, value: (e) => {
    e._skalTag !== "button" && (e.value = "");
  }, secureEntry: (e) => {
    e._skalTag === "textInput" && (e.type = "text");
  }, keyboardType: (e) => {
    e.inputMode = "text";
  }, enabled: (e) => {
    e.disabled = false;
  }, focusable: (e) => {
    e.removeAttribute("tabindex");
  }, visible: se("display"), opacity: se("opacity"), translationX: rr("tx", 0), translationY: rr("ty", 0), scaleX: rr("sx", 1), scaleY: rr("sy", 1), rotation: rr("rz", 0) };
  function $r(e) {
    !e.top && !e.right && !e.bottom && !e.left && (e.position = "");
  }
  function As(e, r) {
    const n = Ps[r];
    n !== undefined && n(e, e.style);
  }
  function Fs(e, r, n) {
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
        const a = ji(n);
        a != null && (i.width = a);
        return;
      }
      case "height": {
        const a = ji(n);
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
        const a = xs[n];
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
        const a = En(n);
        a && (i.background = a);
        return;
      }
      case "color": {
        const a = En(n);
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
        const a = En(n);
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
        i.fontFamily = qi[n] || qi[0];
        return;
      case "textAlign":
        i.textAlign = ys[n] || "start";
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
        i.objectFit = ms[n] || "contain";
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
        at(e).tx = n, Ue(e);
        return;
      case "translationY":
        at(e).ty = n, Ue(e);
        return;
      case "scaleX":
        at(e).sx = n, Ue(e);
        return;
      case "scaleY":
        at(e).sy = n, Ue(e);
        return;
      case "rotation":
        at(e).rz = n, Ue(e);
        return;
    }
  }
  var Xi = new Set;
  function Os(e) {
    Xi.has(e) || (Xi.add(e), console.warn(`Skal web: unknown intrinsic <${e}> \u2014 rendering placeholder. Custom widgets / Flutter plugins need the B.5 plugin host (WEB_SUPPORT_PLAN.md Phases 1\u20135).`));
  }
  var $n = 1500, Ki = false;
  function Yi(e) {
    e._skalBuilderTeardownArmed || (e._skalBuilderTeardownArmed = true, jt() && dt(() => Zi(e)));
  }
  function Ji(e) {
    e._skalBuilderSyncQueued || (e._skalBuilderSyncQueued = true, queueMicrotask(() => {
      e._skalBuilderSyncQueued = false, Cs(e);
    }));
  }
  function Cs(e) {
    const r = e._skalRenderItem;
    if (!r)
      return;
    const n = e._skalRows || (e._skalRows = new Map), i = e._skalRowCount | 0, a = Math.min(i, $n);
    i > $n && !Ki && (Ki = true, console.warn(`skal-web: builder-mode <ListView> renders eagerly on the DOM target \u2014 capped at ${$n} of ${i} rows (native virtualizes the full count).`));
    for (let l = e.firstChild;l; ) {
      const c = l.nextSibling;
      l._skalBuilderRow || e.removeChild(l), l = c;
    }
    for (const [l, c] of n)
      if (!(l < a)) {
        n.delete(l);
        try {
          c.el.remove();
        } catch {}
        try {
          c.dispose();
        } catch {}
      }
    for (let l = 0;l < a; l++)
      n.has(l) || et((c) => {
        const g = document.createElement("div");
        g._skalBuilderRow = true, Ls(g, () => {
          try {
            return r(l);
          } catch (f) {
            try {
              console.error("skal:", f);
            } catch {}
            return null;
          }
        }), e.appendChild(g), n.set(l, { el: g, dispose: c });
      });
  }
  function Zi(e) {
    const r = e._skalRows;
    if (r) {
      e._skalRenderItem = null;
      for (const n of r.values())
        try {
          n.dispose();
        } catch {}
      r.clear(), e._skalRows = null;
    }
  }
  var Is = oi({ createElement(e) {
    const r = as[e];
    if (r === undefined) {
      Os(e);
      const i = document.createElement("div");
      return i._skalTag = e, i.setAttribute("data-skal-unknown", e), i.style.outline = "1px dashed #d33", i.style.padding = "4px", i.style.color = "#d33", i.style.font = "11px ui-monospace, monospace", i.appendChild(document.createTextNode(`<${e}>`)), i;
    }
    const n = document.createElement(r);
    return n._skalTag = e, vs(n, e), n;
  }, createTextNode(e) {
    return document.createTextNode(e == null ? "" : String(e));
  }, replaceText(e, r) {
    e.data = r == null ? "" : String(r);
  }, setProperty(e, r, n, i) {
    const a = e._skalTag;
    if (a === "flutterEmbed") {
      if (r === "widget") {
        e._skalEmbedWidget = n == null ? "" : String(n), Tn(e);
        return;
      }
      if (r === "props") {
        e._skalEmbedProps = n && typeof n == "object" ? n : {}, Tn(e);
        return;
      }
    }
    if (a === "listView") {
      if (r === "renderItem") {
        e._skalRenderItem = typeof n == "function" ? n : null, Yi(e), Ji(e);
        return;
      }
      if (r === "count") {
        e._skalRowCount = Math.max(0, n | 0), Yi(e), Ji(e);
        return;
      }
    }
    if (a === "tabs") {
      if (r === "activeTab") {
        e._skalActiveTab = n | 0, Rr(e);
        return;
      }
      if (r === "onChange") {
        e._skalOnChange = typeof n == "function" ? n : null;
        return;
      }
    } else if (a === "tab" && (r === "title" || r === "icon")) {
      r === "title" ? e._skalTitle = n == null ? "" : String(n) : e._skalIcon = n == null ? "" : String(n);
      const c = e.parentElement;
      c && c._skalTag === "tabs" && Rr(c);
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
    const l = Ts[r];
    if (l !== undefined) {
      (e._skalG ||= {})[l] = typeof n == "function" ? n : null, Rn(e);
      return;
    }
    if (r === "draggable") {
      const c = e._skalG ||= {};
      c.draggable = typeof n == "string" ? Es[n] || 0 : n === true ? 1 : n | 0, Rn(e);
      return;
    }
    if (r === "release") {
      const c = e._skalG ||= {};
      c.release = typeof n == "string" ? Rs[n.toLowerCase()] || 0 : n === true ? 1 : n | 0, Rn(e);
      return;
    }
    if (r === "spring") {
      const c = typeof n == "string" ? $s[n] || 0 : n === true ? 1 : n | 0;
      if (c) {
        const g = c === 2 ? "cubic-bezier(0.34, 1.56, 0.64, 1)" : c === 3 ? "cubic-bezier(0.22, 1, 0.36, 1)" : "cubic-bezier(0.4, 0, 0.2, 1)", f = c === 2 ? 620 : c === 3 ? 340 : 460;
        e.style.transition = `transform ${f}ms ${g}, opacity ${f}ms ${g}`;
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
      let g = n.curve;
      g = typeof g == "string" ? ws[g] ?? 0 : g | 0;
      const f = n.delay | 0;
      e.style.transition = `all ${c}ms ${Ss[g] || "linear"} ${f}ms`;
      return;
    }
    if (n == null) {
      As(e, r);
      return;
    }
    Fs(e, r, n);
  }, insertNode(e, r, n) {
    e._skalTag === "tabs" && e._skalBar && !n ? e.insertBefore(r, e._skalBar) : e.insertBefore(r, n || null), e._skalTag === "pageView" && r.style && (r.style.flex = "0 0 100%", r.style.scrollSnapAlign = "start"), e._skalTag === "tabs" && r._skalTag === "tab" && Rr(e), r._skalTag === "flutterEmbed" && Tn(r);
  }, removeNode(e, r) {
    e.removeChild(r), e._skalTag === "tabs" && r._skalTag === "tab" && Rr(e), r._skalTag === "flutterEmbed" && bs(r), r._skalRows && Zi(r);
  }, isTextNode(e) {
    return e.nodeType === 3;
  }, getParentNode(e) {
    return e.parentNode;
  }, getFirstChild(e) {
    return e.firstChild;
  }, getNextSibling(e) {
    return e.nextSibling;
  } }), { render: Qi, effect: Ds, memo: hf, createComponent: gf, createElement: st, createTextNode: zs, insertNode: pt, insert: Ls, spread: pf, setProp: fe, mergeProps: bf, use: _f } = Is;
  function Z(e) {
    return function() {
      throw new Error(`Skal: <${e}> was used without the babel-plugin-skal-jsx transform. Add the plugin to your Vite/babel config \u2014 see examples/kitchen-sink/vite.config.js for an example. (This wrapper exists as a fallback so misconfigured builds fail loud rather than rendering blanks.)`);
    };
  }
  var vf = Z("Box"), mf = Z("Container"), wf = Z("Column"), Sf = Z("Row"), yf = Z("Text"), xf = Z("Button"), kf = Z("ScrollView"), Tf = Z("ListView"), Ef = Z("ReorderableListView"), Rf = Z("Image"), $f = Z("Stack"), Pf = Z("Switch"), Af = Z("Slider"), Ff = Z("Checkbox"), Of = Z("ActivityIndicator"), Cf = Z("ProgressBar"), If = Z("LazyGrid"), Df = Z("Wrap"), zf = Z("SafeArea"), Lf = Z("RichText"), Mf = Z("TextInput"), Nf = Z("Navigator"), Bf = Z("Screen"), Vf = Z("Tabs"), Wf = Z("Tab"), Hf = Z("AnimatedList"), Uf = Z("CrossFade"), Gf = Z("Hero"), jf = Z("ListTile"), qf = Z("PageView"), Xf = Z("Dismissible"), Kf = Z("CustomScrollView"), Yf = Z("SliverAppBar"), Jf = Z("SliverList"), Zf = Z("SliverGrid"), Qf = Z("Canvas"), eh = Z("DragItem"), th = Z("DropZone"), rh = Z("Radio"), nh = Z("Chip"), ih = Z("SegmentedButton"), oh = Z("ExpansionTile"), ah = Z("Dropdown"), sh = Z("Stepper"), lh = Z("Step"), ch = Z("Drawer"), uh = Z("BottomSheet"), dh = Z("BackdropFilter"), fh = Z("InteractiveViewer"), hh = Z("FlutterEmbed"), gh = Z("HtmlEmbed"), eo = new Map;
  function nr(e, r) {
    if (typeof e != "string" || e.length === 0)
      throw new TypeError("registerHtmlView: viewType must be a non-empty string");
    if (typeof r != "function")
      throw new TypeError("registerHtmlView: factory must be a function");
    eo.set(e, r);
    const n = globalThis.__skalRegisterHtmlView;
    typeof n == "function" && n(e);
  }
  typeof globalThis < "u" && (globalThis.__skalCreateHtmlViewElement = function(e, r) {
    const n = eo.get(e), i = document.createElement("div");
    if (i.setAttribute("data-skal-view-type", e), i.setAttribute("data-skal-view-id", String(r)), i.style.cssText = "width:100%;height:100%;box-sizing:border-box;", !n)
      return i.textContent = `<HtmlEmbed viewType="${e}"> \u2014 no factory registered`, i.style.cssText += "color:#d33;font:12px ui-monospace,monospace;padding:8px;border:1px dashed #d33;background:#fff5f5;", i;
    try {
      n(i, r);
    } catch (a) {
      console.error(`Skal registerHtmlView('${e}') factory threw:`, a), i.textContent = `<HtmlEmbed viewType="${e}"> factory threw: ${a}`, i.style.cssText += "color:#d33;font:12px ui-monospace,monospace;padding:8px;";
    }
    return i;
  });
  function Ms() {
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
          const c = Ns(l, `ref .${String(i)}()`);
          return Aa(e, a, c.args, c.onValue, c.opts);
        };
      }
      return (...a) => e === 0 ? Promise.reject(new Error(`skal ref: cannot call .${String(i)}() before the host mounts. Move the call into a JSX event handler.`)) : gt(e, i, a);
    } });
  }
  function Ns(e, r) {
    const n = e[e.length - 1];
    if (typeof n == "function")
      return { args: e.slice(0, -1), onValue: n, opts: undefined };
    if (n && typeof n == "object" && typeof n.onValue == "function")
      return { args: e.slice(0, -1), onValue: n.onValue, opts: { onError: n.onError, onDone: n.onDone } };
    throw new TypeError(`skal ${r} requires a callback \u2014 or an { onValue, onError?, onDone? } object \u2014 as its last argument (got ${n === null ? "null" : typeof n})`);
  }
  var Bs = 0, Vs = 0;
  function to(e, r) {
    const n = globalThis.__skalHot && globalThis.__skalHot.stash;
    if (!n)
      return K(r);
    const [i, a] = K(n.has(e) ? n.get(e) : r);
    return [i, (l) => {
      const c = a(l);
      return n.set(e, i()), c;
    }];
  }
  function Ws(e, r) {
    return to("hotstate:" + (r ?? Bs++), e);
  }
  function Pn(e, r, n) {
    const i = (F) => {
      const L = e[F];
      return typeof L == "function" ? L : L && L.component || null;
    }, a = (F) => {
      const L = e[F];
      return L && typeof L == "object" ? L.title : undefined;
    }, l = (F) => {
      const L = e[F];
      return L && typeof L == "object" ? L.transition : undefined;
    }, c = (F) => F === "fade" ? 1 : F === "none" ? 2 : typeof F == "number" ? F : 0, g = !!(n && n.linking), f = typeof window < "u", _ = () => {
      if (!f)
        return null;
      const F = (window.location.hash || "").replace(/^#\/?/, "").split("?")[0];
      return F && e[F] ? F : null;
    };
    let x = typeof r == "string" ? r : r && r.name || Object.keys(e)[0];
    if (g) {
      const F = _();
      F && (x = F);
    }
    const y = [{ name: x, params: {}, title: a(x), transition: l(x) }], [P, p] = to("router:" + (n && n.key != null ? n.key : Vs++), y), I = P();
    Array.isArray(I) && I.length > 0 && I.every((F) => F && e[F.name]) || p(y);
    const T = { stack: P, navigate(F, L, k) {
      p([...P(), { name: F, params: L || {}, presentation: k && k.presentation, title: (k && k.title) !== undefined ? k.title : a(F), transition: (k && k.transition) !== undefined ? k.transition : l(F) }]);
    }, back() {
      const F = P();
      F.length > 1 && p(F.slice(0, -1));
    }, replace(F, L, k) {
      p([...P().slice(0, -1), { name: F, params: L || {}, title: (k && k.title) !== undefined ? k.title : a(F), transition: (k && k.transition) !== undefined ? k.transition : l(F) }]);
    }, reset(F, L) {
      p([{ name: F, params: L || {}, title: a(F), transition: l(F) }]);
    }, canGoBack() {
      return P().length > 1;
    } };
    return g && f && Et(() => {
      const F = P(), L = "#/" + F[F.length - 1].name;
      window.location.hash !== L && window.history.replaceState({}, "", L);
    }), T.View = () => (() => {
      var F = s("navigator");
      return t(F, "onPop", () => T.back()), B(F, M(ue, { get each() {
        return P();
      }, children: (L) => {
        const k = i(L.name);
        return (() => {
          var A = s("screen");
          return B(A, k ? M(k, { get params() {
            return L.params || {};
          }, router: T }) : null), q((h) => {
            var S = L.presentation === "modal" ? 1 : 0, E = L.title || "", z = c(L.transition);
            return S !== h.e && (h.e = t(A, "presentation", S, h.e)), E !== h.t && (h.t = t(A, "title", E, h.t)), z !== h.a && (h.a = t(A, "transition", z, h.a)), h;
          }, { e: undefined, t: undefined, a: undefined }), A;
        })();
      } })), F;
    })(), T;
  }
  var Pr = Symbol("store-raw"), bt = Symbol("store-node"), Ge = Symbol("store-has"), ro = Symbol("store-self");
  function no(e) {
    let r = e[Me];
    if (!r && (Object.defineProperty(e, Me, { value: r = new Proxy(e, Gs) }), !Array.isArray(e))) {
      const n = Object.keys(e), i = Object.getOwnPropertyDescriptors(e), a = Object.getPrototypeOf(e), l = a !== null && e !== null && typeof e == "object" && !Array.isArray(e) && a !== Object.prototype;
      if (l) {
        const c = Object.getOwnPropertyDescriptors(a);
        n.push(...Object.keys(c)), Object.assign(i, c);
      }
      for (let c = 0, g = n.length;c < g; c++) {
        const f = n[c];
        l && f === "constructor" || i[f].get && Object.defineProperty(e, f, { configurable: true, enumerable: i[f].enumerable, get: i[f].get.bind(r) });
      }
    }
    return r;
  }
  function Dt(e) {
    let r;
    return e != null && typeof e == "object" && (e[Me] || !(r = Object.getPrototypeOf(e)) || r === Object.prototype || Array.isArray(e));
  }
  function zt(e, r = new Set) {
    let n, i, a, l;
    if (n = e != null && e[Pr])
      return n;
    if (!Dt(e) || r.has(e))
      return e;
    if (Array.isArray(e)) {
      Object.isFrozen(e) ? e = e.slice(0) : r.add(e);
      for (let c = 0, g = e.length;c < g; c++)
        a = e[c], (i = zt(a, r)) !== a && (e[c] = i);
    } else {
      Object.isFrozen(e) ? e = Object.assign({}, e) : r.add(e);
      const c = Object.keys(e), g = Object.getOwnPropertyDescriptors(e);
      for (let f = 0, _ = c.length;f < _; f++)
        l = c[f], !g[l].get && (a = e[l], (i = zt(a, r)) !== a && (e[l] = i));
    }
    return e;
  }
  function Ar(e, r) {
    let n = e[r];
    return n || Object.defineProperty(e, r, { value: n = Object.create(null) }), n;
  }
  function ir(e, r, n) {
    if (e[r])
      return e[r];
    const [i, a] = K(n, { equals: false, internal: true });
    return i.$ = a, e[r] = i;
  }
  function Hs(e, r) {
    const n = Reflect.getOwnPropertyDescriptor(e, r);
    return !n || n.get || !n.configurable || r === Me || r === bt || (delete n.value, delete n.writable, n.get = () => e[Me][r]), n;
  }
  function io(e) {
    Vr() && ir(Ar(e, bt), ro)();
  }
  function Us(e) {
    return io(e), Reflect.ownKeys(e);
  }
  var Gs = { get(e, r, n) {
    if (r === Pr)
      return e;
    if (r === Me)
      return n;
    if (r === hr)
      return io(e), n;
    const i = Ar(e, bt), a = i[r];
    let l = a ? a() : e[r];
    if (r === bt || r === Ge || r === "__proto__")
      return l;
    if (!a) {
      const c = Object.getOwnPropertyDescriptor(e, r);
      Vr() && (typeof l != "function" || e.hasOwnProperty(r)) && !(c && c.get) && (l = ir(i, r, l)());
    }
    return Dt(l) ? no(l) : l;
  }, has(e, r) {
    return r === Pr || r === Me || r === hr || r === bt || r === Ge || r === "__proto__" ? true : (Vr() && ir(Ar(e, Ge), r)(), (r in e));
  }, set() {
    return true;
  }, deleteProperty() {
    return true;
  }, ownKeys: Us, getOwnPropertyDescriptor: Hs };
  function Lt(e, r, n, i = false) {
    if (r === "__proto__" || !i && e[r] === n)
      return;
    const a = e[r], l = e.length;
    n === undefined ? (delete e[r], e[Ge] && e[Ge][r] && a !== undefined && e[Ge][r].$()) : (e[r] = n, e[Ge] && e[Ge][r] && a === undefined && e[Ge][r].$());
    let c = Ar(e, bt), g;
    if ((g = ir(c, r, a)) && g.$(() => n), Array.isArray(e) && e.length !== l) {
      for (let f = e.length;f < l; f++)
        (g = c[f]) && g.$();
      (g = ir(c, "length", l)) && g.$(e.length);
    }
    (g = c[ro]) && g.$();
  }
  function oo(e, r) {
    const n = Object.keys(r);
    for (let i = 0;i < n.length; i += 1) {
      const a = n[i];
      ao(a) || Lt(e, a, r[a]);
    }
  }
  function ao(e) {
    return e === "__proto__" || e === "constructor" || e === "prototype";
  }
  function js(e, r) {
    if (typeof r == "function" && (r = r(e)), r = zt(r), Array.isArray(r)) {
      if (e === r)
        return;
      let n = 0, i = r.length;
      for (;n < i; n++) {
        const a = r[n];
        e[n] !== a && Lt(e, n, a);
      }
      Lt(e, "length", i);
    } else
      oo(e, r);
  }
  function or(e, r, n = []) {
    let i, a = e;
    if (r.length > 1) {
      i = r.shift();
      const c = typeof i, g = Array.isArray(e);
      if (c === "string" && (i === "__proto__" || r.length > 1 && ao(i)))
        return;
      if (Array.isArray(i)) {
        for (let f = 0;f < i.length; f++)
          or(e, [i[f]].concat(r), n);
        return;
      } else if (g && c === "function") {
        for (let f = 0;f < e.length; f++)
          i(e[f], f) && or(e, [f].concat(r), n);
        return;
      } else if (g && c === "object") {
        const { from: f = 0, to: _ = e.length - 1, by: x = 1 } = i;
        for (let y = f;y <= _; y += x)
          or(e, [y].concat(r), n);
        return;
      } else if (r.length > 1) {
        or(e[i], r, [i].concat(n));
        return;
      }
      a = e[i], n = [i].concat(n);
    }
    let l = r[0];
    typeof l == "function" && (l = l(a, n), l === a) || i === undefined && l == null || (l = zt(l), i === undefined || Dt(a) && Dt(l) && !Array.isArray(l) ? oo(a, l) : Lt(e, i, l));
  }
  function qs(...[e, r]) {
    const n = zt(e || {}), i = Array.isArray(n), a = no(n);
    function l(...c) {
      qn(() => {
        i && c.length === 1 ? js(n, c[0]) : or(n, c);
      });
    }
    return [a, l];
  }
  var Fr = new WeakMap, so = { get(e, r) {
    if (r === Pr)
      return e;
    const n = e[r];
    if (r === Me || r === hr || r === bt || r === Ge || r === "__proto__")
      return n;
    let i;
    return Dt(n) ? Fr.get(n) || (Fr.set(n, i = new Proxy(n, so)), i) : n;
  }, set(e, r, n) {
    return Lt(e, r, zt(n)), true;
  }, deleteProperty(e, r) {
    return Lt(e, r, undefined, true), true;
  } };
  function Or(e) {
    return (r) => {
      if (Dt(r)) {
        let n;
        (n = Fr.get(r)) || Fr.set(r, n = new Proxy(r, so)), e(n);
      }
      return r;
    };
  }
  var ph = 15, Xs = (() => {
    const e = new Uint32Array(256);
    for (let r = 0;r < 256; r++) {
      let n = r;
      for (let i = 0;i < 8; i++)
        n = n & 1 ? 3988292384 ^ n >>> 1 : n >>> 1;
      e[r] = n >>> 0;
    }
    return e;
  })();
  function lo(e, r = 0, n = e.length) {
    let i = 4294967295;
    for (let a = r;a < n; a++)
      i = Xs[(i ^ e[a]) & 255] ^ i >>> 8;
    return (i ^ 4294967295) >>> 0;
  }
  function co(e, r, n, i, a, l) {
    const c = 15 + a.length + l.length, g = new DataView(e.buffer, e.byteOffset + r, c);
    return g.setUint32(4, n >>> 0, true), e[r + 8] = i & 255, g.setUint16(9, a.length, true), g.setUint32(11, l.length, true), e.set(a, r + 15), e.set(l, r + 15 + a.length), g.setUint32(0, lo(e, r + 4, r + c), true), c;
  }
  function Cr(e, r, n = true) {
    if (r + 15 > e.length)
      return null;
    const i = new DataView(e.buffer, e.byteOffset, e.byteLength), a = i.getUint32(r, true), l = i.getUint32(r + 4, true), c = e[r + 8], g = i.getUint16(r + 9, true), f = i.getUint32(r + 11, true), _ = 15 + g + f;
    if (r + _ > e.length || n && lo(e, r + 4, r + _) !== a)
      return null;
    const x = r + 15, y = x + g;
    return { seq: l, flags: c, total: _, key: e.subarray(x, y), value: e.subarray(y, y + f) };
  }
  var _t = 256 * 1024, Ks = 0.4, Ys = 1000, Js = 8, Zs = 16, Qs = new TextEncoder, el = new TextDecoder, An = (e) => Qs.encode(e), Fn = (e) => el.decode(e), uo = () => Date.now(), fo = new Uint8Array(0), ho = 1397442609, On = new Function("m", "return import(m);"), Cn = (e, r) => e && e[r] ? e : e && e.default || e, In = class {
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
  }, tl = class {
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
  }, rl = class {
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
        const a = Cr(n, i);
        if (!a)
          break;
        i += a.total;
      }
      return r = { mapped: n, cursor: i }, this._open.set(e, r), this._evictOpen(e), r;
    }
    _evictOpen(e) {
      for (;this._open.size > Zs; ) {
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
  function ar(e, r) {
    return e.diag = r, e;
  }
  async function nl(e) {
    let r, n, i;
    try {
      const c = Promise.all([On("node:fs"), On("node:os"), On("node:path")]), g = new Promise((y, P) => setTimeout(() => P(new Error("module import timed out")), 2000)), [f, _, x] = await Promise.race([c, g]);
      if (r = Cn(f, "readFileSync"), n = Cn(_, "tmpdir"), i = Cn(x, "join"), typeof r.readFileSync != "function" || typeof r.writeFileSync != "function" || typeof n.tmpdir != "function" || typeof i.join != "function")
        return ar(new In, "node:fs/os/path resolved but missing methods");
    } catch (c) {
      return ar(new In, "node: import failed \u2014 " + (c && c.message || c));
    }
    const a = e && e.length ? e : i.join(n.tmpdir(), "skal-store");
    let l = "";
    try {
      if (typeof Bun < "u" && typeof Bun.mmap == "function") {
        const c = i.join(a, "mmap");
        r.mkdirSync(c, { recursive: true });
        const g = i.join(c, ".mmap-probe");
        r.writeFileSync(g, new Uint8Array(64));
        const f = Bun.mmap(g, { shared: true });
        if (f && f.length >= 64)
          return ar(new rl((_, x) => Bun.mmap(_, x), r, i, c), "mmap @ " + c);
        l += "Bun.mmap probe unusable; ";
      } else
        l += "Bun.mmap absent; ";
    } catch (c) {
      l += "mmap \u2014 " + (c && c.message || c) + "; ";
    }
    try {
      if (typeof r.appendFileSync == "function") {
        const c = i.join(a, "fs");
        return r.mkdirSync(c, { recursive: true }), r.writeFileSync(i.join(c, ".fs-probe"), new Uint8Array(1)), ar(new tl(r, i, c), l + "fs @ " + c);
      }
      l += "fs.appendFileSync absent; ";
    } catch (c) {
      l += "fs \u2014 " + (c && c.message || c) + "; ";
    }
    return ar(new In, l + "memory fallback");
  }
  var il = class {
    constructor(e) {
      this._b = e, this._keydir = new Map, this._dead = new Map, this._cache = new Map, this._seq = 0, this._active = null, this._lastHintMs = 0, this._maxSegId = -1;
    }
    get backendKind() {
      return this._b.kind;
    }
    open() {
      const e = this._b.listSegments(), r = this._loadHint(e);
      if (r && (this._keydir = r.keydir, this._dead = r.dead, this._seq = r.seq), e.length === 0) {
        const c = r ? r.tail.id : 0;
        this._maxSegId = c, this._active = this._b.directActive ? { id: c, direct: true } : { id: c, buf: new Uint8Array(_t), len: 0, persisted: 0 };
        return;
      }
      const n = e[e.length - 1], i = r ? Math.max(n, r.tail.id) : n, a = r ? r.tail.id : e[0];
      this._maxSegId = i;
      let l = null;
      for (const c of e) {
        if (c < a)
          continue;
        const g = this._b.getSegment(c) || new Uint8Array(0);
        let f = r && c === r.tail.id ? r.tail.len : 0;
        for (;f < g.length; ) {
          const _ = Cr(g, f);
          if (!_)
            break;
          const x = Fn(_.key), y = this._keydir.get(x);
          y && this._addDead(y.seg, y.len), _.flags & 1 ? (this._keydir.delete(x), this._addDead(c, _.total)) : this._keydir.set(x, { seg: c, off: f, len: _.total, seq: _.seq }), _.seq > this._seq && (this._seq = _.seq), f += _.total;
        }
        c === i ? l = g : this._cacheSet(c, g);
      }
      if (this._cache.delete(i), this._b.directActive)
        this._b.getSegment(i), this._active = { id: i, direct: true };
      else {
        l == null && (l = this._b.getSegment(i) || new Uint8Array(0));
        const c = new Uint8Array(Math.max(_t, l.length));
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
      for (this._cache.delete(e), this._cache.set(e, r);this._cache.size > Js; )
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
      if (n.getUint32(0, true) !== ho)
        return null;
      const i = n.getUint32(4, true), a = n.getUint32(8, true), l = n.getUint32(12, true), c = n.getUint32(16, true), g = new Set(e), f = new Map;
      let _ = 20;
      try {
        for (let P = 0;P < c; P++) {
          const p = n.getUint16(_, true);
          if (_ += 2, _ + p + 16 > r.length)
            return null;
          const I = Fn(r.subarray(_, _ + p));
          _ += p;
          const T = n.getUint32(_, true);
          _ += 4;
          const F = n.getUint32(_, true);
          _ += 4;
          const L = n.getUint32(_, true);
          _ += 4;
          const k = n.getUint32(_, true);
          if (_ += 4, !g.has(T))
            return null;
          f.set(I, { seg: T, off: F, len: L, seq: k });
        }
        const x = n.getUint32(_, true);
        _ += 4;
        const y = new Map;
        for (let P = 0;P < x; P++) {
          const p = n.getUint32(_, true);
          _ += 4, y.set(p, n.getUint32(_, true)), _ += 4;
        }
        return !g.has(a) && l !== 0 ? null : { seq: i, tail: { id: a, len: l }, keydir: f, dead: y };
      } catch {
        return null;
      }
    }
    _tailLen() {
      const e = this._active;
      return e ? e.direct ? this._b.segmentLen(e.id) : e.persisted : 0;
    }
    _writeHint() {
      this._lastHintMs = uo();
      const e = this._active, r = [];
      let n = 20;
      for (const [c, g] of this._keydir) {
        const f = An(c);
        r.push([f, g]), n += 2 + f.length + 16;
      }
      n += 4 + this._dead.size * 8;
      const i = new Uint8Array(n), a = new DataView(i.buffer);
      a.setUint32(0, ho, true), a.setUint32(4, this._seq >>> 0, true), a.setUint32(8, e ? e.id : 0, true), a.setUint32(12, this._tailLen(), true), a.setUint32(16, r.length, true);
      let l = 20;
      for (const [c, g] of r)
        a.setUint16(l, c.length, true), l += 2, i.set(c, l), l += c.length, a.setUint32(l, g.seg, true), l += 4, a.setUint32(l, g.off, true), l += 4, a.setUint32(l, g.len, true), l += 4, a.setUint32(l, g.seq >>> 0, true), l += 4;
      a.setUint32(l, this._dead.size, true), l += 4;
      for (const [c, g] of this._dead)
        a.setUint32(l, c, true), l += 4, a.setUint32(l, g, true), l += 4;
      try {
        this._b.metaPut("hint", i);
      } catch {}
    }
    _nextSegId() {
      const e = Math.max(this._active.id, this._maxSegId) + 1;
      return this._maxSegId = e, e;
    }
    _seal() {
      const e = this._active;
      if (e.direct) {
        this._active = { id: this._nextSegId(), direct: true };
        return;
      }
      e.len > e.persisted && this._b.appendSegment(e.id, e.buf.subarray(e.persisted, e.len)), this._cacheSet(e.id, e.buf.slice(0, e.len)), this._active = { id: this._nextSegId(), buf: new Uint8Array(_t), len: 0, persisted: 0 };
    }
    _writeFrame(e, r, n, i) {
      const a = 15 + n.length + i.length, l = this._active;
      if (l.direct) {
        const f = this._b.segmentCapacity(l.id);
        f === 0 ? this._b.createSegment(l.id, Math.max(_t, a)) : this._b.segmentLen(l.id) + a > f && (this._seal(), this._b.createSegment(this._active.id, Math.max(_t, a)));
        const _ = this._b.reserve(this._active.id, a);
        return co(_.mapped, _.offset, e, r, n, i), _.offset;
      }
      l.len > 0 && l.len + a > _t && this._seal();
      const c = this._active;
      if (c.len + a > c.buf.length) {
        const f = new Uint8Array(Math.max(c.buf.length * 2, c.len + a));
        f.set(c.buf.subarray(0, c.len)), c.buf = f;
      }
      const g = c.len;
      return co(c.buf, g, e, r, n, i), c.len += a, g;
    }
    put(e, r) {
      const n = ++this._seq, i = An(e), a = this._writeFrame(n, 0, i, r), l = this._keydir.get(e);
      l && this._addDead(l.seg, l.len), this._keydir.set(e, { seg: this._active.id, off: a, len: 15 + i.length + r.length, seq: n });
    }
    del(e) {
      const r = this._keydir.get(e);
      r && (this._writeFrame(++this._seq, 1, An(e), fo), this._addDead(r.seg, r.len), this._keydir.delete(e));
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
      const i = Cr(n, r.off, false);
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
      e && !e.direct && e.len > e.persisted && (this._b.appendSegment(e.id, e.buf.subarray(e.persisted, e.len)), e.persisted = e.len), this._b.flush(), uo() - this._lastHintMs >= Ys && this._writeHint();
    }
    compact() {
      let e = -1, r = 0;
      for (const [c, g] of this._dead)
        this._active && c === this._active.id || g > r && (r = g, e = c);
      if (e < 0 || r < _t * Ks)
        return false;
      const n = this._segBytes(e);
      if (!n)
        return false;
      const i = this._b.listSegments(), a = i.length > 0 && e === i[0];
      let l = 0;
      for (;l < n.length; ) {
        const c = Cr(n, l);
        if (!c)
          break;
        const g = Fn(c.key);
        if (c.flags & 1)
          !a && !this._keydir.has(g) && (this._writeFrame(++this._seq, 1, c.key, fo), this._addDead(this._active.id, 15 + c.key.length));
        else {
          const f = this._keydir.get(g);
          f && f.seg === e && f.off === l && this.put(g, c.value.slice());
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
  }, ol = class {
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
  }, al = 60, sl = 8192, Ir = Symbol("skal.indexDirty"), go = class {
    constructor(e) {
      this.sp = e;
    }
  }, ll = new TextEncoder, cl = new TextDecoder;
  function vt(e) {
    return ll.encode(JSON.stringify(e));
  }
  function Ne(e) {
    return JSON.parse(cl.decode(e));
  }
  var Dn = Symbol.for("skal.store"), Oe = (e) => e !== null && typeof e == "object" && !Array.isArray(e), je = (e) => Array.isArray(e) && e.every(Oe), zn = (e) => typeof e == "string" && /^(0|[1-9]\d*)$/.test(e), ve = (e, r) => e ? e + "." + r : r, sr = () => typeof performance < "u" && performance.now ? performance.now() : Date.now();
  function Mt(e) {
    if (Array.isArray(e))
      return e.map(Mt);
    if (Oe(e)) {
      const r = {};
      for (const n of Object.keys(e))
        r[n] = Mt(e[n]);
      return r;
    }
    return e;
  }
  async function ul() {
    const e = globalThis.__skal_data_dir;
    if (typeof e == "string" && e.length)
      return e;
    for (let r = 0;r < 5; r++) {
      try {
        const n = await Promise.race([Ta(), new Promise((i, a) => setTimeout(() => a(new Error("getDataDir timeout")), 800))]);
        if (typeof n == "string" && n.length)
          return n;
      } catch {}
      await new Promise((n) => setTimeout(n, 150));
    }
    return "";
  }
  function dl(e, r = {}) {
    const n = { name: r.name || "store", paths: r.paths || null, residentMax: r.residentMax || 1e4, version: r.version || 0, migrate: r.migrate || null };
    let i = false, a = false;
    if (n.paths)
      for (const $ in n.paths) {
        const m = n.paths[$];
        m && m.lazy === true && (i = true), m && m.persist === false && (a = true);
      }
    const l = new Map;
    function c($) {
      const m = l.get($);
      if (m)
        return m;
      let w = true, C = false;
      if (n.paths) {
        const O = [];
        for (const o in n.paths)
          (o === $ || $.startsWith(o + ".")) && O.push(o);
        O.sort((o, u) => o.length - u.length);
        for (const o of O) {
          const u = n.paths[o];
          u.persist !== undefined && (w = u.persist), u.lazy !== undefined && (C = u.lazy);
        }
      }
      const D = { persist: w, lazy: C };
      return l.set($, D), D;
    }
    const [g, f] = qs(Mt(e)), [_, x] = K(false), [y, P] = K("\u2026"), [p, I] = K(null);
    let T = null;
    const F = new Map, L = new Map, k = new Map, A = new Set;
    let h = null, S = 0;
    function E($) {
      const m = L.get($) || 1;
      return L.set($, m + 1), String(m);
    }
    function z() {
      h == null && (h = setTimeout(() => {
        h = null, N();
      }, al));
    }
    function N() {
      if (!(!T || F.size === 0 && A.size === 0)) {
        if (A.size > 0) {
          if (T.delPrefix)
            for (const $ of A)
              T.delPrefix($);
          A.clear();
        }
        for (const [$, m] of F)
          if (m === null)
            T.del($);
          else if (m instanceof go) {
            const w = oe(m.sp);
            w !== undefined && T.put($, vt(w));
          } else if (m === Ir) {
            const w = $.slice(2, -2), C = oe(w === "" ? [] : w.split("."));
            Array.isArray(C) && T.put($, vt({ ids: C.map((D) => D && D._id), nextId: L.get(w) || C.length + 1 }));
          } else
            T.put($, m);
        F.clear(), T.flush(), S++;
      }
    }
    function j() {
      h != null && (clearTimeout(h), h = null), N();
    }
    function he($) {
      const m = [];
      let w = g;
      for (const C of $)
        if (C !== null && typeof C == "object") {
          let D = -1;
          if (Array.isArray(w)) {
            const O = C.hint;
            O >= 0 && O < w.length && w[O] && w[O]._id === C.__id ? D = O : (D = w.findIndex((o) => o && o._id === C.__id), C.hint = D);
          }
          m.push(D), w = D < 0 ? undefined : w[D];
        } else
          m.push(C), w = w?.[C];
      return { path: m, value: w };
    }
    function oe($) {
      let m = g;
      for (let w = 0;w < $.length; w++) {
        const C = $[w];
        if (C !== null && typeof C == "object") {
          let D = -1;
          if (Array.isArray(m)) {
            const O = C.hint;
            O >= 0 && O < m.length && m[O] && m[O]._id === C.__id ? D = O : (D = m.findIndex((o) => o && o._id === C.__id), C.hint = D);
          }
          m = D < 0 ? undefined : m[D];
        } else
          m = m?.[C];
        if (m == null)
          return;
      }
      return m;
    }
    function $e($, m) {
      let w = g;
      for (let C = 0;C < $.length; C++) {
        const D = $[C];
        if (D !== null && typeof D == "object") {
          let O = -1;
          if (Array.isArray(w)) {
            const o = D.hint;
            o >= 0 && o < w.length && w[o] && w[o]._id === D.__id ? O = o : (O = w.findIndex((u) => u && u._id === D.__id), D.hint = O);
          }
          w = O < 0 ? undefined : w[O];
        } else
          w = w?.[D];
        if (w == null)
          return;
      }
      return w[m];
    }
    function ce($, ...m) {
      for (let w = 0;w < $.length; w++) {
        const C = $[w];
        if (C !== null && typeof C == "object") {
          const D = he($);
          if (D.path.indexOf(-1) >= 0)
            return;
          f(...D.path, ...m);
          return;
        }
      }
      f(...$, ...m);
    }
    const Pe = new Map;
    function St($) {
      let m = e;
      for (const w of $.split(".")) {
        if (m == null)
          return;
        m = m[w];
      }
      return Mt(m);
    }
    function Nt($) {
      for (Pe.delete($), Pe.set($, true);Pe.size > n.residentMax; ) {
        const m = Pe.keys().next().value;
        if (m === $)
          break;
        Pe.delete(m), ce(m.split("."), St(m));
      }
    }
    function Dr($, m) {
      if (!(!T || Pe.has(m))) {
        if (Array.isArray(oe($)))
          Wt($, m);
        else {
          const w = T.get("k:" + m);
          w != null && ce($, Ne(w));
        }
        Nt(m);
      }
    }
    function ct($, m, w, C) {
      if (w) {
        F.set("k:" + w.storeKey, new go(w.solidPath));
        return;
      }
      if (je(C)) {
        for (const D of C)
          F.set("k:" + ve(m, D._id), vt(D));
        F.set("k:" + m + "#x", Ir);
        return;
      }
      if (m === "" && Oe(C)) {
        for (const D of Object.keys(C)) {
          const O = ve(m, D);
          c(O).persist && ct([...$, D], O, null, C[D]);
        }
        return;
      }
      F.set("k:" + m, vt(C));
    }
    function lr($, m) {
      if (je(m)) {
        for (const w of m)
          w && w._id != null && F.set("k:" + ve($, w._id), null);
        F.set("k:" + $ + "#x", null);
        return;
      }
      F.set("k:" + $, null), $ && m !== null && typeof m == "object" && A.add($);
    }
    function Mn($, m, w, C) {
      let D = C;
      !w && je(C) && (D = C.map((u) => u._id != null ? u : { ...u, _id: E(m) }));
      let O = false;
      for (let u = 0;u < $.length; u++) {
        const d = $[u];
        if (d !== null && typeof d == "object") {
          O = true;
          break;
        }
      }
      if (O) {
        const u = he($);
        if (u.path.indexOf(-1) >= 0)
          return;
        f(...u.path, D);
      } else
        f(...$, D);
      Array.isArray(D) && k.delete(m), m && ke.size > 0 && qe(m, D !== null && typeof D == "object");
      let o = true;
      if (i || a) {
        const u = c(m);
        !w && u.lazy && Nt(m), o = u.persist;
      }
      o && (!w && m && D !== null && typeof D == "object" && A.add(m), ct($, m, w, D), z());
    }
    const ke = new Map;
    let cr = new Set, ur = false;
    function Nn() {
      ur || (ur = true, queueMicrotask(Bn));
    }
    function Bn() {
      ur = false;
      const $ = cr;
      cr = new Set;
      for (const m of $)
        if (!m._disposed) {
          m._dirty = false;
          try {
            Bt(m);
          } catch (w) {
            console.error("[skal] effect threw:", w);
          }
        }
    }
    function Bt($) {
      const { _sps: m, _vals: w } = $;
      for (let C = 0;C < m.length; C++)
        w[C] = oe(m[C]);
      $._fn(w);
    }
    function ut($) {
      for (const m of $)
        m._dirty || (m._dirty = true, cr.add(m));
    }
    function qe($, m) {
      const w = ke.get($);
      if (w && ut(w), m)
        if ($ === "")
          for (const [, C] of ke)
            C !== w && ut(C);
        else {
          const C = $ + ".";
          for (const [D, O] of ke)
            D.startsWith(C) && ut(O);
        }
      (w || m) && Nn();
    }
    function zr($, m) {
      const w = new Array($.length);
      for (let O = 0;O < $.length; O++)
        w[O] = $[O].split(".");
      const C = { _fn: m, _paths: $, _sps: w, _vals: new Array($.length), _dirty: false, _disposed: false };
      for (let O = 0;O < $.length; O++) {
        const o = $[O];
        let u = ke.get(o);
        u || (u = new Set, ke.set(o, u)), u.add(C);
      }
      const D = () => {
        if (!C._disposed) {
          C._disposed = true;
          for (let O = 0;O < C._paths.length; O++) {
            const o = ke.get(C._paths[O]);
            o && (o.delete(C), o.size === 0 && ke.delete(C._paths[O]));
          }
        }
      };
      try {
        Bt(C);
      } catch (O) {
        throw D(), O;
      }
      return D;
    }
    const Lr = { ready: _, backendKind: y, initTiming: p, flushNow: j, version: () => n.version, pending: () => F.size, flushes: () => S, resident: () => Pe.size, engineStats: () => T && T.stats ? T.stats() : null, createEffect: zr }, Le = new Map;
    function yt($, m, w, C) {
      C === undefined && (C = Array.isArray(oe($)));
      const D = Le.get(m);
      if (D !== undefined && D.isArray === C)
        return D.node;
      const O = C ? Vn($, m, w) : Mr($, m, w);
      return Le.set(m, { node: O, isArray: C }), Le.size > sl && Le.delete(Le.keys().next().value), O;
    }
    function Vt($) {
      if ($.length) {
        for (const m of Le.keys())
          for (const w of $)
            if (m === w || m.startsWith(w + ".") || m.startsWith(w + "#")) {
              Le.delete(m);
              break;
            }
      }
    }
    function Mr($, m, w) {
      return new Proxy({}, { get(C, D) {
        if (D === Dn)
          return Lr;
        if (typeof D == "symbol")
          return;
        if (i && !w) {
          const o = m ? m + "." + D : D;
          !Pe.has(o) && c(o).lazy && rt(() => Dr($.length === 0 ? [D] : [...$, D], o));
        }
        const O = $e($, D);
        return O !== null && typeof O == "object" ? yt($.length === 0 ? [D] : [...$, D], m ? m + "." + D : D, w, Array.isArray(O)) : O;
      }, set(C, D, O) {
        return typeof D == "symbol" ? false : (Mn($.length === 0 ? [D] : [...$, D], m ? m + "." + D : D, w, O), true);
      }, has(C, D) {
        const O = oe($);
        return O != null && D in O;
      }, ownKeys() {
        const C = oe($);
        return C ? Reflect.ownKeys(C) : [];
      }, getOwnPropertyDescriptor(C, D) {
        const O = oe($);
        if (O != null && D in O)
          return { enumerable: D !== "_id", configurable: true };
      }, deleteProperty(C, D) {
        if (typeof D == "symbol")
          return false;
        const O = m ? m + "." + D : D, o = oe($.length === 0 ? [D] : [...$, D]);
        return ce($, Or((u) => {
          u != null && delete u[D];
        })), w ? ct($, m, w, null) : (!a || c(O).persist) && lr(O, o), o !== null && typeof o == "object" && (Vt([O]), k.delete(O)), O && ke.size > 0 && qe(O, true), z(), true;
      } });
    }
    function Vn($, m, w) {
      const C = () => oe($) || [], D = () => {
        (w || !a || c(m).persist) && ct($, m, w, C()), z();
      };
      function O(d, b, ...R) {
        const H = C(), G = H.length;
        d = d < 0 ? Math.max(0, G + d) : Math.min(d, G), b = b === undefined ? G - d : Math.max(0, Math.min(b, G - d));
        const Y = H.slice(d, d + b);
        let X = R;
        if (w || (X = R.map((ne) => Oe(ne) && ne._id == null ? { ...ne, _id: E(m) } : ne)), b === 0 && d === G && X.length > 0)
          for (let ne = 0;ne < X.length; ne++)
            ce([...$, G + ne], X[ne]);
        else
          ce($, Or((ne) => {
            ne.splice(d, b, ...X);
          }));
        if (!w) {
          const ne = [];
          for (const be of Y)
            if (be && be._id != null) {
              const Ae = ve(m, be._id);
              F.set("k:" + Ae, null), ne.push(Ae);
            }
          Vt(ne);
        }
        let re = false;
        if (!w) {
          const ne = k.get(m);
          re = ne === undefined ? je(H) : ne, re && (re = X.every(Oe)), k.set(m, re);
        }
        if (re) {
          for (const ne of X)
            ne && ne._id != null && F.set("k:" + ve(m, ne._id), vt(ne));
          F.set("k:" + m + "#x", Ir), z();
        } else
          D();
        return ke.size > 0 && qe(m, true), Y;
      }
      function o(d, b) {
        ce($, Or(d));
        const R = k.get(m);
        return b && !w && (R === undefined ? je(C()) : R) ? (F.set("k:" + m + "#x", Ir), z()) : D(), ke.size > 0 && qe(m, true), C();
      }
      const u = { splice: O, push: (...d) => (O(C().length, 0, ...d), C().length), unshift: (...d) => (O(0, 0, ...d), C().length), pop: () => O(C().length - 1, 1)[0], shift: () => O(0, 1)[0], sort: (d) => o((b) => {
        b.sort(d);
      }, true), reverse: () => o((d) => {
        d.reverse();
      }, true), fill: (d, b, R) => o((H) => {
        H.fill(d, b, R);
      }, false), copyWithin: (d, b, R) => o((H) => {
        H.copyWithin(d, b, R);
      }, false) };
      return new Proxy([], { get(d, b) {
        if (b === Dn)
          return Lr;
        if (b === "length")
          return C().length;
        if (typeof b == "string" && Object.hasOwn(u, b))
          return u[b];
        if (zn(b)) {
          const G = C(), Y = +b, X = G[Y];
          if (X !== null && typeof X == "object") {
            let re = false;
            if (!w) {
              const Ae = k.get(m);
              Ae === undefined ? (re = je(C()), k.set(m, re)) : re = Ae;
            }
            if (re && X._id != null) {
              const Ae = ve(m, X._id), xt = [...$, { __id: X._id, hint: Y }];
              return yt(xt, Ae, { solidPath: xt, storeKey: Ae }, false);
            }
            const ne = ve(m, b), be = [...$, Y];
            return w ? yt(be, ne, w, Array.isArray(X)) : yt(be, ne, { solidPath: $, storeKey: m }, Array.isArray(X));
          }
          return X;
        }
        const R = C(), H = R[b];
        return typeof H == "function" ? H.bind(R) : H;
      }, set(d, b, R) {
        if (b === "length") {
          const H = +R;
          let G = null;
          if (!w && H < C().length) {
            const Y = k.get(m);
            (Y === undefined ? je(C()) : Y) && (G = C().slice(H));
          }
          if (ce($, Or((Y) => {
            Y.length = H;
          })), k.delete(m), G) {
            const Y = [];
            for (const X of G)
              if (X && X._id != null) {
                const re = ve(m, X._id);
                F.set("k:" + re, null), Y.push(re);
              }
            Vt(Y);
          }
          return D(), ke.size > 0 && qe(m, true), true;
        }
        if (zn(b)) {
          const H = +b, G = C()[H];
          let Y = R;
          !w && Oe(R) && R._id == null && (Y = { ...R, _id: G && G._id != null ? G._id : E(m) }), ce($, H, Y);
          let X = false;
          if (!w) {
            const re = k.get(m);
            X = re === undefined ? je(C()) : re, X && !Oe(Y) && (X = false), k.set(m, X);
          }
          if (X && Y && Y._id != null ? (F.set("k:" + ve(m, Y._id), vt(Y)), z()) : D(), ke.size > 0) {
            const re = Y !== null && typeof Y == "object";
            qe(ve(m, b), re);
            const ne = Y && Y._id != null ? Y._id : null;
            X && ne != null && qe(ve(m, ne), re);
            const be = G && G._id != null ? G._id : null;
            be != null && be !== ne && qe(ve(m, be), true);
          }
          return true;
        }
        return false;
      }, has(d, b) {
        return b === "length" || typeof b == "string" && Object.hasOwn(u, b) ? true : (b in C());
      }, ownKeys() {
        return Reflect.ownKeys(C());
      }, getOwnPropertyDescriptor(d, b) {
        const R = C();
        if (b === "length")
          return { value: R.length, writable: true, enumerable: false, configurable: false };
        if (zn(b) && +b < R.length)
          return { enumerable: true, configurable: true };
      } });
    }
    function Nr($, m, w) {
      if (Array.isArray($)) {
        const D = T.get("k:" + m + "#x");
        if (D != null) {
          w.push(m + "#x");
          const o = Ne(D), u = [];
          for (const d of o.ids || []) {
            const b = ve(m, d);
            w.push(b);
            const R = T.get("k:" + b);
            R != null && u.push(Ne(R));
          }
          return u;
        }
        const O = T.get("k:" + m);
        return O != null ? (w.push(m), Ne(O)) : Mt($);
      }
      if (Oe($)) {
        const D = {};
        for (const O of Object.keys($))
          D[O] = Nr($[O], ve(m, O), w);
        return D;
      }
      const C = T.get("k:" + m);
      return C != null ? (w.push(m), Ne(C)) : $;
    }
    function dr($, m) {
      if (je($)) {
        let w = 0;
        for (const C of $) {
          const D = C._id == null ? 0 : +C._id;
          D > w && (w = D);
        }
        w + 1 > (L.get(m) || 1) && L.set(m, w + 1);
        for (const C of $)
          C._id == null && (C._id = E(m));
      } else if (Oe($))
        for (const w of Object.keys($))
          dr($[w], ve(m, w));
    }
    function fr($, m, w) {
      for (const C of Object.keys($)) {
        const D = $[C], O = [...m, C], o = ve(w, C), u = c(o);
        if (Array.isArray(D))
          u.persist && !u.lazy && Wt(O, o);
        else if (Oe(D)) {
          let d = true;
          if (u.persist && !u.lazy && !F.has("k:" + o)) {
            const b = T.get("k:" + o);
            if (b != null) {
              const R = Ne(b);
              ce(O, R), Oe(R) || (d = false, T.delPrefix && A.add(o));
            }
          }
          d && fr(D, O, o);
        } else {
          if (!u.persist || u.lazy || F.has("k:" + o))
            continue;
          const d = T.get("k:" + o);
          if (d != null) {
            const b = Ne(d);
            ce(O, b), Oe(b) && fr(b, O, o);
          }
        }
      }
    }
    function Wt($, m) {
      if (!c(m).persist || F.has("k:" + m + "#x") || F.has("k:" + m))
        return;
      k.delete(m);
      const w = T.get("k:" + m + "#x");
      if (w != null) {
        const O = Ne(w);
        L.set(m, O.nextId || 1);
        const o = [];
        for (const u of O.ids || []) {
          const d = T.get("k:" + ve(m, u));
          d != null && o.push(Ne(d));
        }
        ce($, o);
        return;
      }
      const C = T.get("k:" + m);
      if (C != null) {
        ce($, Ne(C));
        return;
      }
      const D = oe($);
      Array.isArray(D) && D.length > 0 && je(D) && ct($, m, null, D);
    }
    async function Wn() {
      const $ = sr();
      let m = $, w = $, C = $;
      try {
        const u = await ul();
        if (m = sr(), typeof globalThis.__skal_store_open == "function" && u)
          try {
            const G = new ol(u + "/" + n.name);
            G.open(), T = G, P("native");
          } catch {
            T = null;
          }
        if (!T) {
          const G = await nl(u), Y = new il(G);
          Y.open(), T = Y, P(G.kind);
        }
        w = sr();
        let d = null;
        const b = T.get("k:#meta");
        if (b != null)
          try {
            d = Ne(b);
          } catch {
            d = null;
          }
        const R = d ? d.version | 0 : 0;
        let H = false;
        if (d && d.shape && n.migrate && R < n.version) {
          const G = [], Y = Nr(d.shape, "", G);
          let X = null;
          try {
            X = n.migrate(Y, R);
          } catch {
            X = null;
          }
          if (Oe(X)) {
            for (const re of G)
              F.set("k:" + re, null);
            dr(X, ""), k.clear(), ce([], X), ct([], "", null, X), H = true;
          }
        }
        (!d || R !== n.version) && F.set("k:#meta", vt({ version: n.version, shape: Mt(e) })), C = sr(), H || fr(e, [], ""), z();
      } catch {}
      const D = sr(), O = T && T.stats ? T.stats() : null, o = (u) => Math.round(u * 10) / 10;
      I({ total: o(D - $), dir: o(m - $), open: o(w - m), migrate: o(C - w), hydrate: o(D - C), records: O ? O.records : 0 }), x(true);
    }
    return Wn(), yt([], "", null, Array.isArray(e));
  }
  function fl() {
    const [e, r] = K(0);
    return (() => {
      var n = st("column"), i = st("text"), a = st("row"), l = st("button"), c = st("button"), g = st("button"), f = st("text");
      return pt(n, i), pt(n, a), pt(n, f), fe(n, "gap", 8), fe(n, "padding", 12), fe(n, "background", "#FFF8FAFC"), fe(n, "cornerRadius", 10), fe(i, "fontSize", 13), fe(i, "fontWeight", 600), fe(i, "color", "#FF1A1A2E"), pt(a, l), pt(a, c), pt(a, g), fe(a, "gap", 8), fe(l, "label", "+1"), fe(l, "onClick", () => r((_) => _ + 1)), fe(c, "label", "-1"), fe(c, "onClick", () => r((_) => _ - 1)), fe(g, "label", "reset"), fe(g, "onClick", () => r(0)), fe(f, "label", "Same <Column>/<Text>/<Button> syntax as App.jsx \u2014 just compiled with moduleName: skal/renderer-web because this file is *.dom.jsx. The babel macro + skal-flutter codegen vocab work identically; only the sink (DOM vs bridge) changes."), fe(f, "fontSize", 11), fe(f, "color", "#FF4A4A5E"), Ds((_) => fe(i, "label", `Skal JSX inside HtmlEmbed (DOM render) \u2014 n = ${e()}`, _)), n;
    })();
  }
  async function hl() {
    return kn("geolocator.getCurrentPosition", {});
  }
  var Ee = "#FFF2F2F7", Re = "#FFFFFFFF", ye = "#FFE5E5EA", Q = "#FF1C1C1E", W = "#FF8E8E93", le = "#FF0A84FF", xe = "#FF34C759", De = "#FFFF9F0A", mt = "#FFFF3B30", Ce = "#FF5E5CE6", Se = "#FFEFEFF4", gl = "#FF334155", po = typeof window < "u" && !vr;
  nr("html-card", (e) => {
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
  }), nr("youtube-embed", (e) => {
    const r = document.createElement("iframe");
    r.src = "https://www.youtube.com/embed/dQw4w9WgXcQ", r.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"), r.setAttribute("allowfullscreen", ""), r.style.cssText = "width:100%;height:100%;border:0;border-radius:8px;display:block;", e.appendChild(r);
  });
  function wt(e, r, ...n) {
    const i = st(e);
    if (r)
      for (const a in r) {
        const l = r[a];
        typeof l == "function" && a !== "onClick" && a !== "onChange" && a !== "onTap" ? Et(() => fe(i, a, l())) : fe(i, a, l);
      }
    for (const a of n.flat())
      a == null || a === false || a === true || pt(i, typeof a == "object" && a.nodeType ? a : zs(String(a)));
    return i;
  }
  nr("skal-jsx-counter", (e) => {
    Qi(() => fl(), e);
  }), nr("skal-counter", (e) => {
    et(() => {
      const [r, n] = K(0);
      Qi(() => wt("column", { gap: 8, padding: 12, background: "#FFF8FAFC", cornerRadius: 10 }, wt("text", { label: () => `Skal <column>+<text>+<button> rendered as DOM inside Flutter \u2014 n = ${r()}`, fontSize: 13, fontWeight: 600, color: "#FF1A1A2E" }), wt("row", { gap: 8 }, wt("button", { label: "+1", onClick: () => n((i) => i + 1) }), wt("button", { label: "-1", onClick: () => n((i) => i - 1) }), wt("button", { label: "reset", onClick: () => n(0) })), wt("text", { label: "These widgets reach Shape D via the same JSX `<Column>` / `<Button>` you write in App.jsx \u2014 just compiled against skal/renderer-web (Shape B DOM target) instead of the bridge. Pointer events, hover, focus, ARIA all stay live.", fontSize: 11, color: "#FF4A4A5E" })), e);
    });
  }), nr("solid-counter", (e) => {
    et(() => {
      const [r, n] = K(0), i = Gt(() => r() % 2 === 0 ? "even" : "odd");
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
      e.querySelector('[data-act="inc"]').addEventListener("click", () => n((c) => c + 1)), e.querySelector('[data-act="dec"]').addEventListener("click", () => n((c) => c - 1)), Et(() => {
        a.textContent = `n = ${r()}`;
      }), Et(() => {
        l.textContent = i();
      });
    });
  });
  function J(e) {
    return (() => {
      var r = s("column"), n = s("text");
      return v(r, n), t(r, "background", Re), t(r, "cornerRadius", 14), t(r, "padding", 16), t(r, "gap", 12), t(r, "borderWidth", 1), t(r, "borderColor", ye), t(n, "fontSize", 15), t(n, "fontWeight", 800), t(n, "color", Q), B(r, () => e.children, null), q((i) => t(n, "label", e.title, i)), r;
    })();
  }
  function pl(e) {
    const r = ["Inbox", "Starred", "Drafts", "Archive"];
    return [(() => {
      var n = s("column");
      return t(n, "background", Ee), t(n, "padding", 16), t(n, "gap", 8), t(n, "height", "fill"), B(n, M(ue, { each: r, children: (i) => (() => {
        var a = s("box"), l = s("text");
        return v(a, l), t(a, "background", Re), t(a, "cornerRadius", 8), t(a, "padding", 12), t(a, "onTap", () => e.router.navigate("detail", { name: i }, { title: i })), t(l, "label", `${i}   \u203A`), t(l, "fontSize", 14), t(l, "color", Q), a;
      })() })), n;
    })(), (() => {
      var n = s("drawer"), i = s("box"), a = s("text");
      return v(n, i), t(n, "background", Re), v(i, a), t(i, "padding", 20), t(i, "background", le), t(a, "label", "Mail"), t(a, "fontSize", 20), t(a, "fontWeight", 800), t(a, "color", "#FFFFFF"), B(n, M(ue, { each: r, children: (l) => (() => {
        var c = s("box"), g = s("text");
        return v(c, g), t(c, "padding", 14), t(g, "label", l), t(g, "fontSize", 14), t(g, "color", Q), c;
      })() }), null), n;
    })()];
  }
  function bl(e) {
    return (() => {
      var r = s("column"), n = s("text"), i = s("text");
      return v(r, n), v(r, i), t(r, "background", Ee), t(r, "padding", 16), t(r, "gap", 10), t(r, "height", "fill"), t(n, "fontSize", 20), t(n, "fontWeight", 800), t(n, "color", Q), t(i, "label", "The AppBar's \u2039 back button (and the system back / swipe gesture) all pop this route. The list screen behind stayed mounted \u2014 back is instant, no re-render, scroll preserved."), t(i, "fontSize", 13), t(i, "color", W), q((a) => t(n, "label", e.name, a)), r;
    })();
  }
  var _l = [le, xe, De, Ce];
  function vl() {
    const [e, r] = K(false), [n, i] = K(false), [a, l] = K(false), [c, g] = K(0), [f, _] = K("0, 0"), [x, y] = K(false), [P, p] = K(["Alpha", "Beta", "Gamma"]);
    let I = 3;
    const T = Pn({ gallery: (F) => (() => {
      var L = s("column"), k = s("text"), A = s("row");
      return v(L, k), v(L, A), t(L, "background", Ee), t(L, "padding", 16), t(L, "gap", 12), t(L, "height", "fill"), t(k, "label", "Tap a swatch \u2014 it flies to the detail screen."), t(k, "fontSize", 13), t(k, "color", W), t(A, "gap", 12), B(A, M(ue, { each: _l, children: (h) => (() => {
        var S = s("hero"), E = s("box");
        return v(S, E), t(S, "tag", `hero-${h}`), t(E, "width", 56), t(E, "height", 56), t(E, "background", h), t(E, "cornerRadius", 12), t(E, "onTap", () => F.router.navigate("detail", { color: h })), S;
      })() })), L;
    })(), detail: { component: (F) => (() => {
      var L = s("column"), k = s("hero"), A = s("box"), h = s("text");
      return v(L, k), v(L, h), t(L, "background", Ee), t(L, "padding", 16), t(L, "gap", 12), t(L, "height", "fill"), v(k, A), t(A, "width", "fill"), t(A, "height", 180), t(A, "cornerRadius", 20), t(h, "label", "The swatch flew here from the gallery \u2014 a shared-element transition, GPU-composited host-side."), t(h, "fontSize", 13), t(h, "color", W), q((S) => {
        var E = `hero-${F.params.color}`, z = F.params.color;
        return E !== S.e && (S.e = t(k, "tag", E, S.e)), z !== S.t && (S.t = t(A, "background", z, S.t)), S;
      }, { e: undefined, t: undefined }), L;
    })(), title: "Detail", transition: "fade" } }, "gallery");
    return (() => {
      var F = s("scrollView"), L = s("text"), k = s("text"), A = s("text");
      return v(F, L), v(F, k), v(F, A), t(F, "background", Ee), t(F, "padding", 16), t(F, "gap", 14), t(L, "label", "Animations"), t(L, "fontSize", 24), t(L, "fontWeight", 800), t(L, "color", Q), t(k, "label", "Host-side motion \u2014 JS flips one signal, Flutter runs the whole tween. Zero per-frame bridge traffic. See ANIMATION.md for the full plan."), t(k, "fontSize", 13), t(k, "color", W), B(F, M(J, { title: "Implicit hot-prop tween \u2014 the animate prop", get children() {
        return [(() => {
          var h = s("row"), S = s("box");
          return v(h, S), t(h, "gap", 8), t(S, "width", 64), t(S, "height", 64), t(S, "background", le), t(S, "cornerRadius", 14), t(S, "animate", { duration: 450, curve: "easeInOut" }), q((E) => {
            var z = e() ? 0.3 : 1, N = e() ? 1.4 : 1, j = e() ? 1.4 : 1, he = e() ? 0.5 : 0, oe = e() ? 70 : 0;
            return z !== E.e && (E.e = t(S, "opacity", z, E.e)), N !== E.t && (E.t = t(S, "scaleX", N, E.t)), j !== E.a && (E.a = t(S, "scaleY", j, E.a)), he !== E.o && (E.o = t(S, "rotation", he, E.o)), oe !== E.i && (E.i = t(S, "translationX", oe, E.i)), E;
          }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined }), h;
        })(), (() => {
          var h = s("button");
          return t(h, "onClick", () => r(!e())), q((S) => t(h, "label", e() ? "Reset" : "Animate", S)), h;
        })(), (() => {
          var h = s("text");
          return t(h, "label", "opacity + scale + rotation + translation tween together \u2014 JS only flips one signal; the whole tween runs host-side."), t(h, "fontSize", 11), t(h, "color", W), h;
        })()];
      } }), A), B(F, M(J, { title: "Cold-prop tween \u2014 colour \xB7 radius \xB7 padding", get children() {
        return [(() => {
          var h = s("box"), S = s("text");
          return v(h, S), t(h, "animate", { duration: 400, curve: "easeInOut" }), t(h, "width", "fill"), t(S, "label", "AnimatedContainer tweens these host-side"), t(S, "fontSize", 12), t(S, "color", "#FFFFFFFF"), q((E) => {
            var z = n() ? mt : le, N = n() ? 32 : 8, j = n() ? 28 : 12;
            return z !== E.e && (E.e = t(h, "background", z, E.e)), N !== E.t && (E.t = t(h, "cornerRadius", N, E.t)), j !== E.a && (E.a = t(h, "padding", j, E.a)), E;
          }, { e: undefined, t: undefined, a: undefined }), h;
        })(), (() => {
          var h = s("button");
          return t(h, "onClick", () => i(!n())), q((S) => t(h, "label", n() ? "Reset" : "Animate", S)), h;
        })(), (() => {
          var h = s("text");
          return t(h, "label", "background, cornerRadius and padding are cold props \u2014 the host's AnimatedContainer tweens them; JS writes each value once."), t(h, "fontSize", 11), t(h, "color", W), h;
        })()];
      } }), A), B(F, M(J, { title: "Looping \u2014 repeat \xB7 reverse", get children() {
        return [(() => {
          var h = s("row"), S = s("box"), E = s("box"), z = s("box");
          return v(h, S), v(h, E), v(h, z), t(h, "gap", 20), t(S, "width", 44), t(S, "height", 44), t(S, "background", Ce), t(S, "cornerRadius", 22), t(S, "animate", { duration: 800, curve: "easeInOut", repeat: true, reverse: true }), t(S, "scaleX", 1.35), t(S, "scaleY", 1.35), t(E, "width", 44), t(E, "height", 44), t(E, "background", xe), t(E, "cornerRadius", 10), t(E, "animate", { duration: 1400, repeat: true }), t(E, "rotation", 6.2832), t(z, "width", 44), t(z, "height", 44), t(z, "background", De), t(z, "cornerRadius", 22), t(z, "animate", { duration: 900, curve: "easeInOut", repeat: true, reverse: true }), t(z, "opacity", 0.25), h;
        })(), (() => {
          var h = s("text");
          return t(h, "label", "A pulse, a spin and a breathe \u2014 each loops forever host-side; JS set the endpoints once and never touches them again."), t(h, "fontSize", 11), t(h, "color", W), h;
        })()];
      } }), A), B(F, M(J, { title: "Spring physics \u2014 animate.spring", get children() {
        return [(() => {
          var h = s("column"), S = s("box"), E = s("box"), z = s("box");
          return v(h, S), v(h, E), v(h, z), t(h, "gap", 10), t(S, "width", 48), t(S, "height", 48), t(S, "background", le), t(S, "cornerRadius", 10), t(S, "animate", { duration: 700, spring: "gentle" }), t(E, "width", 48), t(E, "height", 48), t(E, "background", xe), t(E, "cornerRadius", 10), t(E, "animate", { duration: 700, spring: "bouncy" }), t(z, "width", 48), t(z, "height", 48), t(z, "background", De), t(z, "cornerRadius", 10), t(z, "animate", { duration: 700, spring: "stiff" }), q((N) => {
            var j = a() ? 150 : 0, he = a() ? 150 : 0, oe = a() ? 150 : 0;
            return j !== N.e && (N.e = t(S, "translationX", j, N.e)), he !== N.t && (N.t = t(E, "translationX", he, N.t)), oe !== N.a && (N.a = t(z, "translationX", oe, N.a)), N;
          }, { e: undefined, t: undefined, a: undefined }), h;
        })(), (() => {
          var h = s("button");
          return t(h, "onClick", () => l(!a())), q((S) => t(h, "label", a() ? "Back" : "Spring", S)), h;
        })(), (() => {
          var h = s("text");
          return t(h, "label", "gentle \xB7 bouncy \xB7 stiff \u2014 three spring-like curves; bouncy overshoots and wobbles into place."), t(h, "fontSize", 11), t(h, "color", W), h;
        })()];
      } }), A), B(F, M(J, { title: "Physics \u2014 real SpringSimulation (spring)", get children() {
        return [(() => {
          var h = s("column"), S = s("box"), E = s("box"), z = s("box");
          return v(h, S), v(h, E), v(h, z), t(h, "gap", 12), t(S, "width", 52), t(S, "height", 52), t(S, "background", le), t(S, "cornerRadius", 12), t(S, "spring", "gentle"), t(E, "width", 52), t(E, "height", 52), t(E, "background", xe), t(E, "cornerRadius", 12), t(E, "spring", "bouncy"), t(z, "width", 52), t(z, "height", 52), t(z, "background", De), t(z, "cornerRadius", 12), t(z, "spring", "stiff"), q((N) => {
            var j = c(), he = c(), oe = c();
            return j !== N.e && (N.e = t(S, "translationX", j, N.e)), he !== N.t && (N.t = t(E, "translationX", he, N.t)), oe !== N.a && (N.a = t(z, "translationX", oe, N.a)), N;
          }, { e: undefined, t: undefined, a: undefined }), h;
        })(), (() => {
          var h = s("button");
          return t(h, "onClick", () => g(c() === 0 ? 175 : 0)), q((S) => t(h, "label", c() === 0 ? "Spring" : "Back", S)), h;
        })(), (() => {
          var h = s("text");
          return t(h, "label", "A real SpringSimulation drives these \u2014 not a curve. Tap fast: the box retargets from its CURRENT position and velocity mid-flight, with no dead-stop restart. gentle settles, bouncy overshoots, stiff snaps."), t(h, "fontSize", 11), t(h, "color", W), h;
        })()];
      } }), A), B(F, M(J, { title: "Physics \u2014 release momentum (draggable + release)", get children() {
        return [(() => {
          var h = s("box"), S = s("box"), E = s("text");
          return v(h, S), t(h, "height", 150), t(h, "background", Se), t(h, "cornerRadius", 12), v(S, E), t(S, "draggable", true), t(S, "release", "glide"), t(S, "width", 60), t(S, "height", 60), t(S, "background", le), t(S, "cornerRadius", 14), t(S, "onPanEnd", (z, N) => _(`${z.toFixed(0)}, ${N.toFixed(0)}`)), t(E, "label", "glide"), t(E, "fontSize", 11), t(E, "color", "#FFFFFFFF"), h;
        })(), (() => {
          var h = s("text");
          return t(h, "fontSize", 11), t(h, "color", W), q((S) => t(h, "label", `Throw the blue box \u2014 friction carries it on after you let go and decelerates it to rest. Resting at ${f()}.`, S)), h;
        })(), (() => {
          var h = s("box"), S = s("box"), E = s("text");
          return v(h, S), t(h, "height", 150), t(h, "background", Se), t(h, "cornerRadius", 12), v(S, E), t(S, "draggable", true), t(S, "release", "springBack"), t(S, "width", 60), t(S, "height", 60), t(S, "background", Ce), t(S, "cornerRadius", 14), t(E, "label", "spring"), t(E, "fontSize", 11), t(E, "color", "#FFFFFFFF"), h;
        })(), (() => {
          var h = s("text");
          return t(h, "label", "Throw the purple box \u2014 a SpringSimulation springs it home to the origin, seeded with your fling velocity (throw harder \u2192 springs back harder). All host-side: zero per-frame bridge traffic."), t(h, "fontSize", 11), t(h, "color", W), h;
        })()];
      } }), A), B(F, M(J, { title: "Cross-fade \u2014 CrossFade", get children() {
        return [(() => {
          var h = s("box"), S = s("crossFade");
          return v(h, S), t(h, "height", 92), B(S, (() => {
            var E = Sn(() => !!x());
            return () => E() ? (() => {
              var z = s("box"), N = s("text");
              return v(z, N), t(z, "width", "fill"), t(z, "height", 92), t(z, "background", Ce), t(z, "cornerRadius", 12), t(z, "padding", 16), t(N, "label", "Panel B"), t(N, "fontSize", 16), t(N, "fontWeight", 800), t(N, "color", "#FFFFFFFF"), z;
            })() : (() => {
              var z = s("box"), N = s("text");
              return v(z, N), t(z, "width", "fill"), t(z, "height", 92), t(z, "background", le), t(z, "cornerRadius", 12), t(z, "padding", 16), t(N, "label", "Panel A"), t(N, "fontSize", 16), t(N, "fontWeight", 800), t(N, "color", "#FFFFFFFF"), z;
            })();
          })()), h;
        })(), (() => {
          var h = s("button");
          return t(h, "label", "Swap panel"), t(h, "onClick", () => y(!x())), h;
        })(), (() => {
          var h = s("text");
          return t(h, "label", "AnimatedSwitcher fades the old child out as the new fades in \u2014 the outgoing element is retained through the fade."), t(h, "fontSize", 11), t(h, "color", W), h;
        })()];
      } }), A), B(F, M(J, { title: "Animated list \u2014 AnimatedList", get children() {
        return [(() => {
          var h = s("animatedList");
          return t(h, "gap", 8), B(h, M(ue, { get each() {
            return P();
          }, children: (S) => (() => {
            var E = s("box"), z = s("text");
            return v(E, z), t(E, "background", Se), t(E, "cornerRadius", 8), t(E, "padding", 12), t(z, "label", S), t(z, "fontSize", 13), t(z, "color", Q), E;
          })() })), h;
        })(), (() => {
          var h = s("row"), S = s("button"), E = s("button");
          return v(h, S), v(h, E), t(h, "gap", 8), t(S, "label", "Add"), t(S, "onClick", () => p([...P(), `Item ${++I}`])), t(E, "label", "Remove"), t(E, "onClick", () => p(P().slice(0, -1))), h;
        })(), (() => {
          var h = s("text");
          return t(h, "label", "Add \u2192 a row fades + expands in; Remove \u2192 it collapses + fades out. Both host-side, via deferred teardown."), t(h, "fontSize", 11), t(h, "color", W), h;
        })()];
      } }), A), B(F, M(J, { title: "Shared element \u2014 Hero", get children() {
        return [(() => {
          var h = s("box");
          return t(h, "height", 300), t(h, "borderWidth", 1), t(h, "borderColor", ye), t(h, "cornerRadius", 8), B(h, M(T.View, {})), h;
        })(), (() => {
          var h = s("text");
          return t(h, "label", "A Hero with a matching tag on each screen flies between them across the navigator push \u2014 the navigator is a real Flutter Navigator."), t(h, "fontSize", 11), t(h, "color", W), h;
        })()];
      } }), A), t(A, "label", "\u2014 end of animations \u2014"), t(A, "fontSize", 12), t(A, "color", W), F;
    })();
  }
  function ml() {
    const [e, r] = K("material"), [n, i] = K(false), [a, l] = K(true), [c, g] = K(false), [f, _] = K(40), [x, y] = K(""), [P, p] = K("none yet"), [I, T] = K(0), [F, L] = K(["Item one", "Item two", "Item three", "Item four"]);
    let k = 0;
    const [A, h] = K([]), [S, E] = K([]), [z, N] = K("M"), [j, he] = K([]), [oe, $e] = K(0), [ce, Pe] = K(false), [St, Nt] = K(0), [Dr, ct] = K(0), [lr, Mn] = K(false), [ke, cr] = K("\u2014"), [ur, Nn] = K("0, 0"), [Bn, Bt] = K("\u2014"), [ut, qe] = K(1);
    let zr = 1;
    const [Lr, Le] = K("\u2014 try a dialog button \u2014"), [yt, Vt] = K("\u2014 no date / time picked \u2014"), [Mr, Vn] = K(["First item", "Second item", "Third item", "Fourth item"]), Nr = Pn({ list: { component: (m) => M(pl, { get router() {
      return m.router;
    } }), title: "Mailboxes" }, detail: (m) => M(bl, { get name() {
      return m.params.name;
    }, get router() {
      return m.router;
    } }) }, "list"), [dr, fr] = K(0), Wt = (m, w) => {
      r(m), i(w), va(m, w ? 1 : 0);
    }, Wn = Pn({ home: { component: (m) => $(m.router) }, animations: { component: () => M(vl, {}), title: "Animations" } }, "home");
    function $(m) {
      return (() => {
        var w = s("scrollView"), C = s("text"), D = s("text"), O = s("text");
        return v(w, C), v(w, D), v(w, O), t(w, "background", Ee), t(w, "padding", 16), t(w, "gap", 14), t(w, "scrollbar", true), t(C, "label", "Skal \u2014 Component Demo"), t(C, "testID", "home-title"), t(C, "fontSize", 24), t(C, "fontWeight", 800), t(C, "color", Q), t(D, "label", "Every fast-path widget, plus animation, the design system, and dialogs."), t(D, "fontSize", 13), t(D, "color", W), B(w, M(J, { title: "Design system \u2014 setDesign()", get children() {
          return [(() => {
            var o = s("text");
            return t(o, "fontSize", 13), t(o, "color", W), q((u) => t(o, "label", `active: ${e()} \xB7 ${n() ? "dark" : "light"}`, u)), o;
          })(), (() => {
            var o = s("wrap"), u = s("button"), d = s("button"), b = s("button");
            return v(o, u), v(o, d), v(o, b), t(o, "gap", 8), t(u, "label", "Material"), t(u, "onClick", () => Wt("material", n())), t(d, "label", "Cupertino"), t(d, "onClick", () => Wt("cupertino", n())), t(b, "onClick", () => Wt(e(), !n())), q((R) => t(b, "label", n() ? "Light mode" : "Dark mode", R)), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "Buttons, switches, sliders, the text field & spinner all swap Material\u2194Cupertino."), t(o, "fontSize", 11), t(o, "color", W), o;
          })()];
        } }), O), B(w, M(J, { title: "Layout \u2014 box \xB7 row \xB7 wrap", get children() {
          return [(() => {
            var o = s("row"), u = s("box"), d = s("box"), b = s("box");
            return v(o, u), v(o, d), v(o, b), t(o, "gap", 8), t(u, "width", 56), t(u, "height", 56), t(u, "background", le), t(u, "cornerRadius", 10), t(d, "width", 56), t(d, "height", 56), t(d, "background", xe), t(d, "cornerRadius", 10), t(b, "width", 56), t(b, "height", 56), t(b, "background", De), t(b, "cornerRadius", 10), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "Wrap \u2014 children flow onto new runs:"), t(o, "fontSize", 11), t(o, "color", W), o;
          })(), (() => {
            var o = s("wrap");
            return t(o, "gap", 6), B(o, M(ue, { each: ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa"], children: (u) => (() => {
              var d = s("box"), b = s("text");
              return v(d, b), t(d, "background", Se), t(d, "cornerRadius", 12), t(d, "paddingLeft", 10), t(d, "paddingRight", 10), t(d, "paddingTop", 6), t(d, "paddingBottom", 6), t(b, "label", u), t(b, "fontSize", 12), t(b, "color", Q), d;
            })() })), o;
          })()];
        } }), O), B(w, M(J, { title: "Stack \u2014 overlap + positioned children", get children() {
          var o = s("stack"), u = s("box"), d = s("box"), b = s("text"), R = s("box");
          return v(o, u), v(o, d), v(o, R), t(o, "width", "fill"), t(o, "height", 120), t(u, "width", "fill"), t(u, "height", 120), t(u, "background", Ce), t(u, "cornerRadius", 12), v(d, b), t(d, "top", 10), t(d, "left", 10), t(d, "background", Re), t(d, "cornerRadius", 8), t(d, "paddingLeft", 10), t(d, "paddingRight", 10), t(d, "paddingTop", 4), t(d, "paddingBottom", 4), t(b, "label", "top \xB7 left"), t(b, "fontSize", 11), t(b, "color", Q), t(R, "bottom", 10), t(R, "right", 10), t(R, "width", 30), t(R, "height", 30), t(R, "background", mt), t(R, "cornerRadius", 15), o;
        } }), O), B(w, M(J, { title: "Text & RichText", get children() {
          return [(() => {
            var o = s("text");
            return t(o, "label", "Styled text \u2014 18sp, weight 700."), t(o, "fontSize", 18), t(o, "fontWeight", 700), t(o, "color", Q), o;
          })(), (() => {
            var o = s("richText"), u = s("text"), d = s("text"), b = s("text"), R = s("text"), H = s("text");
            return v(o, u), v(o, d), v(o, b), v(o, R), v(o, H), t(u, "label", "Rich text "), t(u, "fontSize", 16), t(u, "color", Q), t(d, "label", "mixes "), t(d, "fontSize", 16), t(d, "color", le), t(d, "fontWeight", 800), t(b, "label", "size, "), t(b, "fontSize", 22), t(b, "color", mt), t(b, "fontWeight", 700), t(R, "label", "weight "), t(R, "fontSize", 16), t(R, "color", xe), t(R, "fontWeight", 800), t(H, "label", "and colour inline."), t(H, "fontSize", 16), t(H, "color", Q), o;
          })()];
        } }), O), B(w, M(J, { title: "Image \u2014 network \xB7 BoxFit \xB7 rounded", get children() {
          return [(() => {
            var o = s("image");
            return t(o, "src", "https://picsum.photos/seed/skal/640/360"), t(o, "width", "fill"), t(o, "height", 160), t(o, "contentScale", 1), t(o, "cornerRadius", 12), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "contentScale=1 (cover); cornerRadius clips the pixels. Requires network."), t(o, "fontSize", 11), t(o, "color", W), o;
          })()];
        } }), O), B(w, M(J, { title: "Scrolling \u2014 horizontal list \xB7 lazy grid \xB7 reorderable", get children() {
          return [(() => {
            var o = s("text");
            return t(o, "label", "listView axis=1 (horizontal, virtualized):"), t(o, "fontSize", 11), t(o, "color", W), o;
          })(), (() => {
            var o = s("listView");
            return t(o, "axis", 1), t(o, "height", 66), t(o, "gap", 8), B(o, M(ue, { each: [le, xe, De, Ce, mt, "#FF00C7BE", "#FFAF52DE", "#FFFFD60A"], children: (u) => (() => {
              var d = s("box");
              return t(d, "width", 66), t(d, "height", 50), t(d, "background", u), t(d, "cornerRadius", 10), d;
            })() })), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "lazyGrid \u2014 crossAxisCount=4:"), t(o, "fontSize", 11), t(o, "color", W), o;
          })(), (() => {
            var o = s("lazyGrid");
            return t(o, "crossAxisCount", 4), t(o, "aspectRatio", 1), t(o, "gap", 8), t(o, "height", 150), B(o, M(ue, { get each() {
              return Array.from({ length: 12 }, (u, d) => d);
            }, children: (u) => (() => {
              var d = s("box");
              return t(d, "background", u % 3 === 0 ? le : u % 3 === 1 ? xe : De), t(d, "cornerRadius", 8), d;
            })() })), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "reorderableListView \u2014 drag a row to reorder:"), t(o, "fontSize", 11), t(o, "color", W), o;
          })(), (() => {
            var o = s("reorderableListView");
            return t(o, "height", 200), t(o, "gap", 6), t(o, "onReorder", (u, d) => {
              const b = Mr().slice(), [R] = b.splice(u, 1);
              b.splice(d, 0, R), Vn(b);
            }), B(o, M(ue, { get each() {
              return Mr();
            }, children: (u) => (() => {
              var d = s("box"), b = s("text");
              return v(d, b), t(d, "background", Se), t(d, "cornerRadius", 8), t(d, "padding", 12), t(b, "label", u), t(b, "fontSize", 13), t(b, "color", Q), d;
            })() })), o;
          })()];
        } }), O), B(w, M(J, { title: "Controls \u2014 switch \xB7 checkbox \xB7 slider \xB7 text field", get children() {
          return [(() => {
            var o = s("row"), u = s("switch"), d = s("text");
            return v(o, u), v(o, d), t(o, "gap", 12), t(u, "onChange", (b) => l(b)), t(d, "fontSize", 13), t(d, "color", Q), q((b) => {
              var R = a(), H = a() ? "switch: on" : "switch: off";
              return R !== b.e && (b.e = t(u, "checked", R, b.e)), H !== b.t && (b.t = t(d, "label", H, b.t)), b;
            }, { e: undefined, t: undefined }), o;
          })(), (() => {
            var o = s("row"), u = s("checkbox"), d = s("text");
            return v(o, u), v(o, d), t(o, "gap", 12), t(u, "onChange", (b) => g(b)), t(d, "fontSize", 13), t(d, "color", Q), q((b) => {
              var R = c(), H = c() ? "checkbox: checked" : "checkbox: unchecked";
              return R !== b.e && (b.e = t(u, "checked", R, b.e)), H !== b.t && (b.t = t(d, "label", H, b.t)), b;
            }, { e: undefined, t: undefined }), o;
          })(), (() => {
            var o = s("slider");
            return t(o, "min", 0), t(o, "max", 100), t(o, "onChange", (u) => _(u)), q((u) => t(o, "value", f(), u)), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 13), t(o, "color", Q), q((u) => t(o, "label", `slider: ${Math.round(f())}`, u)), o;
          })(), (() => {
            var o = s("textInput");
            return t(o, "placeholder", "Type your name\u2026"), t(o, "onChange", (u) => y(u)), t(o, "onSubmit", (u) => $i(`Submitted: ${u}`)), q((u) => t(o, "value", x(), u)), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 13), t(o, "color", W), q((u) => t(o, "label", x() ? `Hello, ${x()}!` : "\u2014 type above; press Enter to submit \u2014", u)), o;
          })()];
        } }), O), B(w, M(J, { title: "Indicators \u2014 spinner \xB7 progress bar", get children() {
          return [(() => {
            var o = s("row"), u = s("activityIndicator"), d = s("text");
            return v(o, u), v(o, d), t(o, "gap", 12), t(u, "color", le), t(d, "label", "CircularProgressIndicator"), t(d, "fontSize", 13), t(d, "color", Q), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "determinate \u2014 tracks the slider above:"), t(o, "fontSize", 11), t(o, "color", W), o;
          })(), (() => {
            var o = s("progressBar");
            return t(o, "color", le), q((u) => t(o, "progress", f() / 100, u)), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "indeterminate:"), t(o, "fontSize", 11), t(o, "color", W), o;
          })(), (() => {
            var o = s("progressBar");
            return t(o, "color", xe), o;
          })()];
        } }), O), B(w, M(J, { title: "Animation", get children() {
          return [(() => {
            var o = s("text");
            return t(o, "label", "Implicit tweens, looping, list enter/exit, Hero \u2014 all host-side, zero per-frame bridge traffic. Opens a dedicated page."), t(o, "fontSize", 11), t(o, "color", W), o;
          })(), (() => {
            var o = s("button");
            return t(o, "label", "Open Animations \u2192"), t(o, "onClick", () => m.navigate("animations")), o;
          })()];
        } }), O), B(w, M(J, { title: "ListTile \u2014 structured rows", get children() {
          return [(() => {
            var o = s("box"), u = s("column"), d = s("listTile"), b = s("listTile"), R = s("listTile");
            return v(o, u), t(o, "background", Re), t(o, "cornerRadius", 12), t(o, "borderWidth", 1), t(o, "borderColor", ye), v(u, d), v(u, b), v(u, R), t(u, "padding", 0), t(u, "gap", 0), t(d, "leadingIcon", "person"), t(d, "title", "Profile"), t(d, "subtitle", "Name, photo, bio"), t(d, "trailingIcon", "explore"), t(d, "onClick", () => p("tapped Profile")), t(b, "leadingIcon", "bell"), t(b, "title", "Notifications"), t(b, "subtitle", "Sounds, badges, alerts"), t(b, "trailingIcon", "explore"), t(b, "onClick", () => p("tapped Notifications")), t(R, "leadingIcon", "settings"), t(R, "title", "Settings"), t(R, "trailingIcon", "explore"), t(R, "onClick", () => p("tapped Settings")), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 11), t(o, "color", W), q((u) => t(o, "label", `last row: ${P()}`, u)), o;
          })()];
        } }), O), B(w, M(J, { title: "PageView \u2014 swipe between pages", get children() {
          return [(() => {
            var o = s("box"), u = s("pageView"), d = s("box"), b = s("text"), R = s("box"), H = s("text"), G = s("box"), Y = s("text");
            return v(o, u), t(o, "height", 140), v(u, d), v(u, R), v(u, G), t(u, "onChange", (X) => T(X)), v(d, b), t(d, "width", "fill"), t(d, "height", 140), t(d, "background", le), t(d, "cornerRadius", 12), t(d, "padding", 20), t(b, "label", "Page 1 \u2014 swipe \u2192"), t(b, "fontSize", 16), t(b, "fontWeight", 800), t(b, "color", "#FFFFFFFF"), v(R, H), t(R, "width", "fill"), t(R, "height", 140), t(R, "background", xe), t(R, "cornerRadius", 12), t(R, "padding", 20), t(H, "label", "Page 2"), t(H, "fontSize", 16), t(H, "fontWeight", 800), t(H, "color", "#FFFFFFFF"), v(G, Y), t(G, "width", "fill"), t(G, "height", 140), t(G, "background", De), t(G, "cornerRadius", 12), t(G, "padding", 20), t(Y, "label", "Page 3"), t(Y, "fontSize", 16), t(Y, "fontWeight", 800), t(Y, "color", "#FFFFFFFF"), q((X) => t(u, "activeTab", I(), X)), o;
          })(), (() => {
            var o = s("row"), u = s("button"), d = s("button");
            return v(o, u), v(o, d), t(o, "gap", 8), t(u, "label", "\u25C0 Prev"), t(u, "onClick", () => T(Math.max(0, I() - 1))), t(d, "label", "Next \u25B6"), t(d, "onClick", () => T(Math.min(2, I() + 1))), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 11), t(o, "color", W), q((u) => t(o, "label", `page ${I() + 1} of 3 \u2014 swipe or use the buttons`, u)), o;
          })()];
        } }), O), B(w, M(J, { title: "Pull-to-refresh + swipe-to-dismiss", get children() {
          return [(() => {
            var o = s("box"), u = s("listView");
            return v(o, u), t(o, "height", 210), t(o, "borderWidth", 1), t(o, "borderColor", ye), t(o, "cornerRadius", 8), t(u, "onRefresh", async () => {
              await new Promise((d) => setTimeout(d, 900)), L([`Fresh item ${++k}`, ...F()]);
            }), B(u, M(ue, { get each() {
              return F();
            }, children: (d) => (() => {
              var b = s("dismissible"), R = s("box"), H = s("text");
              return v(b, R), t(b, "onDismiss", () => L(F().filter((G) => G !== d))), v(R, H), t(R, "width", "fill"), t(R, "background", Se), t(R, "cornerRadius", 8), t(R, "padding", 14), t(H, "label", d), t(H, "fontSize", 13), t(H, "color", Q), b;
            })() })), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "Pull the list down to refresh (a 900ms async task \u2014 the spinner waits for it); swipe any row sideways to dismiss it."), t(o, "fontSize", 11), t(o, "color", W), o;
          })()];
        } }), O), B(w, M(J, { title: "Slivers \u2014 collapsing header (CustomScrollView)", get children() {
          return [(() => {
            var o = s("box"), u = s("customScrollView"), d = s("sliverAppBar"), b = s("box"), R = s("text"), H = s("sliverList"), G = s("sliverGrid");
            return v(o, u), t(o, "height", 340), t(o, "borderWidth", 1), t(o, "borderColor", ye), t(o, "cornerRadius", 8), v(u, d), v(u, H), v(u, G), v(d, b), t(d, "title", "Collapsing header"), t(d, "height", 170), t(d, "sliverMode", "pinned"), t(d, "background", le), v(b, R), t(b, "width", "fill"), t(b, "height", 170), t(b, "background", Ce), t(b, "padding", 20), t(R, "label", "Parallax background"), t(R, "fontSize", 18), t(R, "fontWeight", 800), t(R, "color", "#FFFFFFFF"), B(H, M(ue, { each: ["One", "Two", "Three", "Four", "Five"], children: (Y) => (() => {
              var X = s("box"), re = s("text");
              return v(X, re), t(X, "width", "fill"), t(X, "background", Re), t(X, "padding", 16), t(X, "borderWidth", 1), t(X, "borderColor", ye), t(re, "label", `Row ${Y}`), t(re, "fontSize", 14), t(re, "color", Q), X;
            })() })), t(G, "crossAxisCount", 3), t(G, "aspectRatio", 1), t(G, "gap", 8), B(G, M(ue, { each: [le, xe, De, Ce, mt, le, xe, De, Ce], children: (Y) => (() => {
              var X = s("box");
              return t(X, "background", Y), t(X, "cornerRadius", 10), X;
            })() })), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "Scroll the panel up \u2014 the purple header collapses into a pinned blue bar. The SliverList builds rows lazily; non-sliver children would auto-wrap in a SliverToBoxAdapter."), t(o, "fontSize", 11), t(o, "color", W), o;
          })()];
        } }), O), B(w, M(J, { title: "Canvas \u2014 CustomPaint 2-D drawing", get children() {
          return [(() => {
            var o = s("box"), u = s("canvas");
            return v(o, u), t(o, "background", Re), t(o, "cornerRadius", 12), t(o, "borderWidth", 1), t(o, "borderColor", ye), t(o, "padding", 10), t(u, "width", 300), t(u, "height", 170), t(u, "draw", (d) => {
              d.strokeStyle(ye).lineWidth(2).beginPath().moveTo(16, 150).lineTo(284, 150).stroke(), [50, 95, 70, f() + 10, 80].forEach((b, R) => {
                d.fillStyle(R === 3 ? le : Ce).fillRect(28 + R * 52, 150 - b, 34, b);
              }), d.fillStyle(xe).beginPath().circle(252, 44, 22).fill(), d.fillStyle(Q).fontSize(12).fillText("bars \xB7 circle \xB7 path \xB7 text", 18, 22), A().forEach((b) => {
                d.fillStyle(b.color).beginPath().circle(b.x, b.y, b.r).fill();
              });
            }), o;
          })(), (() => {
            var o = s("row"), u = s("button"), d = s("button");
            return v(o, u), v(o, d), t(o, "gap", 8), t(u, "label", "Draw a shape"), t(u, "onClick", () => h([...A(), { x: 24 + Math.random() * 252, y: 16 + Math.random() * 120, r: 8 + Math.random() * 20, color: [le, xe, De, mt, Ce][Math.floor(Math.random() * 5)] }])), t(d, "label", "Clear"), t(d, "onClick", () => h([])), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "Bars, a circle, a stroked path, text. The 4th bar tracks the Controls slider; the buttons append/clear circles \u2014 each click flips the canvasShapes signal, so the draw callback re-records and the host repaints. Static drawings cross the bridge exactly once."), t(o, "fontSize", 11), t(o, "color", W), o;
          })()];
        } }), O), B(w, M(J, { title: "Drag-and-drop \u2014 DragItem onto DropZone", get children() {
          return [(() => {
            var o = s("row");
            return t(o, "gap", 8), B(o, M(ue, { each: ["Apple", "Banana", "Cherry"], children: (u) => (() => {
              var d = s("dragItem"), b = s("box"), R = s("text");
              return v(d, b), t(d, "dragData", u), v(b, R), t(b, "background", Ce), t(b, "cornerRadius", 20), t(b, "padding", 12), t(R, "label", u), t(R, "fontSize", 13), t(R, "color", "#FFFFFFFF"), d;
            })() })), o;
          })(), (() => {
            var o = s("dropZone"), u = s("box"), d = s("text");
            return v(o, u), t(o, "onDrop", (b) => E([...S(), b])), v(u, d), t(u, "width", "fill"), t(u, "height", 90), t(u, "background", Se), t(u, "cornerRadius", 12), t(u, "padding", 16), t(d, "fontSize", 13), t(d, "color", Q), q((b) => t(d, "label", S().length ? `Basket: ${S().join(", ")}` : "Drag a chip into this zone", b)), o;
          })(), (() => {
            var o = s("row"), u = s("button");
            return v(o, u), t(o, "gap", 8), t(u, "label", "Clear basket"), t(u, "onClick", () => E([])), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "Drag a fruit chip onto the zone \u2014 it highlights host-side while you hover; on release onDrop fires with the chip's dragData string. The whole drag is host-side; only the drop crosses the bridge."), t(o, "fontSize", 11), t(o, "color", W), o;
          })()];
        } }), O), B(w, M(J, { title: "More controls \u2014 radio \xB7 chip \xB7 segmented \xB7 accordion", get children() {
          return [(() => {
            var o = s("row");
            return t(o, "gap", 16), B(o, M(ue, { each: ["S", "M", "L"], children: (u) => (() => {
              var d = s("row"), b = s("radio"), R = s("text");
              return v(d, b), v(d, R), t(d, "gap", 2), t(b, "onChange", () => N(u)), t(R, "label", u), t(R, "fontSize", 13), t(R, "color", Q), q((H) => t(b, "checked", z() === u, H)), d;
            })() })), o;
          })(), (() => {
            var o = s("row");
            return t(o, "gap", 8), B(o, M(ue, { each: ["Red", "Green", "Blue"], children: (u) => (() => {
              var d = s("chip");
              return t(d, "label", u), t(d, "onChange", (b) => he(b ? [...j(), u] : j().filter((R) => R !== u))), q((b) => t(d, "checked", j().includes(u), b)), d;
            })() })), o;
          })(), (() => {
            var o = s("segmentedButton"), u = s("text"), d = s("text"), b = s("text");
            return v(o, u), v(o, d), v(o, b), t(o, "onChange", (R) => $e(R)), t(u, "label", "Day"), t(u, "fontSize", 13), t(d, "label", "Week"), t(d, "fontSize", 13), t(b, "label", "Month"), t(b, "fontSize", 13), q((R) => t(o, "activeTab", oe(), R)), o;
          })(), (() => {
            var o = s("row"), u = s("text"), d = s("dropdown"), b = s("text"), R = s("text"), H = s("text");
            return v(o, u), v(o, d), t(o, "gap", 8), t(u, "label", "Priority"), t(u, "fontSize", 13), t(u, "color", Q), v(d, b), v(d, R), v(d, H), t(d, "onChange", (G) => Nt(G)), t(b, "label", "Low"), t(b, "fontSize", 13), t(R, "label", "Medium"), t(R, "fontSize", 13), t(H, "label", "High"), t(H, "fontSize", 13), q((G) => t(d, "activeTab", St(), G)), o;
          })(), (() => {
            var o = s("box"), u = s("expansionTile"), d = s("box"), b = s("text");
            return v(o, u), t(o, "background", Re), t(o, "cornerRadius", 8), t(o, "borderWidth", 1), t(o, "borderColor", ye), v(u, d), t(u, "title", "Details"), t(u, "onChange", (R) => Pe(R)), v(d, b), t(d, "padding", 14), t(d, "background", Se), t(b, "label", "Body content revealed by the accordion \u2014 host-owned open state, host-side expand animation."), t(b, "fontSize", 12), t(b, "color", W), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 11), t(o, "color", W), q((u) => t(o, "label", `size ${z()} \xB7 chips ${j().join("/") || "\u2014"} \xB7 segment ${["Day", "Week", "Month"][oe()]} \xB7 priority ${["Low", "Medium", "High"][St()]} \xB7 details ${ce() ? "open" : "closed"}`, u)), o;
          })()];
        } }), O), B(w, M(J, { title: "Stepper \u2014 multi-step flow", get children() {
          return [(() => {
            var o = s("stepper"), u = s("step"), d = s("text"), b = s("step"), R = s("text"), H = s("step"), G = s("text");
            return v(o, u), v(o, b), v(o, H), t(o, "onChange", (Y) => ct(Y)), v(u, d), t(u, "title", "Account"), t(d, "label", "Create your account \u2014 name, email, password."), t(d, "fontSize", 12), t(d, "color", W), v(b, R), t(b, "title", "Profile"), t(R, "label", "Add a photo and a short bio."), t(R, "fontSize", 12), t(R, "color", W), v(H, G), t(H, "title", "Done"), t(G, "label", "All set \u2014 review and finish."), t(G, "fontSize", 12), t(G, "color", W), q((Y) => t(o, "activeTab", Dr(), Y)), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 11), t(o, "color", W), q((u) => t(o, "label", `current step: ${Dr() + 1} of 3`, u)), o;
          })()];
        } }), O), B(w, M(J, { title: "BottomSheet \u2014 draggable / expandable", get children() {
          var o = s("box"), u = s("stack"), d = s("box"), b = s("text"), R = s("bottomSheet"), H = s("box"), G = s("text");
          return v(o, u), t(o, "height", 300), t(o, "cornerRadius", 12), t(o, "background", Se), v(u, d), v(u, R), v(d, b), t(d, "width", "fill"), t(d, "height", "fill"), t(d, "padding", 16), t(b, "label", "A DraggableScrollableSheet \u2014 drag the sheet up, or scroll its list past the edge to expand it."), t(b, "fontSize", 12), t(b, "color", W), v(R, H), t(R, "initialSize", 0.4), t(R, "minSize", 0.18), t(R, "maxSize", 0.95), t(R, "background", Re), v(H, G), t(H, "padding", 16), t(G, "label", "Sheet content \u2014 drag or scroll"), t(G, "fontSize", 15), t(G, "fontWeight", 700), t(G, "color", Q), B(R, M(ue, { each: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta"], children: (Y) => (() => {
            var X = s("box"), re = s("text");
            return v(X, re), t(X, "padding", 14), t(re, "label", Y), t(re, "fontSize", 14), t(re, "color", Q), X;
          })() }), null), o;
        } }), O), B(w, M(J, { title: "Effects \u2014 BackdropFilter \xB7 InteractiveViewer", get children() {
          return [(() => {
            var o = s("stack"), u = s("image"), d = s("box"), b = s("backdropFilter"), R = s("box");
            return v(o, u), v(o, d), t(u, "src", "https://picsum.photos/seed/skalblur/300/160"), t(u, "width", 300), t(u, "height", 160), t(u, "contentScale", 1), t(u, "cornerRadius", 10), v(d, b), t(d, "top", 0), t(d, "left", 150), t(d, "width", 150), t(d, "height", 160), v(b, R), t(b, "blurRadius", 12), t(R, "width", 150), t(R, "height", 160), t(R, "background", "#33FFFFFF"), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "The right half is frosted by a BackdropFilter."), t(o, "fontSize", 11), t(o, "color", W), o;
          })(), (() => {
            var o = s("box"), u = s("interactiveViewer"), d = s("image");
            return v(o, u), t(o, "height", 200), t(o, "cornerRadius", 12), t(o, "background", Se), v(u, d), t(u, "minScale", 1), t(u, "maxScale", 4), t(d, "src", "https://picsum.photos/seed/skalzoom/320/200"), t(d, "width", 320), t(d, "height", 200), t(d, "contentScale", 1), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "Pinch / scroll-wheel to zoom the image, drag to pan."), t(o, "fontSize", 11), t(o, "color", W), o;
          })()];
        } }), O), B(w, M(J, { title: "Hover \u2014 onHover \xB7 semanticLabel", get children() {
          return [(() => {
            var o = s("box"), u = s("text");
            return v(o, u), t(o, "padding", 16), t(o, "cornerRadius", 10), t(o, "borderWidth", 1), t(o, "borderColor", ye), t(o, "onHover", (d) => Mn(d)), t(o, "semanticLabel", "A hoverable demo card"), t(u, "fontSize", 14), q((d) => {
              var b = lr() ? le : Re, R = lr() ? "Hovering \u2014 pointer is over the card" : "Move the pointer over this card", H = lr() ? "#FFFFFF" : Q;
              return b !== d.e && (d.e = t(o, "background", b, d.e)), R !== d.t && (d.t = t(u, "label", R, d.t)), H !== d.a && (d.a = t(u, "color", H, d.a)), d;
            }, { e: undefined, t: undefined, a: undefined }), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "onHover fires on pointer enter/exit (desktop/web). semanticLabel wraps the card in a Semantics node for screen readers."), t(o, "fontSize", 11), t(o, "color", W), o;
          })()];
        } }), O), B(w, M(J, { title: "Keyboard \u2014 onKey", get children() {
          return [(() => {
            var o = s("box"), u = s("text");
            return v(o, u), t(o, "padding", 16), t(o, "cornerRadius", 10), t(o, "background", Re), t(o, "borderWidth", 1), t(o, "borderColor", ye), t(o, "onKey", (d) => cr(d)), t(u, "fontSize", 14), t(u, "color", Q), q((d) => t(u, "label", `last key: ${ke()}`, d)), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "Click the card to focus it, then press keys (\u2318S, Escape, arrows). onKey reports a normalized combo string; build any shortcut layer on it."), t(o, "fontSize", 11), t(o, "color", W), o;
          })()];
        } }), O), B(w, M(J, { title: "Gestures \u2014 onTap \xB7 onLongPress \xB7 onDoubleTap", get children() {
          return [(() => {
            var o = s("box"), u = s("text");
            return v(o, u), t(o, "background", Se), t(o, "cornerRadius", 12), t(o, "padding", 22), t(o, "onTap", () => p("onTap")), t(o, "onLongPress", () => p("onLongPress")), t(o, "onDoubleTap", () => p("onDoubleTap")), t(u, "label", "Tap / long-press / double-tap this box"), t(u, "fontSize", 13), t(u, "color", Q), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 12), t(o, "color", W), q((u) => t(o, "label", `last gesture: ${P()}`, u)), o;
          })()];
        } }), O), B(w, M(J, { title: "Drag \u2014 draggable (zero per-frame bridge traffic)", get children() {
          return [(() => {
            var o = s("box"), u = s("box"), d = s("text");
            return v(o, u), t(o, "height", 150), t(o, "background", Se), t(o, "cornerRadius", 12), v(u, d), t(u, "draggable", true), t(u, "width", 64), t(u, "height", 64), t(u, "background", le), t(u, "cornerRadius", 14), t(u, "onPanEnd", (b, R) => Nn(`${b.toFixed(0)}, ${R.toFixed(0)}`)), t(d, "label", "drag"), t(d, "fontSize", 12), t(d, "color", "#FFFFFFFF"), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 11), t(o, "color", W), q((u) => t(o, "label", `Drag the blue box \u2014 the host moves it itself, no event per frame. Resting offset: ${ur()}`, u)), o;
          })()];
        } }), O), B(w, M(J, { title: "Pan \u2014 onPanUpdate delta stream", get children() {
          return [(() => {
            var o = s("box"), u = s("text");
            return v(o, u), t(o, "height", 70), t(o, "background", Se), t(o, "cornerRadius", 12), t(o, "padding", 16), t(o, "onPanStart", () => Bt("drag started")), t(o, "onPanUpdate", (d, b) => Bt(`dx ${d.toFixed(1)}  dy ${b.toFixed(1)}`)), t(o, "onPanEnd", (d, b) => Bt(`fling v ${d.toFixed(0)}, ${b.toFixed(0)} dp/s`)), t(u, "label", "Drag anywhere on this strip"), t(u, "fontSize", 13), t(u, "color", Q), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 11), t(o, "color", W), q((u) => t(o, "label", `onPanUpdate: ${Bn()}`, u)), o;
          })()];
        } }), O), B(w, M(J, { title: "Scale \u2014 onScaleUpdate (pinch / rotate)", get children() {
          return [(() => {
            var o = s("box"), u = s("box"), d = s("text");
            return v(o, u), t(o, "height", 170), t(o, "background", Se), t(o, "cornerRadius", 12), v(u, d), t(u, "width", 96), t(u, "height", 96), t(u, "background", Ce), t(u, "cornerRadius", 16), t(u, "onScaleStart", () => {
              zr = ut();
            }), t(u, "onScaleUpdate", (b) => qe(Math.max(0.3, zr * b))), t(d, "label", "pinch"), t(d, "fontSize", 13), t(d, "color", "#FFFFFFFF"), q((b) => {
              var R = ut(), H = ut();
              return R !== b.e && (b.e = t(u, "scaleX", R, b.e)), H !== b.t && (b.t = t(u, "scaleY", H, b.t)), b;
            }, { e: undefined, t: undefined }), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 11), t(o, "color", W), q((u) => t(o, "label", `Pinch the purple box (two pointers / trackpad). Scale \xD7${ut().toFixed(2)}`, u)), o;
          })()];
        } }), O), B(w, M(J, { title: "Dialogs \u2014 imperative JS API", get children() {
          return [(() => {
            var o = s("row"), u = s("button"), d = s("button");
            return v(o, u), v(o, d), t(o, "gap", 8), t(u, "label", "Alert"), t(u, "onClick", async () => {
              await Ri({ title: "Heads up", message: "A plain alert dialog.", actions: [{ label: "OK", value: "ok" }] }), Le("alert: dismissed");
            }), t(d, "label", "Confirm"), t(d, "onClick", async () => {
              Le(`confirm \u2192 ${await Ri({ title: "Delete file?", message: "This cannot be undone.", actions: [{ label: "Cancel", value: "cancel" }, { label: "Delete", value: "delete", style: "destructive" }] }) ?? "dismissed"}`);
            }), o;
          })(), (() => {
            var o = s("row"), u = s("button"), d = s("button");
            return v(o, u), v(o, d), t(o, "gap", 8), t(u, "label", "Action sheet"), t(u, "onClick", async () => {
              Le(`sheet \u2192 ${await ya({ title: "Choose an action", actions: [{ label: "Copy", value: "copy" }, { label: "Share", value: "share" }, { label: "Delete", value: "delete", style: "destructive" }] }) ?? "cancelled"}`);
            }), t(d, "label", "Snackbar"), t(d, "onClick", () => {
              $i("Hello from a snackbar \uD83D\uDC4B"), Le("snackbar: shown");
            }), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 12), t(o, "color", W), q((u) => t(o, "label", Lr(), u)), o;
          })()];
        } }), O), B(w, M(J, { title: "Pickers \u2014 date \xB7 time", get children() {
          return [(() => {
            var o = s("row"), u = s("button"), d = s("button");
            return v(o, u), v(o, d), t(o, "gap", 8), t(u, "label", "Pick a date"), t(u, "onClick", async () => {
              Vt(`date \u2192 ${await xa({ initialDate: "2026-05-17" }) ?? "dismissed"}`);
            }), t(d, "label", "Pick a time"), t(d, "onClick", async () => {
              Vt(`time \u2192 ${await ka({ initialHour: 9, initialMinute: 30 }) ?? "dismissed"}`);
            }), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 12), t(o, "color", W), q((u) => t(o, "label", yt(), u)), o;
          })()];
        } }), O), B(w, M(J, { title: "Navigation \u2014 push / pop with keep-alive", get children() {
          return [(() => {
            var o = s("text");
            return t(o, "label", "Tap a mailbox to push a screen; the AppBar back button (or system back) pops. Native transition; the screen behind stays mounted."), t(o, "fontSize", 11), t(o, "color", W), o;
          })(), (() => {
            var o = s("box");
            return t(o, "height", 320), t(o, "borderWidth", 1), t(o, "borderColor", ye), B(o, M(Nr.View, {})), o;
          })()];
        } }), O), B(w, M(J, { title: "Tabs \u2014 bottom bar with keep-alive", get children() {
          return [(() => {
            var o = s("text");
            return t(o, "label", "Every tab subtree is built once and kept alive (IndexedStack) \u2014 switching never re-mounts; scroll & state survive."), t(o, "fontSize", 11), t(o, "color", W), o;
          })(), (() => {
            var o = s("box"), u = s("tabs"), d = s("tab"), b = s("column"), R = s("text"), H = s("text"), G = s("tab"), Y = s("column"), X = s("text"), re = s("textInput"), ne = s("tab"), be = s("column"), Ae = s("text"), xt = s("text");
            return v(o, u), t(o, "height", 280), t(o, "borderWidth", 1), t(o, "borderColor", ye), t(o, "cornerRadius", 8), v(u, d), v(u, G), v(u, ne), t(u, "onChange", fr), t(u, "height", "fill"), v(d, b), t(d, "title", "Home"), t(d, "icon", "home"), v(b, R), v(b, H), t(b, "background", Ee), t(b, "padding", 16), t(b, "gap", 8), t(b, "height", "fill"), t(R, "label", "Home"), t(R, "fontSize", 20), t(R, "fontWeight", 800), t(R, "color", Q), t(H, "label", "Switch tabs and come back \u2014 this tab was never torn down."), t(H, "fontSize", 13), t(H, "color", W), v(G, Y), t(G, "title", "Search"), t(G, "icon", "search"), v(Y, X), v(Y, re), t(Y, "background", Ee), t(Y, "padding", 16), t(Y, "gap", 8), t(Y, "height", "fill"), t(X, "label", "Search"), t(X, "fontSize", 20), t(X, "fontWeight", 800), t(X, "color", Q), t(re, "placeholder", "Type to search\u2026"), v(ne, be), t(ne, "title", "Profile"), t(ne, "icon", "person"), v(be, Ae), v(be, xt), t(be, "background", Ee), t(be, "padding", 16), t(be, "gap", 8), t(be, "height", "fill"), t(Ae, "label", "Profile"), t(Ae, "fontSize", 20), t(Ae, "fontWeight", 800), t(Ae, "color", Q), t(xt, "fontSize", 13), t(xt, "color", W), q((kt) => {
              var xo = dr(), ko = `active tab index: ${dr()}`;
              return xo !== kt.e && (kt.e = t(u, "activeTab", xo, kt.e)), ko !== kt.t && (kt.t = t(xt, "label", ko, kt.t)), kt;
            }, { e: undefined, t: undefined }), o;
          })()];
        } }), O), B(w, M(J, { title: "SafeArea", get children() {
          var o = s("safeArea"), u = s("box"), d = s("text");
          return v(o, u), v(u, d), t(u, "background", Se), t(u, "cornerRadius", 8), t(u, "padding", 14), t(d, "label", "Insets past notches & system bars. (No visible effect here \u2014 the app root already applies one.)"), t(d, "fontSize", 12), t(d, "color", Q), o;
        } }), O), t(O, "label", "\u2014 end of UI demo \u2014"), t(O, "fontSize", 12), t(O, "color", W), w;
      })();
    }
    return M(Wn.View, {});
  }
  var bo = ["Just shipped a new feature, feeling great about how it turned out \uD83D\uDE80", "Hot take: the best APIs are the ones you don't have to read docs for", "Spent the morning refactoring legacy code \u2014 so much cleaner now", "There's no such thing as 'just a small change' in production code", "If your tests are slow, that's a smell. Fast tests = good tests", "Bun's startup time keeps surprising me, even after a year", "Why is naming things still the hardest part of programming?", "Found a 10\xD7 speedup in a critical path today. Profilers, not guesses", "Reading 'The Art of Unix Programming' for the third time", "Premature abstraction is somehow worse than premature optimization", "Latency is a feature, throughput is an artifact of how you measure", "Half of debugging is admitting your assumption was wrong", "You don't ship the codebase you have. You ship the codebase you understand", "Cache invalidation, naming things, off-by-one. The classics", "Every config file format eventually grows a turing-complete templating layer"], wl = Array.from({ length: 15000 }, (e, r) => ({ author: `@user${r * 2654435761 >>> 17}`, body: bo[r % bo.length], num: r + 1 })), Sl = [50, 200, 500, 1000, 2000, 5000, 1e4], _o = "#FFF1F5F9", vo = "#FF475569", yl = "#FF22C55E", xl = "#FFEF4444", mo = "#FFFFFFFF";
  function kl(e) {
    const [r, n] = K(0), [i, a] = K(false), [l, c] = K(0), [g, f] = K(false);
    return (() => {
      var _ = s("column"), x = s("text"), y = s("text"), P = s("row"), p = s("button"), I = s("button");
      return v(_, x), v(_, y), v(_, P), t(_, "background", Re), t(_, "padding", 12), t(_, "cornerRadius", 10), t(_, "borderWidth", 1), t(_, "borderColor", ye), t(_, "gap", 6), t(x, "fontWeight", 700), t(x, "fontSize", 14), t(x, "color", "#FF1DA1F2"), t(y, "fontSize", 14), t(y, "color", "#FF1F2937"), t(y, "maxLines", 3), t(y, "textOverflow", 1), v(P, p), v(P, I), t(P, "gap", 10), t(p, "fontSize", 12), t(p, "padding", 6), t(p, "cornerRadius", 16), t(p, "onClick", () => {
        const T = !i();
        a(T), n(r() + (T ? 1 : -1));
      }), t(I, "fontSize", 12), t(I, "padding", 6), t(I, "cornerRadius", 16), t(I, "onClick", () => {
        const T = !g();
        f(T), c(l() + (T ? 1 : -1));
      }), q((T) => {
        var F = `#${e.num} \xB7 ${e.author}`, L = e.body, k = `\u2665 ${r()}`, A = i() ? yl : _o, h = i() ? mo : vo, S = `\u21A9 ${l()}`, E = g() ? xl : _o, z = g() ? mo : vo;
        return F !== T.e && (T.e = t(x, "label", F, T.e)), L !== T.t && (T.t = t(y, "label", L, T.t)), k !== T.a && (T.a = t(p, "label", k, T.a)), A !== T.o && (T.o = t(p, "background", A, T.o)), h !== T.i && (T.i = t(p, "color", h, T.i)), S !== T.n && (T.n = t(I, "label", S, T.n)), E !== T.s && (T.s = t(I, "background", E, T.s)), z !== T.h && (T.h = t(I, "color", z, T.h)), T;
      }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined, n: undefined, s: undefined, h: undefined }), _;
    })();
  }
  function Tl() {
    const [e, r] = K(50), [n, i] = K(""), a = Gt(() => wl.slice(0, e()));
    return (() => {
      var l = s("listView"), c = s("text"), g = s("text"), f = s("wrap"), _ = s("text");
      return v(l, c), v(l, g), v(l, f), v(l, _), t(l, "background", Ee), t(l, "padding", 16), t(l, "gap", 12), t(c, "label", "Tweet feed \u2014 virtualized"), t(c, "fontSize", 24), t(c, "fontWeight", 800), t(c, "color", Q), t(g, "label", "ListView.builder materializes only the visible window; the source pool is 15 000 items. Tap a count to mount N."), t(g, "fontSize", 13), t(g, "color", W), t(f, "gap", 6), B(f, M(ue, { each: Sl, children: (x) => (() => {
        var y = s("button");
        return t(y, "label", `${x}`), t(y, "onClick", () => {
          const P = performance.now();
          try {
            r(x), i(`mounted ${x} in ${(performance.now() - P).toFixed(2)} ms`);
          } catch (p) {
            i(`ERROR @ ${x}: ${p && (p.message || String(p)) || "unknown"}`);
          }
        }), y;
      })() })), t(_, "fontSize", 12), t(_, "color", W), B(l, M(ue, { get each() {
        return a();
      }, children: (x) => M(kl, { get author() {
        return x.author;
      }, get body() {
        return x.body;
      }, get num() {
        return x.num;
      } }) }), null), q((x) => t(_, "label", n() || `showing ${e()} tweets`, x)), l;
    })();
  }
  function El() {
    const [e, r] = K("\u2014 waiting for counter events \u2014"), n = Ms(), [i, a] = K("\u2014 tap a button to RPC the Ticker \u2014"), [l, c] = K(null), [g, f] = K(false);
    return (() => {
      var _ = s("scrollView"), x = s("text"), y = s("text"), P = s("text");
      return v(_, x), v(_, y), v(_, P), t(_, "background", Ee), t(_, "padding", 16), t(_, "gap", 14), t(x, "label", "Libraries \u2014 codegen-wrapped widgets"), t(x, "fontSize", 24), t(x, "fontWeight", 800), t(x, "color", Q), t(y, "label", "Custom adapters + real pub.dev packages, brought into JSX by skal_codegen. Imported from 'skal-flutter'."), t(y, "fontSize", 13), t(y, "color", W), B(_, po && M(J, { title: "FlutterEmbed \u2014 Shape C, real Flutter rendering", get children() {
        return [(() => {
          var p = s("text");
          return t(p, "label", "A multi-view Flutter Web view rendered inside a DOM region (lazy-loaded ~3 MB on first appearance). Click the button \u2014 the counter state lives in Dart, the +1 increment is a Flutter setState, not JS."), t(p, "fontSize", 11), t(p, "color", "#FF8E8E93"), p;
        })(), (() => {
          var p = s("flutterEmbed");
          return t(p, "widget", "counter"), t(p, "props", { initial: 0 }), t(p, "height", 120), t(p, "background", "#FFF7F7F8"), t(p, "cornerRadius", 8), p;
        })(), (() => {
          var p = s("flutterEmbed");
          return t(p, "widget", "greeting"), t(p, "props", { name: "Skal" }), t(p, "height", 60), t(p, "background", "#FFF7F7F8"), t(p, "cornerRadius", 8), p;
        })()];
      } }), P), B(_, M(J, { title: "HtmlEmbed \u2014 Flutter with DOM holes", get children() {
        return [(() => {
          var p = s("text");
          return t(p, "label", "Each panel below is a real <div> hosted inside Flutter Web's render tree via HtmlElementView. Pointer events + text selection + keyboard input stay live. On native, falls back to a sized placeholder."), t(p, "fontSize", 11), t(p, "color", W), p;
        })(), (() => {
          var p = s("htmlEmbed");
          return t(p, "viewType", "html-card"), t(p, "height", 150), t(p, "background", "#FFFFFFFF"), t(p, "cornerRadius", 10), p;
        })(), (() => {
          var p = s("htmlEmbed");
          return t(p, "viewType", "solid-counter"), t(p, "height", 140), t(p, "background", "#FFF8FAFC"), t(p, "cornerRadius", 10), p;
        })(), (() => {
          var p = s("htmlEmbed");
          return t(p, "viewType", "skal-counter"), t(p, "height", 200), t(p, "background", "#FFF8FAFC"), t(p, "cornerRadius", 10), p;
        })(), (() => {
          var p = s("htmlEmbed");
          return t(p, "viewType", "skal-jsx-counter"), t(p, "height", 200), t(p, "background", "#FFF8FAFC"), t(p, "cornerRadius", 10), p;
        })(), (() => {
          var p = s("htmlEmbed");
          return t(p, "viewType", "youtube-embed"), t(p, "height", 220), t(p, "background", "#FF000000"), t(p, "cornerRadius", 8), p;
        })()];
      } }), P), B(_, M(J, { title: "Greeting \u2014 hand-written adapter", get children() {
        var p = s("greeting");
        return t(p, "name", "Skal"), t(p, "color", "#FF1DA1F2"), t(p, "fontSize", 20), p;
      } }), P), B(_, M(J, { title: "Shimmer \u2014 pub.dev, named-ctor wrap", get children() {
        return [(() => {
          var p = s("text");
          return t(p, "label", "ShimmerFromColors \u2014 codegen-synthesized from the Shimmer.fromColors named constructor."), t(p, "fontSize", 11), t(p, "color", W), p;
        })(), (() => {
          var p = s("shimmerFromColors"), I = s("greeting");
          return v(p, I), t(p, "baseColor", 4290624957), t(p, "highlightColor", 4292927712), t(p, "period", 1500), t(I, "name", "loading\u2026"), t(I, "color", "#FF333333"), t(I, "fontSize", 28), p;
        })()];
      } }), P), B(_, M(J, { title: "QR code \u2014 qr_flutter, pub.dev wrap", get children() {
        return [(() => {
          var p = s("qrImageView");
          return t(p, "data", "https://skal.dev"), t(p, "size", 200), p;
        })(), (() => {
          var p = s("text");
          return t(p, "label", "QrImageView, generated against qr_flutter's class."), t(p, "fontSize", 11), t(p, "color", W), p;
        })()];
      } }), P), B(_, M(J, { title: "Camera \u2014 host-pattern wrap (controller lifecycle)", get children() {
        return [(() => {
          var p = s("text");
          return t(p, "label", "A synthesized _CameraHost owns the CameraController (init in initState, dispose on unmount). The controller initializes only once Start mounts <Camera> \u2014 no camera / permission \u2192 an inline error banner."), t(p, "fontSize", 11), t(p, "color", W), p;
        })(), (() => {
          var p = s("button");
          return t(p, "onClick", () => f(!g())), q((I) => t(p, "label", g() ? "Stop camera" : "Start camera", I)), p;
        })(), Sn(() => Sn(() => !!g())() && (() => {
          var p = s("box"), I = s("camera");
          return v(p, I), t(p, "background", "#FF000000"), t(p, "padding", 4), t(p, "cornerRadius", 8), t(I, "resolutionIndex", 1), p;
        })())];
      } }), P), B(_, M(J, { title: "Counter \u2014 typed callbacks back to JSX", get children() {
        return [(() => {
          var p = s("counter");
          return t(p, "initial", 0), t(p, "onChanged", (I) => r(`onChanged(${I})`)), t(p, "onReset", () => r("onReset()")), p;
        })(), (() => {
          var p = s("text");
          return t(p, "fontSize", 13), t(p, "color", Q), q((I) => t(p, "label", e(), I)), p;
        })()];
      } }), P), B(_, M(J, { title: "Ticker \u2014 JS \u2192 Dart imperative RPC", get children() {
        return [(() => {
          var p = s("ticker");
          return rs(n, p), t(p, "intervalMs", 500), p;
        })(), (() => {
          var p = s("wrap"), I = s("button"), T = s("button"), F = s("button"), L = s("button"), k = s("button"), A = s("button"), h = s("button"), S = s("button");
          return v(p, I), v(p, T), v(p, F), v(p, L), v(p, k), v(p, A), v(p, h), v(p, S), t(p, "gap", 6), t(I, "label", "pause"), t(I, "onClick", async () => {
            await n.pause(), a("pause() \u2713");
          }), t(T, "label", "resume"), t(T, "onClick", async () => {
            await n.resume(), a("resume() \u2713");
          }), t(F, "label", "reset"), t(F, "onClick", async () => {
            await n.reset(), a("reset() \u2713");
          }), t(L, "label", "+10"), t(L, "onClick", async () => {
            await n.bump(10), a(`bump(10), now getValue() \u2192 ${await n.getValue()}`);
          }), t(k, "label", "read"), t(k, "onClick", async () => {
            a(`getValue() \u2192 ${await n.getValue()}, isPaused() \u2192 ${await n.isPaused()}`);
          }), t(A, "label", "describe"), t(A, "onClick", async () => {
            a(`describe() \u2192 ${await n.describe("hello from JSX")}`);
          }), t(h, "label", "snapshot"), t(h, "onClick", async () => {
            const E = await n.snapshot();
            a(`snapshot() \u2192 value=${E.value} paused=${E.paused} ts=${E.timestamp}`);
          }), t(S, "label", "sub/unsub"), t(S, "onClick", () => {
            if (l())
              l()(), c(() => null), a("unsubscribed from ticks$");
            else {
              const E = n.ticks$((z) => {
                a(`stream tick: ${z}`);
              });
              c(() => E), a("subscribed to ticks$ \u2014 wait for emissions\u2026");
            }
          }), p;
        })(), (() => {
          var p = s("text");
          return t(p, "fontSize", 13), t(p, "color", Q), q((I) => t(p, "label", i(), I)), p;
        })()];
      } }), P), B(_, M(J, { title: "Stickers \u2014 List<Widget> children + gradient prop", get children() {
        var p = s("stickers"), I = s("greeting"), T = s("greeting"), F = s("greeting");
        return v(p, I), v(p, T), v(p, F), t(p, "gap", 6), t(p, "padding", 10), t(p, "gradient", { type: "linear", colors: ["#FFFFE082", "#FFB0F0D0", "#FFB0E0FF"], stops: [0, 0.5, 1], begin: "topLeft", end: "bottomRight" }), t(I, "name", "multi-child A"), t(I, "color", "#FF6B4F00"), t(I, "fontSize", 14), t(T, "name", "multi-child B"), t(T, "color", "#FF6B4F00"), t(T, "fontSize", 14), t(F, "name", "multi-child C"), t(F, "color", "#FF6B4F00"), t(F, "fontSize", 14), p;
      } }), P), t(P, "label", "\u2014 end of Libs demo \u2014"), t(P, "fontSize", 12), t(P, "color", W), _;
    })();
  }
  var wo = (e) => Array.from(e, (r) => r.toString(16).padStart(2, "0")).join(""), Rl = new Function("m", "return import(m);"), lt = (e) => Rl(e), ze = (e, r) => e && e[r] || e && e.default && e.default[r] || undefined, So = [...po ? [{ title: "Web plugin bridge \u2014 geolocator (B.5, web only)", probes: [{ label: "geolocator.getCurrentPosition \u2014 lat/lon via hidden Flutter Web", run: async () => {
    const e = performance.now(), r = await hl(), n = (performance.now() - e).toFixed(0);
    return `${r.lat.toFixed(4)}, ${r.lon.toFixed(4)} (\xB1${r.accuracy.toFixed(0)}m, ${n}ms \u2014 includes Flutter Web cold boot on first call)`;
  } }] }] : [], { title: "Web Crypto \u2014 crypto.subtle (global, native)", probes: [{ label: "crypto.randomUUID()", run: () => crypto.randomUUID() }, { label: "crypto.getRandomValues \u2014 16 bytes", run: () => {
    const e = new Uint8Array(16);
    return crypto.getRandomValues(e), wo(e);
  } }, { label: "crypto.subtle.digest \u2014 SHA-256 of 64 KB", run: async () => {
    const e = new Uint8Array(65536);
    crypto.getRandomValues(e);
    const r = await crypto.subtle.digest("SHA-256", e);
    return wo(new Uint8Array(r)).slice(0, 32) + "\u2026";
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
    const e = await lt("bun:sqlite"), r = ze(e, "Database") || e.default;
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
    const e = ze(await lt("node:crypto"), "createHash");
    if (!e)
      throw new Error("node:crypto has no createHash");
    return e("sha256").update("hello from skal").digest("hex").slice(0, 32) + "\u2026";
  } }, { label: "node:crypto \u2014 randomBytes(16)", run: async () => {
    const e = ze(await lt("node:crypto"), "randomBytes");
    if (!e)
      throw new Error("node:crypto has no randomBytes");
    return e(16).toString("hex");
  } }, { label: "node:os \u2014 platform / arch / cpus", run: async () => {
    const e = await lt("node:os"), r = ze(e, "platform"), n = ze(e, "arch"), i = ze(e, "cpus");
    if (!r)
      throw new Error("node:os has no platform()");
    return `${r()} ${n()} \xB7 ${i().length} cpus`;
  } }, { label: "node:path \u2014 join + normalize", run: async () => {
    const e = ze(await lt("node:path"), "join");
    if (!e)
      throw new Error("node:path has no join");
    return e("/a/b", "..", "c", "./d.txt");
  } }, { label: "Buffer \u2014 from / toString", run: () => {
    if (typeof Buffer > "u")
      throw new Error("Buffer global not present");
    return `hex = ${Buffer.from("skal", "utf8").toString("hex")}`;
  } }, { label: "node:fs \u2014 temp write + read", run: async () => {
    const e = await lt("node:fs"), r = await lt("node:os"), n = await lt("node:path"), i = ze(e, "writeFileSync"), a = ze(e, "readFileSync"), l = ze(e, "unlinkSync"), c = ze(r, "tmpdir"), g = ze(n, "join");
    if (!i || !a || !c || !g)
      throw new Error("node:fs / os / path missing an expected member");
    const f = g(c(), `skal-probe-${Date.now()}.txt`);
    i(f, "skal fs probe");
    const _ = a(f, "utf8");
    try {
      l && l(f);
    } catch {}
    return `wrote + read back "${_}"`;
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
  } }] }], yo = 3000;
  function $l(e) {
    let r;
    const n = new Promise((i, a) => {
      r = setTimeout(() => a(new Error(`timed out after ${yo} ms`)), yo);
    });
    return Promise.race([Promise.resolve().then(() => e.run()), n]).finally(() => clearTimeout(r));
  }
  function Pl() {
    const [e, r] = K({}), [n, i] = K(false), a = () => typeof performance < "u" && performance.now ? performance.now() : Date.now();
    async function l() {
      if (!n()) {
        i(true), r({});
        for (const c of So)
          for (const g of c.probes) {
            const f = a();
            let _, x = true;
            try {
              _ = String(await $l(g));
            } catch (P) {
              _ = P && P.message ? P.message : String(P), x = false;
            }
            const y = a() - f;
            r((P) => ({ ...P, [g.label]: { ms: y, response: _, ok: x } }));
          }
        i(false);
      }
    }
    return Xn(() => {
      l();
    }), (() => {
      var c = s("scrollView"), g = s("text"), f = s("text"), _ = s("button");
      return v(c, g), v(c, f), v(c, _), t(c, "background", Ee), t(c, "padding", 16), t(c, "gap", 14), t(c, "scrollbar", true), t(g, "label", "JS runtime \u2014 probes & timings"), t(g, "fontSize", 24), t(g, "fontWeight", 800), t(g, "color", Q), t(f, "label", "Each function runs in the embedded bun + JSC runtime; its duration and response are logged. Bun / bun:sqlite probes report an error (not a crash) if the runtime doesn't expose them."), t(f, "fontSize", 13), t(f, "color", W), t(_, "onClick", l), B(c, M(ue, { each: So, children: (x) => M(J, { get title() {
        return x.title;
      }, get children() {
        return M(ue, { get each() {
          return x.probes;
        }, children: (y) => {
          const P = () => e()[y.label], p = () => {
            const I = P();
            return I ? I.response.length > 110 ? I.response.slice(0, 110) + "\u2026" : I.response : "not run yet";
          };
          return (() => {
            var I = s("column"), T = s("text"), F = s("text"), L = s("text");
            return v(I, T), v(I, F), v(I, L), t(I, "gap", 2), t(T, "fontSize", 13), t(T, "fontWeight", 700), t(T, "color", Q), t(F, "fontSize", 11), t(F, "fontWeight", 700), t(F, "color", le), t(L, "fontSize", 12), t(L, "maxLines", 3), q((k) => {
              var A = y.label, h = P() ? `${P().ms.toFixed(3)} ms` : "\u2014", S = p(), E = P() ? P().ok ? W : mt : W;
              return A !== k.e && (k.e = t(T, "label", A, k.e)), h !== k.t && (k.t = t(F, "label", h, k.t)), S !== k.a && (k.a = t(L, "label", S, k.a)), E !== k.o && (k.o = t(L, "color", E, k.o)), k;
            }, { e: undefined, t: undefined, a: undefined, o: undefined }), I;
          })();
        } });
      } }) }), null), q((x) => t(_, "label", n() ? "Running\u2026" : "Re-run all probes", x)), c;
    })();
  }
  var de = dl({ counter: 0, note: "", scratch: "", settings: { theme: "dark" }, todos: [], archive: [] }, { version: 1, paths: { scratch: { persist: false }, archive: { lazy: true } } });
  function Al() {
    const e = de[Dn], r = () => e.backendKind() === "native" || e.backendKind() === "mmap" || e.backendKind() === "fs", n = () => {
      const a = e.engineStats();
      return `${a ? `${a.records} records \xB7 ${a.segments} segments` : "engine: \u2026"} \xB7 ${e.pending()} pending \xB7 ${e.flushes()} flushes`;
    }, i = () => {
      const a = e.initTiming();
      return a ? `init total ${a.total}ms \u2014 dir-RPC ${a.dir} \xB7 open ${a.open} \xB7 migrate ${a.migrate} \xB7 hydrate ${a.hydrate} (${a.records} records)` : "init: running\u2026";
    };
    return (() => {
      var a = s("scrollView"), l = s("text"), c = s("text"), g = s("text");
      return v(a, l), v(a, c), v(a, g), t(a, "background", Ee), t(a, "padding", 16), t(a, "gap", 14), t(a, "scrollbar", true), t(l, "label", "createSkalStore \u2014 reactive \xB7 persistent \xB7 deep-object"), t(l, "testID", "store-title"), t(l, "fontSize", 23), t(l, "fontWeight", 800), t(l, "color", Q), t(c, "fontSize", 14), t(c, "fontWeight", 800), t(g, "fontSize", 12), t(g, "color", W), B(a, M(J, { title: "Values \u2014 mutate the object directly", get children() {
        return [(() => {
          var f = s("row"), _ = s("button"), x = s("text");
          return v(f, _), v(f, x), t(f, "gap", 10), t(_, "label", "counter + 1"), t(_, "onClick", () => {
            de.counter = de.counter + 1;
          }), t(x, "fontSize", 16), t(x, "fontWeight", 800), t(x, "color", le), q((y) => t(x, "label", `db.counter = ${de.counter}`, y)), f;
        })(), (() => {
          var f = s("row"), _ = s("button"), x = s("text");
          return v(f, _), v(f, x), t(f, "gap", 10), t(_, "label", "toggle theme"), t(_, "onClick", () => {
            de.settings.theme = de.settings.theme === "dark" ? "light" : "dark";
          }), t(x, "fontSize", 14), t(x, "fontWeight", 700), t(x, "color", Q), q((y) => t(x, "label", `db.settings.theme = ${de.settings.theme}`, y)), f;
        })(), (() => {
          var f = s("text");
          return t(f, "label", "note \u2014 persisted; each change writes one tiny per-leaf frame"), t(f, "fontSize", 11), t(f, "color", W), f;
        })(), (() => {
          var f = s("textInput");
          return t(f, "placeholder", "persisted text\u2026"), t(f, "onChange", (_) => {
            de.note = _;
          }), q((_) => t(f, "value", de.note, _)), f;
        })(), (() => {
          var f = s("text");
          return t(f, "label", "scratch \u2014 config persist:false, so memory only (gone on restart)"), t(f, "fontSize", 11), t(f, "color", W), f;
        })(), (() => {
          var f = s("textInput");
          return t(f, "placeholder", "memory-only text\u2026"), t(f, "onChange", (_) => {
            de.scratch = _;
          }), q((_) => t(f, "value", de.scratch, _)), f;
        })()];
      } }), null), B(a, M(J, { title: "Collection \u2014 todos (array of objects)", get children() {
        return [(() => {
          var f = s("wrap"), _ = s("button"), x = s("button"), y = s("button"), P = s("button");
          return v(f, _), v(f, x), v(f, y), v(f, P), t(f, "gap", 8), t(_, "label", "Add"), t(_, "onClick", () => de.todos.push({ text: "todo " + Date.now() })), t(x, "label", "Add 100"), t(x, "onClick", () => qn(() => {
            for (let p = 0;p < 100; p++)
              de.todos.push({ text: "bulk " + Date.now() + " #" + p });
          })), t(y, "label", "Remove first"), t(y, "onClick", () => {
            de.todos.length && de.todos.shift();
          }), t(P, "label", "Clear"), t(P, "onClick", () => {
            de.todos.splice(0, de.todos.length);
          }), f;
        })(), (() => {
          var f = s("text");
          return t(f, "fontSize", 12), t(f, "fontWeight", 700), t(f, "color", le), q((_) => t(f, "label", `${de.todos.length} todos \u2014 add/remove writes one element frame + the index, never the whole list`, _)), f;
        })(), (() => {
          var f = s("box"), _ = s("listView");
          return v(f, _), t(f, "height", 220), t(f, "cornerRadius", 10), t(f, "background", Se), t(_, "scrollbar", true), B(_, M(ue, { get each() {
            return de.todos;
          }, children: (x) => (() => {
            var y = s("box"), P = s("text");
            return v(y, P), t(y, "padding", 8), t(y, "background", Re), t(y, "cornerRadius", 6), t(y, "borderWidth", 1), t(y, "borderColor", ye), t(P, "fontSize", 12), t(P, "color", Q), q((p) => t(P, "label", x.text, p)), y;
          })() })), f;
        })()];
      } }), null), B(a, M(J, { title: "Lazy \u2014 archive (config lazy:true)", get children() {
        return [(() => {
          var f = s("row"), _ = s("button");
          return v(f, _), t(f, "gap", 8), t(_, "label", "Add to archive"), t(_, "onClick", () => de.archive.push({ text: "archived " + Date.now() })), f;
        })(), (() => {
          var f = s("text");
          return t(f, "fontSize", 12), t(f, "color", W), q((_) => t(f, "label", `${de.archive.length} records \u2014 not loaded at open; faults in from disk on first access`, _)), f;
        })()];
      } }), null), B(a, M(J, { title: "Engine", get children() {
        return [(() => {
          var f = s("text");
          return t(f, "fontSize", 11), t(f, "color", W), t(f, "maxLines", 2), q((_) => t(f, "label", n(), _)), f;
        })(), (() => {
          var f = s("text");
          return t(f, "fontSize", 11), t(f, "color", W), t(f, "maxLines", 2), q((_) => t(f, "label", i(), _)), f;
        })(), (() => {
          var f = s("button");
          return t(f, "label", "Flush now"), t(f, "onClick", () => e.flushNow()), f;
        })(), (() => {
          var f = s("text");
          return t(f, "label", "Writes are debounced + batched into one engine flush; reads are pure in-memory."), t(f, "fontSize", 11), t(f, "color", W), f;
        })()];
      } }), null), q((f) => {
        var _ = `Backend: ${e.backendKind()} \xB7 schema v${e.version()}`, x = r() ? xe : De, y = r() ? "Persisted \u2014 change values, quit, and re-run to verify they survive a restart." : "In-memory fallback \u2014 no writable backend, so data resets on restart.";
        return _ !== f.e && (f.e = t(c, "label", _, f.e)), x !== f.t && (f.t = t(c, "color", x, f.t)), y !== f.a && (f.a = t(g, "label", y, f.a)), f;
      }, { e: undefined, t: undefined, a: undefined }), a;
    })();
  }
  function Fl() {
    const [e, r] = Ws(0, "appTab");
    return (() => {
      var n = s("tabs"), i = s("tab"), a = s("tab"), l = s("tab"), c = s("tab"), g = s("tab");
      return v(n, i), v(n, a), v(n, l), v(n, c), v(n, g), t(n, "onChange", r), t(n, "height", "fill"), t(i, "title", "UI"), t(i, "icon", "grid"), B(i, M(ml, {})), t(a, "title", "List"), t(a, "icon", "list"), B(a, M(Tl, {})), t(l, "title", "Libs"), t(l, "icon", "explore"), B(l, M(El, {})), t(c, "title", "JS"), t(c, "icon", "code"), B(c, M(Pl, {})), t(g, "title", "Store"), t(g, "icon", "storage"), B(g, M(Al, {})), q((f) => t(n, "activeTab", e(), f)), n;
    })();
  }
  var Ol = ".".repeat(1500);
  function Cl(e) {
    const r = e.count || 1500, n = Array.from({ length: r }, (a, l) => l), i = Math.max(1, Math.round(r * 1.5 / 768));
    return Xn(() => {
      console.log(`[skal-stress] mounted ${r} rows (~1.5 KB each); overflow resets = ${globalThis.__skal_opRingResets | 0}`);
    }), (() => {
      var a = s("scrollView"), l = s("text");
      return v(a, l), t(a, "background", Ee), t(a, "padding", 16), t(a, "gap", 6), t(a, "scrollbar", true), t(l, "label", `Skal overflow stress \u2014 ${r} rows \xD7 ~1.5 KB \u2192 overflows the 768 KiB string heap ~${i}\xD7 in one mount`), t(l, "fontSize", 15), t(l, "fontWeight", 800), t(l, "color", Q), B(a, M(ue, { each: n, children: (c) => (() => {
        var g = s("box"), f = s("text");
        return v(g, f), t(g, "background", Re), t(g, "cornerRadius", 6), t(g, "padding", 8), t(f, "label", `Row ${c}: ${Ol}`), t(f, "fontSize", 12), t(f, "maxLines", 1), t(f, "textOverflow", 1), t(f, "color", gl), g;
      })() }), null), a;
    })();
  }
  var Ln = 0;
  if (typeof location < "u" && location.search) {
    const e = new URLSearchParams(location.search).get("stress");
    e && (Ln = Math.min(20000, Math.max(0, parseInt(e, 10) || 0)));
  }
  if (Ln > 0)
    wn(() => M(Cl, { count: Ln }), yn);
  else {
    const e = () => M(Fl, {});
    globalThis.__skalHot ? globalThis.__skalHot.mount(e) : wn(e, yn);
  }
})();
})
