---
title: "高精度π值计算(练手版)"
date: 2026-09-18T10:00:00+08:00
draft: false
tags: ["学习","HPC","MPI","算法优化","高精度"]
summary: "比较神的一次练手项目"
---

# 零\-\-环境:

编程语言:C\+\+

运行环境:V100\+H100 conda(管理omp)

优化方向:并行(非CUDA,由于算法的限制)

优化目标:练习算法优化和并行优化

# 壹\-\-数学原理:

通过计算一个已知结果为π的定积分公式\.

$\pi = \int^1_0 \frac{4}{1 + x^2} dx$

基础算法从矩形法开始,然后逐步升级成精度更高,收敛更快的算法\.

---

## 矩形法(微分):

将整个0\~1的区间平分成N块,每一块的面积相加得到最终的pi值\.

N将整个面积分割成从1 / N到N / N的N个矩形\.每块矩形的边长h = 1 / N\.

取矩形的中点x\_i \+ h / 2 , 带入f(x)得到高度f(x\_i \+ h / 2).

$f(x) = \int^1_0 \frac{4}{1 + x^2} dx$

因此:

$\pi_{rect} = h \sum^{N - 1}_{i = 0}f(\xi_i)$

```Python
def rectangle_method(self , ln: float) -> float:
        return 4.0 / (1.0 + ln ** 2)   # 公式: 4 / (1 / x ** 2)在0~1上的积分表示pi值

    def calculate(self) -> float:
        ans = 0.0
        for i in range(self.N):
            mid = (i / self.N) + (self.ln / 2.0)
            ans += self.rectangle_method(mid)
        return ans * self.ln 
```

此方法收敛速度为二次方\.

---

## 辛普森积分:

原理就是通过任意两点和其中点,能够唯一确定一个二次函数P(x),而P(x)有以下性质:

$\int^b_a P(x)dx = \frac{h}{3}[f(x_0) + 4f(x_1) + f(x_2)]$

这是单区间辛普森法则,将其扩展到多个区间中,有:

$\int^b_a P(x)dx = \frac{h}{3}[f(x_0) + 4f(x_1) + 2f(x_2) + 4f(x_3) + 2f(x_4) + ... + 2f(x_{n-2}) + 4f(x_{n-1}) + f(x_n)]$

$(x_2,x_4,...,x_{n-2}这些是端点,x_1,x_3,...,x_{n-1}这些是中间点)$

```Python
def simpson_method(self , idx: int) -> Decimal:
        if idx % 2 == 0:
            return self.EIGHT * Decimal(self.N * self.N) / Decimal(self.N * self.N + idx * idx)
        else:
            return self.SIXTEEN * Decimal(self.N * self.N) / Decimal(self.N * self.N + idx * idx)

    def calculate(self) -> Decimal:
        ans = Decimal(6)
        
        for j in tqdm(range(1, self.N), mininterval=1):
            ans += self.simpson_method(j)
        return ans * self.ln / Decimal(3)
```

这里同时使用了Decimal来提高精度\.

它的收敛速度是四次方\.

辛普森算法并非收敛速度最快，但介于精准度和优化自由度，采用辛普森算法。

最好使用Machin\-like 公式\.

**然而就这样写就等死吧,等一辈子也算不完百亿位的精度**

---

## Chudnovsky级数\+二分分裂

这个可能有点超纲

### 1\.Chudnovsky级数

在1998年某位大能发现了Chudnovsky级数

$\frac{1}{\pi} = 12 \sum_{k=0}^{\infty} \frac{(-1)^k (6k)! (A + Bk)}{(3k)! (k!)^3 C^{3k+3/2}}$

这个级数当其中$A = 13591409,\quad B = 545140134,\quad C = 640320$时级数的和为$\pi$

并且由于

- 级数的收敛半径很大(4096),收敛速度非常快\.其每加一项其精度就会增加14\.18位小数\.

- 公式长得非常标准,非常适合二分分裂\.

- 常规算法复杂度$O(n^2)$虽然不如辛普森算法的$O(n)$,但是经过优化可以达到$O(long^2 N)$\.

其在生产应用中经常使用\.

---

### 2\.如何求和?

由于级数收敛速度极快,逐项计算设计到巨大整数的阶乘和幂运算,第二项就要计算$640320^{\frac{15}{2}}$\.并且,在计算项数线性增长的过程中,其**浮点误差逐项积累**,误差会被放大\.

因此,必须使用**整数运算,可以将原式重写为下式**

$\pi = \frac{C^{3/2}}{12} \cdot \frac{\sum_{k=0}^{N-1} P_k \cdot (A + Bk) \cdot (-1)^k}{\sum_{k=0}^{N-1} Q_k}$

---

### 3\.Binary Splitting(二分分裂)

#### 3\.1原理介绍

Binary Splitting 是一种分治算法，用于高效计算形如下式的级数,其中$a_k,b_k,c_k$是整数

$\sum_{k=0}^{\infty} \frac{a_k}{b_k}c_k$

它的思想是:将求和区间一分为二,递归拆分数组直至不可分(类似构建完全二叉树)\.计算这些叶子节点的值,然后通过公式向上合并\.原本需要$N$次的求和,现在需要$log_2N$次合并\.以下为具体过程:

#### 3\.2定义

设目标为计算$s(l,r)=\sum_{k=l}^{r-1} \frac{a_k}{b_k}c_k \quad(规定l \lt r)$

递归计算:

- 如果区间长度为1(即 $r = l + 1$),则直接返回该项:

$S(l,l+1)= \frac{a_l c_l}{b_l}$

- 如果区间长度\>1,取中点$m = \frac{l+r}{2}$,递归计算左半和$L = S(l,m)$和右半和$R = S(m,r)$,然后合并:

$S(l,r) = L + R$

**这是对于形如**$\sum_{k=0}^{\infty} \frac{a_k}{b_k}c_k$**的计算过程,形如**$\sum_{k=0}^{\infty} \left( \frac{c_k}{b_k} \prod_{i=0}^{k-1} \frac{a_i}{b_i} \right)$**则需要将计算过程变形为以下式子:**

对于整数区间$[a,b)$,定义:

$P(a,b) = \prod_{k=a}^{b-1} a_k$

$Q(a,b) = \prod_{k=a}^{b-1} b_k$

$T(a,b) = \sum_{k=a}^{b-1} \left( c_k \cdot \prod_{i=a}^{k-1} a_i \cdot \prod_{i=k+1}^{b-1} b_i \right) $或者$T(a,b) = Q(a,b) \cdot \sum_{k=a}^{b-1} \left( \frac{c_k}{b_k} \prod_{i=a}^{k-1} \frac{a_i}{b_i} \right)$

**这个式子怎么来的?为什么能计算?(注意了,要开始天书了)**

设我们想计算区间$[a,b)$上的部分和$S(a,b)$\.如果直接计算,需要频繁使用除法(会损失很多精度),但注意到:

$\prod_{i=a}^{k-1} \frac{a_i}{b_i} = \frac{\prod_{i=a}^{k-1} a_i}{\prod_{i=a}^{k-1} b_i} = \frac{P(a,k)}{Q(a,k)},  $

那么,需要计算的$S(a,b)$就变成以下式子:

$S(a,b) = \sum_{k=a}^{b-1} \frac{c_k}{b_k} \cdot \frac{P(a,k)}{Q(a,k)}.$

但是由于分母不统一,合并的时候需要每一个分母的最小公倍数,显然是很大的\.为了得到一个整洁的数学表达式,我们引入:

$T(a,b) = Q(a,b) \cdot S(a,b) = \sum_{k=a}^{b-1} c_k \cdot \frac{Q(a,b)}{b_k} \cdot \frac{P(a,k)}{Q(a,k)}.$

因为$\prod$可拆乘,所以$Q(a,b) = Q(a,k) \cdot Q(k,b)$,计算下式:

$\frac{Q(a,b)}{b_k Q(a,k)} = \frac{Q(a,k) Q(k,b)}{b_k Q(a,k)} = \frac{Q(k,b)}{b_k} = Q(k+1,b),$

因此带入得到:

$T(a,b) = \sum_{k=a}^{b-1} c_k \cdot P(a,k) \cdot Q(k+1,b).$

现在这个式子里面全是整数乘法,非常好看\.我们需要的$S(a,b)$可以通过:

$S(a,b)= \frac{T(a,b)}{Q(a,b)}$

计算\.

**那么怎么和递归结合起来?**

$\prod$可拆乘,所以:

- **P 的递归**

$ P(a,b) = P(a,m) \cdot P(m,b).$

- **Q 的递归**

$ Q(a,b) = Q(a,m) \cdot Q(m,b).$

- **T 的递归(其实还是拆)**

由定义$T(a,b) = \sum_{k=a}^{b-1} c_k \, P(a,k) \, Q(k+1,b).$并且$\sum$可拆和,

将求和拆成$k \lt m 和 k \ge m$两个部分:

$ T(a,b) = \underbrace{\sum_{k=a}^{m-1} c_k \, P(a,k) \, Q(k+1,b)}_{k < m}
         + \underbrace{\sum_{k=m}^{b-1} c_k \, P(a,k) \, Q(k+1,b)}_{k \ge m}.$

对于左边 $(k \lt m)$,注意到 $Q(k+1,b) = Q(k+1,m) \cdot Q(m,b)$(还是 $\prod$ 可拆乘),所以

$ L = \left( \sum_{k=a}^{m-1} c_k \, P(a,k) \, Q(k+1,m) \right) \cdot Q(m,b) = T(a,m) \cdot Q(m,b).$

对于右边$(k \ge m)$:

$R = P(a,m) \cdot \sum_{k=m}^{b-1} c_k \, P(m,k) \, Q(k+1,b) = P(a,m) \cdot T(m,b).$

于是:

$  T(a,b) = T(a,m) \cdot Q(m,b) + P(a,m) \cdot T(m,b).$

#### 3\.3求和Chudnovsky 级数

我们取:

$a_k = (6k+1)(2k+1)(6k+5),\quad b_k = k^3 \cdot \frac{C^3}{24},\quad c_k = (A + Bk) \cdot (-1)^k$

那么,这个级数不包含因子$\frac{C^\frac{3}{2}}{12}$的和为:

$\frac{T(0,N)}{Q(0,N}$

我们对这个和进行上面的递归计算,最终得到下面的式子:

$\pi = \frac{\sqrt{C^3}}{12}\cdot \frac{Q}{T}$

只需要:

$\sqrt{C^3}$

1. 将整数 $Q$ 和 $T$ 转为高精度浮点数(MPFR);

2. 计算$\sqrt{C^3}$;

3. 除法并乘以$\frac{1}{12}$

---

### 4\.底层算法

```C++
#include <iostream>
#include <cmath>

// 二分分裂返回的结构：P = ∏ a_i, Q = ∏ b_i, T = ∑ c_k * P(a,k) * Q(k+1,b)
struct Result {
    long long P, Q, T;   // 实际中早溢出了
};

// 递归计算区间 [a, b) 的 (P, Q, T)
// 参数 a, b 是整数下标，对应级数项 k = a ... b-1
Result binary_split(int a, int b, 
                    long long (*a_k)(int), 
                    long long (*b_k)(int), 
                    long long (*c_k)(int)) {
    if (b == a + 1) {
        // 区间只有一个项 k = a
        return { a_k(a), b_k(a), c_k(a) };
    }
    int m = (a + b) / 2;
    Result left = binary_split(a, m, a_k, b_k, c_k);
    Result right = binary_split(m, b, a_k, b_k, c_k);
    // 合并公式：
    // P = P_left * P_right
    // Q = Q_left * Q_right
    // T = T_left * Q_right + P_left * T_right
    return {
        left.P * right.P,
        left.Q * right.Q,
        left.T * right.Q + left.P * right.T
    };
}

// ---------- Chudnovsky 级数的系数（整数形式）----------
// 标准定义 (来自 Wikipedia / y-cruncher 实现)：
//   a_k = - (6k+1)(2k+1)(6k+5)
//   b_k = (k+1)^3 * (3k+1)(3k+2) * 640320^3
//   c_k = 13591409 + 545140134 * k
// 那么 S = Σ c_k * P(0,k) / Q(0,k+1)
// 最终 π = (426880 * sqrt(10005)) / (S * 12)
//   1/π = 12 * Σ_{k=0}∞ (-1)^k (6k)! (13591409+545140134k) / ((3k)! k!^3 640320^(3k+3/2))
// 经整理后，用上述 a_k, b_k, c_k 可得：
//   π = (426880 * sqrt(10005)) / ( Σ c_k * P(0,k) / Q(0,k) )   (此处分母 Q(0,k) 定义为 ∏ b_i 从 i=0 到 k-1)

long long chud_a(int k) {
    // a_k = - (6k+1)(2k+1)(6k+5)
    long long t1 = 6LL * k + 1;
    long long t2 = 2LL * k + 1;
    long long t3 = 6LL * k + 5;
    return - (t1 * t2 * t3);
}

long long chud_b(int k) {
    // b_k = (k+1)^3 * (3k+1)(3k+2) * 640320^3
    long long k1 = k + 1;
    long long t1 = k1 * k1 * k1;   // (k+1)^3
    long long t2 = 3LL * k + 1;
    long long t3 = 3LL * k + 2;
    long long C3 = 640320LL * 640320 * 640320;  // 640320^3 ≈ 2.626e17 (略小于 9e18)
    return t1 * t2 * t3 * C3;
}

long long chud_c(int k) {
    // c_k = 13591409 + 545140134 * k
    return 13591409LL + 545140134LL * k;
}

int main() {
    // 计算前 N 项的和
    const int N = 3;
    Result res = binary_split(0, N, chud_a, chud_b, chud_c);
    
    // 此时 S = T / Q  是级数部分和（有理数）
    double S = (double)res.T / (double)res.Q;
    
    // 根据 Chudnovsky 公式，π = (426880 * sqrt(10005)) / S
    const double CONST = 426880.0 * std::sqrt(10005.0);
    double pi_approx = CONST / S;
    
    std::cout.precision(15);
    std::cout << "N = " << N << std::endl;
    std::cout << "P = " << res.P << ", Q = " << res.Q << ", T = " << res.T << std::endl;
    std::cout << "S = T/Q = " << S << std::endl;
    std::cout << "π ≈ " << pi_approx << std::endl;
    std::cout << "真实 π ≈ 3.141592653589793" << std::endl;
    
    return 0;
}
```

---

# 叁\-\-优化:

按上面的写你就等死吧,算一辈子也算不对\.龙龙你雷霆呢,才3项字长就被撑爆了,还冲击百万精度\.

## 1\.GMP

GMP用于大整数计算,能保证高精度(为什么不用模运算?我也不知道)

### \-1\.RNS

但是,其实这里可以用到一种叫做**多模数运算**(选择一组互质的模数，分别计算模每个模数的结果，再通过中国剩余定理重构大整数)来将大整数拆成小整数运算,从而适用于GPU计算\.上限高,下限也低，但是貌似能用CUDA?



后续:研究了一下,貌似不太行,下面讲一下为什么不行:

#### \-1\.1RNS \+ CRT计算过程

只讲计算过程不给定义:

取k个两两互质(最终需要拆分的数越大,模数越多)的正整数作为模数:

$\mathcal{B} = \{m_1, m_2, \dots, m_k\},\quad \gcd(m_i, m_j)=1\;(i\neq j)$

那么,记这个模数集的动态范围:

$M = m_1 \times m_2 \times m_3 \times ...... \times m_k \cdot\cdot\cdot\cdot\cdot\cdot ①$

如果一个整数$X$满足$0 \leq X \leq M$,那么这个数在这个RNS下有唯一表示\.

我们将这个整数对所有模数进行一次模运算:

$x_i= X\bmod m_i(i = 1,2,3,......,k)$

$X \xrightarrow{\text{RNS}} (x_1, x_2, \dots, x_k) \cdot\cdot\cdot\cdot\cdot\cdot    ②$

这样就拆成了小整数\.那么如何还原?

使用CRT进行还原,重构公式为:

$M_i = \frac{M}{m_i} = m_1 m_2 ......m_{i-1} m_{i+1}......m_k$

这个式子必然成立(原因是因为RNS本来就是互质能拆,而CRT只有互质能和,两者打了一个组合拳\.

另外,我们还需要一个逆元$t_i$才能计算最终结果,$t_i$计算过程如下:

因为$m_i$与其他所有模数互质,故$gcd(M_i,m_i) = 1$,于是$M_i$在模$m_i$下存在乘法逆元$t_i$,满足:

$M_i \cdot t_i \equiv 1 (\bmod m_i)$

或者写成$(\frac{M}{m_i})^{-1} = t_i(\bmod m_i)$

这个式子我们需要求出$t_i$,可以将其转换成方程组:

$a \cdot x + m \cdot y = 1,其中a=(\frac{M}{m_i})^{-1},b = m_i,t_i就是x$

但是这样需要计算一个因子y,很显然这个因子不能直接计算,所以我们采用扩展欧几里得算法,直接求出逆元:

```Plain Text
function ext_gcd(a, m):
    if m == 0:
        return (1, 0)   // 此时 a = gcd，返回系数 (x, y) 满足 a*x + 0*y = a
    else:
        (x1, y1) = ext_gcd(m, a % m)
        // 回溯得到本层的 x, y
        x = y1
        y = x1 - (a // m) * y1
        return (x, y)
```

最终的还原式子:

$X = ( \sum_{i=1}^{k}x_i \cdot M_i \cdot t_i) \bmod M$

#### \-1\.2上例子:

直接计算 $X = 17 \times 13 = 221$,使用模数 $m_1 = 3, m_2 = 5$.(这里是错的,因为要求 $M=m_1+m_2 \lt 最大值$),

- 取模:$17 \rightarrow (2,2) ， 13 \rightarrow (1,3)$

- 并行通道进行乘法运算:

    - $2\times 1 = 2 \bmod 3 = 2 $

    - $2\times 3 = 6 \bmod 5 = 1 $

    - 得到$(2,1)$\.

- CRT还原:

    - $t_1 = 2, t_2 = 2, M = m_1 \times m_2 = 15,x_1 = 2, x_2 = 1.$

    - $X = (x_1 \times \frac{M}{m_1} \times t_1, x_2 \times \frac{M}{m_2} \times t_2)$

#### \-1\.3为什么不值得?

1. 转换成本

由于CRT公式的时间复杂度为$O(k^2)$,其中k为模数,当我们需要计算L位精度时,所需的模数和位数的转换大致为:

$k = \frac{L}{log_2(模数大小)}$

假设我们使用64位的模数(实际上必须更大),如果需要计算300万位的精度,共需要163940个模数,这个数量下的模数运算最终会变成大整数加法,反而更加复杂了\.

2. 不可变的模数积

正如前面的原理讲解,RNS必须保证$0 \leq X \leq M$,这样模数的上限就被锁死了,无法降低\.

3. 复杂的正反比例关系

我希望在乘数很大的那几层(靠近根的层数)用RNS\+CRT,这样即可以避免过多系统在乘数较小的本身不需要加速的层数(靠近叶节点的层数)产生CRT模转换开销造成的影响,但是由于两重反向关系:

- 当层数减小时,理论乘值大小为指数增长,计算数量成指数下跌\.这是有利条件\.

- 当总层数增大时,理论模数数量呈对数增大,需要计算的模数和增大\.这是不利条件\.

- 当越靠近根层时,模数和的每一项数值都会以指数增长,越来越糟糕\.甚至可能会退化为更多的大整数加法,这是致命问题\.

整个系统的平衡难以寻找,并且很明显,负收益可能远远大于正收益\.

当精度需求来到十亿万亿规模下,甚至从根层往下很多层都会退化,加上额外的CRT开销,情况更加恶劣\.

### \+1\.GMP

回到正题,GMP是一个高度优化的大整数算法库\.嗯对,就这么多\.(所以为什么这章不叫RNS\+CRT而叫GMP?)

另外说一句,它对二分分裂专门做了适配,当计算数较小时,直接调用Karatsuba算法,而当计算数值过大时,进入大整数运算的范围时,则会调用FFT乘法\.

## 2\.递归链

不同叶子节点的$a_k,b_k$之间可以通过递推关系快速计算


$\frac{(6(k+1))!}{(6k)!} = (6k+1)(6k+2)......(6k+6)$

$\frac{(6(k+1))!}{(6k)!} = (k+1)^3$

$\frac{C^{3(k+1)}}{C^{3k}} = C^3$

直接批量生成叶子节点即可\.

## 3\.混合并行策略

由于二分分裂天然的并行友好性,左右子树完全独立,导致可以在合并阶段并行,采用以下四种颗粒度的并行手段

1. 叶子节点(leaf blocks)使用分块并行,每个线程计算不同的块,每个块内串行二分分治算法)

2. 层级合并(level merge)使用两种tasks并行策略

    1. 底层:tasks数量较大,足以堆满核心,直接给线程分配不同的合并任务

    2. 顶层:除了并行合并任务,每个合并内部额外创建两个tasks,进一步挖掘细粒度(要改,很多核心在摸鱼)

3. 转换层对两个转换操作并行执行,提高浮点数构造效率\.

## 4\.缓存池

添加缓存池来缓存每一个叶子数(刚好能塞进L1缓存,如果精度需求增大,缓存池就要扩展到L2里面了)

## 5\.MPI

将代码移到H100上进行扩大测试发现出现了严重的NUMA延迟

增加MPI后没啥用,测试发现问题在GMP上不在并行上\.

## 6\.FFT算法

# 肆\-\-当前代码和profile

```C++
// Solve_pi/main_mpi.cpp
// Chudnovsky 级数 + MPI + OpenMP 混合并行
// 每个 NUMA 节点一个 MPI rank，rank 内用 OpenMP 分块并行
// rank 间只在最后做一次 reduction 通信

#include "mpreal.h"
#include <gmp.h>
#include <mpi.h>
#include <chrono>
#include <cmath>
#include <string>
#include <iostream>
#include <iomanip>
#include <omp.h>
#include <vector>
#include <cstdint>

using mpfr::mpreal;

// ====== MPI mpz_t 序列化 ======

static void mpi_send_mpz(const mpz_t z, int dest, int tag)
{
    // 发送字节数
    size_t bit_size = mpz_sizeinbase(z, 2);
    size_t byte_count = (bit_size + 7) / 8;
    uint64_t bc = static_cast<uint64_t>(byte_count);
    MPI_Send(&bc, 1, MPI_UINT64_T, dest, tag, MPI_COMM_WORLD);

    // 发送符号
    int32_t sign = (mpz_sgn(z) < 0) ? 1 : 0;
    MPI_Send(&sign, 1, MPI_INT32_T, dest, tag + 1, MPI_COMM_WORLD);

    // 发送数据
    if (byte_count > 0)
    {
        std::vector<unsigned char> buf(byte_count);
        mpz_export(buf.data(), nullptr, 1, 1, 1, 0, z);
        MPI_Send(buf.data(), static_cast<int>(byte_count), MPI_UNSIGNED_CHAR,
                 dest, tag + 2, MPI_COMM_WORLD);
    }
}

static void mpi_recv_mpz(mpz_t z, int src, int tag)
{
    uint64_t bc;
    MPI_Recv(&bc, 1, MPI_UINT64_T, src, tag, MPI_COMM_WORLD, MPI_STATUS_IGNORE);
    size_t byte_count = static_cast<size_t>(bc);

    int32_t sign;
    MPI_Recv(&sign, 1, MPI_INT32_T, src, tag + 1, MPI_COMM_WORLD, MPI_STATUS_IGNORE);

    if (byte_count > 0)
    {
        std::vector<unsigned char> buf(byte_count);
        MPI_Recv(buf.data(), static_cast<int>(byte_count), MPI_UNSIGNED_CHAR,
                 src, tag + 2, MPI_COMM_WORLD, MPI_STATUS_IGNORE);
        mpz_import(z, byte_count, 1, 1, 1, 0, buf.data());
    }
    else
    {
        mpz_set_ui(z, 0);
    }
    if (sign)
        mpz_neg(z, z);
}

// ====== 主计算类 ======

class solve_pi
{
private:
    static constexpr long A = 13591409;
    static constexpr long B = 545140134;
    static constexpr long C = 640320;

    int target_digits;
    int num_terms;
    int prec_bits;
    mpreal pi_ref;

    mpz_t C3_OVER_24;
    mpreal C3_sqrt;

    int block_size;
    int parallel_combine_threshold;

    int mpi_rank, mpi_size;

    void serial_binary_split(int a, int b, mpz_t P, mpz_t Q, mpz_t T)
    {
        if (b == a + 1)
        {
            if (a == 0)
            {
                mpz_set_ui(P, 1);
                mpz_set_ui(Q, 1);
                mpz_set_si(T, A);
            }
            else
            {
                mpz_set_ui(P, 6 * a - 5);
                mpz_mul_ui(P, P, 2 * a - 1);
                mpz_mul_ui(P, P, 6 * a - 1);

                mpz_set_ui(Q, a);
                mpz_mul_ui(Q, Q, a);
                mpz_mul_ui(Q, Q, a);
                mpz_mul(Q, Q, C3_OVER_24);

                mpz_t ab_sum;
                mpz_init(ab_sum);
                mpz_set_si(ab_sum, a);
                mpz_mul_si(ab_sum, ab_sum, B);
                mpz_add_ui(ab_sum, ab_sum, A);
                mpz_mul(T, P, ab_sum);
                mpz_clear(ab_sum);

                if (a & 1)
                    mpz_neg(T, T);
            }
            return;
        }

        int m = (a + b) / 2;
        mpz_t Pl, Ql, Tl, Pr, Qr, Tr;
        mpz_init(Pl); mpz_init(Ql); mpz_init(Tl);
        mpz_init(Pr); mpz_init(Qr); mpz_init(Tr);

        serial_binary_split(a, m, Pl, Ql, Tl);
        serial_binary_split(m, b, Pr, Qr, Tr);

        mpz_mul(P, Pl, Pr);
        mpz_mul(Q, Ql, Qr);
        mpz_mul(T, Qr, Tl);
        mpz_addmul(T, Pl, Tr);

        mpz_clear(Pl); mpz_clear(Ql); mpz_clear(Tl);
        mpz_clear(Pr); mpz_clear(Qr); mpz_clear(Tr);
    }

    static int compute_total_nodes(int num_blocks)
    {
        int total = num_blocks;
        int cnt = num_blocks;
        while (cnt > 1)
        {
            cnt = (cnt + 1) / 2;
            total += cnt;
        }
        return total;
    }

    static void free_pool(mpz_t *poolP, mpz_t *poolQ, mpz_t *poolT, int n)
    {
        if (!poolP) return;
        for (int i = 0; i < n; ++i)
        {
            mpz_clear(poolP[i]);
            mpz_clear(poolQ[i]);
            mpz_clear(poolT[i]);
        }
        delete[] poolP;
        delete[] poolQ;
        delete[] poolT;
    }

    // 单个 rank 内部：分块计算 + 层级合并，结果存入 outP/outQ/outT
    void rank_compute(int rank_start, int rank_end,
                      mpz_t outP, mpz_t outQ, mpz_t outT)
    {
        int rank_terms = rank_end - rank_start;
        int num_blocks = (rank_terms + block_size - 1) / block_size;
        int total_nodes = compute_total_nodes(num_blocks);

        // 分配内存池
        mpz_t *poolP = new mpz_t[total_nodes];
        mpz_t *poolQ = new mpz_t[total_nodes];
        mpz_t *poolT = new mpz_t[total_nodes];
        for (int i = 0; i < total_nodes; ++i)
        {
            mpz_init(poolP[i]);
            mpz_init(poolQ[i]);
            mpz_init(poolT[i]);
        }

        // 叶子块并行计算（偏移 rank_start）
#pragma omp parallel for schedule(static)
        for (int blk = 0; blk < num_blocks; ++blk)
        {
            int a = rank_start + blk * block_size;
            int b = std::min(a + block_size, rank_end);
            serial_binary_split(a, b, poolP[blk], poolQ[blk], poolT[blk]);
        }

        // 层级合并
        int cur_start = 0;
        int cur_cnt = num_blocks;

        while (cur_cnt > 1)
        {
            int next_cnt = (cur_cnt + 1) / 2;
            int next_start = cur_start + cur_cnt;
            bool use_parallel = (cur_cnt <= parallel_combine_threshold);

            if (use_parallel)
            {
#pragma omp parallel for schedule(static)
                for (int i = 0; i < next_cnt; ++i)
                {
                    int left = cur_start + 2 * i;
                    int right = left + 1;
                    int out = next_start + i;
                    if (right < cur_start + cur_cnt)
                    {
                        mpz_t QxTl, PxTr;
                        mpz_init(QxTl);
                        mpz_init(PxTr);
#pragma omp task shared(QxTl)
                        mpz_mul(QxTl, poolQ[right], poolT[left]);
#pragma omp task shared(PxTr)
                        mpz_mul(PxTr, poolP[left], poolT[right]);
                        mpz_mul(poolP[out], poolP[left], poolP[right]);
                        mpz_mul(poolQ[out], poolQ[left], poolQ[right]);
#pragma omp taskwait
                        mpz_add(poolT[out], QxTl, PxTr);
                        mpz_clear(QxTl);
                        mpz_clear(PxTr);
                    }
                    else
                    {
                        mpz_set(poolP[out], poolP[left]);
                        mpz_set(poolQ[out], poolQ[left]);
                        mpz_set(poolT[out], poolT[left]);
                    }
                }
            }
            else
            {
#pragma omp parallel for schedule(static)
                for (int i = 0; i < next_cnt; ++i)
                {
                    int left = cur_start + 2 * i;
                    int right = left + 1;
                    int out = next_start + i;
                    if (right < cur_start + cur_cnt)
                    {
                        mpz_mul(poolP[out], poolP[left], poolP[right]);
                        mpz_mul(poolQ[out], poolQ[left], poolQ[right]);
                        mpz_mul(poolT[out], poolQ[right], poolT[left]);
                        mpz_addmul(poolT[out], poolP[left], poolT[right]);
                    }
                    else
                    {
                        mpz_set(poolP[out], poolP[left]);
                        mpz_set(poolQ[out], poolQ[left]);
                        mpz_set(poolT[out], poolT[left]);
                    }
                }
            }

            cur_start = next_start;
            cur_cnt = next_cnt;
        }

        // 拷贝最终结果
        mpz_set(outP, poolP[cur_start]);
        mpz_set(outQ, poolQ[cur_start]);
        mpz_set(outT, poolT[cur_start]);

        free_pool(poolP, poolQ, poolT, total_nodes);
    }

public:
    solve_pi(int digits = 1000000, int blk_size = 64)
        : target_digits(digits), block_size(blk_size), parallel_combine_threshold(16),
          mpi_rank(0), mpi_size(1)
    {
        prec_bits = static_cast<int>(digits * std::log2(10.0)) + 64;
        num_terms = static_cast<int>(digits / 14.18) + 10;
        mpreal::set_default_prec(prec_bits);
        pi_ref = mpfr::const_pi();

        mpz_init(C3_OVER_24);
        mpz_set_str(C3_OVER_24, "10939058860032000", 10);

        mpreal C3 = mpreal(C) * C * C;
        C3_sqrt = sqrt(C3);
    }

    ~solve_pi()
    {
        mpz_clear(C3_OVER_24);
    }

    solve_pi(const solve_pi &) = delete;
    solve_pi &operator=(const solve_pi &) = delete;

    int get_num_terms() const { return num_terms; }
    int get_target_digits() const { return target_digits; }

    mpreal calculate()
    {
        MPI_Comm_rank(MPI_COMM_WORLD, &mpi_rank);
        MPI_Comm_size(MPI_COMM_WORLD, &mpi_size);

        if (mpi_rank == 0)
        {
            std::cout << "=== Chudnovsky + MPI/OpenMP Hybrid ===" << std::endl;
            std::cout << "Target digits    : " << target_digits << std::endl;
            std::cout << "Terms needed     : " << num_terms << std::endl;
            std::cout << "MPI ranks        : " << mpi_size << std::endl;
            std::cout << "OMP threads/rank : " << omp_get_max_threads() << std::endl;
            std::cout << "Block size       : " << block_size << std::endl;
            std::cout << std::endl;
        }

        // ---- 均分 term 区间给各 rank ----
        int terms_per_rank = (num_terms + mpi_size - 1) / mpi_size;
        int rank_start = mpi_rank * terms_per_rank;
        int rank_end = std::min(rank_start + terms_per_rank, num_terms);
        // 处理末尾 rank 无任务的情况
        if (rank_start >= num_terms)
        {
            rank_start = 0;
            rank_end = 0;
        }

        // ---- Phase 1: 各 rank 本地计算 ----
        double local_compute_time = 0;
        mpz_t local_P, local_Q, local_T;
        mpz_init(local_P);
        mpz_init(local_Q);
        mpz_init(local_T);

        if (rank_end > rank_start)
        {
            auto t0 = std::chrono::high_resolution_clock::now();
            rank_compute(rank_start, rank_end, local_P, local_Q, local_T);
            auto t1 = std::chrono::high_resolution_clock::now();
            local_compute_time = std::chrono::duration<double>(t1 - t0).count();
        }
        else
        {
            // 空 rank：贡献单位元 P=1, Q=1, T=0
            mpz_set_ui(local_P, 1);
            mpz_set_ui(local_Q, 1);
            mpz_set_ui(local_T, 0);
        }

        MPI_Barrier(MPI_COMM_WORLD);

        if (mpi_rank == 0)
        {
            std::cout << "Phase 1: Local compute done." << std::endl;
            // 收集各 rank 计算时间取最大值
            double max_compute_time;
            MPI_Reduce(&local_compute_time, &max_compute_time, 1, MPI_DOUBLE,
                       MPI_MAX, 0, MPI_COMM_WORLD);
            std::cout << "  Max compute time: " << std::fixed << std::setprecision(3)
                      << max_compute_time << " s" << std::endl;
        }
        else
        {
            MPI_Reduce(&local_compute_time, nullptr, 1, MPI_DOUBLE,
                       MPI_MAX, 0, MPI_COMM_WORLD);
        }

        // ---- Phase 2: MPI 二叉树 reduction ----
        if (mpi_rank == 0)
            std::cout << "Phase 2: MPI reduction..." << std::endl;

        auto t2 = std::chrono::high_resolution_clock::now();

        int stride = 1;
        while (stride < mpi_size)
        {
            if (mpi_rank & stride)
            {
                // 奇数位 rank：发送后退出
                mpi_send_mpz(local_P, mpi_rank - stride, stride * 10);
                mpi_send_mpz(local_Q, mpi_rank - stride, stride * 10 + 1);
                mpi_send_mpz(local_T, mpi_rank - stride, stride * 10 + 2);
                break;
            }
            else if (mpi_rank + stride < mpi_size)
            {
                // 偶数位 rank：接收并合并
                mpz_t recv_P, recv_Q, recv_T;
                mpz_init(recv_P);
                mpz_init(recv_Q);
                mpz_init(recv_T);

                mpi_recv_mpz(recv_P, mpi_rank + stride, stride * 10);
                mpi_recv_mpz(recv_Q, mpi_rank + stride, stride * 10 + 1);
                mpi_recv_mpz(recv_T, mpi_rank + stride, stride * 10 + 2);

                // 合并：保存 P_left，然后计算
                // P = P_left * P_right
                // Q = Q_left * Q_right
                // T = Q_right * T_left + P_left * T_right
                mpz_t P_left;
                mpz_init(P_left);
                mpz_swap(P_left, local_P); // O(1) 交换，保存原始 local_P

                mpz_mul(local_P, P_left, recv_P);
                mpz_mul(local_Q, local_Q, recv_Q);
                mpz_mul(local_T, recv_Q, local_T); // local_T = Q_right * T_left
                mpz_addmul(local_T, P_left, recv_T); // local_T += P_left * T_right

                mpz_clear(P_left);
                mpz_clear(recv_P);
                mpz_clear(recv_Q);
                mpz_clear(recv_T);
            }
            stride <<= 1;
        }

        auto t3 = std::chrono::high_resolution_clock::now();
        double reduction_time = std::chrono::duration<double>(t3 - t2).count();

        if (mpi_rank == 0)
        {
            std::cout << "  Reduction time : " << std::fixed << std::setprecision(3)
                      << reduction_time << " s" << std::endl;
        }

        // ---- Phase 3: 最终转换（仅 rank 0）----
        mpreal pi_val;
        if (mpi_rank == 0)
        {
            std::cout << "Phase 3: Final conversion..." << std::endl;
            auto t4 = std::chrono::high_resolution_clock::now();

            mpreal Q_mpfr, T_mpfr;
#pragma omp parallel sections
            {
#pragma omp section
                mpfr_set_z(Q_mpfr.mpfr_ptr(), local_Q, MPFR_RNDN);
#pragma omp section
                mpfr_set_z(T_mpfr.mpfr_ptr(), local_T, MPFR_RNDN);
            }
            pi_val = Q_mpfr * C3_sqrt / (mpreal(12) * T_mpfr);

            auto t5 = std::chrono::high_resolution_clock::now();
            double conv_time = std::chrono::duration<double>(t5 - t4).count();
            std::cout << "  Convert time   : " << std::fixed << std::setprecision(3)
                      << conv_time << " s" << std::endl;
        }

        mpz_clear(local_P);
        mpz_clear(local_Q);
        mpz_clear(local_T);

        if (mpi_rank == 0)
            std::cout << std::endl;

        return pi_val;
    }

    std::string to_fixed_string(const mpreal &value, int decimals)
    {
        size_t buf_size = static_cast<size_t>(decimals) + 64;
        char *buffer = new char[buf_size];
        mpfr_snprintf(buffer, buf_size, "%.*Rf", decimals, value.mpfr_srcptr());
        std::string s(buffer);
        delete[] buffer;
        size_t dot = s.find('.');
        if (dot != std::string::npos)
            s.erase(s.find_last_not_of('0') + 1);
        return s;
    }

    int verification(const mpreal &pi)
    {
        std::string my_str = to_fixed_string(pi, target_digits + 10);
        std::string ref_str = to_fixed_string(pi_ref, target_digits + 10);
        size_t min_len = std::min(my_str.size(), ref_str.size());
        for (size_t i = 2; i < min_len; ++i)
        {
            if (my_str[i] != ref_str[i])
                return static_cast<int>(i - 2);
        }
        return -1;
    }
};

int main(int argc, char *argv[])
{
    MPI_Init(&argc, &argv);

    constexpr int TARGET_DIGITS = 1000000;

    solve_pi solve(TARGET_DIGITS, 64);

    auto start = std::chrono::high_resolution_clock::now();
    mpreal my_pi = solve.calculate();
    auto end = std::chrono::high_resolution_clock::now();
    double total = std::chrono::duration<double>(end - start).count();

    int rank;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);

    if (rank == 0)
    {
        std::cout << "First 100 digits: " << std::setprecision(100) << my_pi << std::endl;

        int eval = solve.verification(my_pi);
        if (eval != -1)
            std::cout << "Significant digits: " << eval << std::endl;
        else
            std::cout << "All " << solve.get_target_digits() << " digits match." << std::endl;

        std::cout << "Total time       : " << std::fixed << std::setprecision(3) << total << " s" << std::endl;
        std::cout << "Throughput       : " << std::fixed << std::setprecision(0)
                  << solve.get_target_digits() / total << " digits/s" << std::endl;
    }

    MPI_Finalize();
    return 0;
}

```

```PowerShell
=== Chudnovsky + Block Parallel ===
Target digits    : 1000000
Terms needed     : 70531
Block size       : 64
Number of blocks : 1103
Pool nodes       : 2211
Combine parallel : <= 16 nodes/level
OMP threads      : 48

Phase 1: Leaf blocks...
  Leaf time       : 0.006 s
Phase 2: Level merge...
  Merge time      : 0.077 s
Phase 3: Final conversion...
  Convert time    : 0.039 s

First 100 digits: 3.1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170680
All 1000000 digits match.
Total time       : 0.122 s
Throughput       : 8191146 digits/s
```

精度330万比特位左右(100万十进制位,这里没输出),每秒计算819万比特位位的精度

其实现在的速度已经到极限优化行列了,再继续探索就可以到一个很nb的地位

# CUDA:

参考GPU版本5秒计算10亿位:

[GitHub \- fanhqme2/gpupi: Computing 1000000000 digits of pi on GPU, in 5 seconds\.](https://github.com/fanhqme2/gpupi)

其实我也自己写了一份,但是效果不理想,不放出来了.

# 写在最后:

啥叫算法优化?看两段段代码\.

```Python
class Solution:
    def rangeAddQueries(self, n: int, queries: List[List[int]]) -> List[List[int]]:
        diff = [[0] * (n + 1) for _ in range(n + 1)]
        for r1, c1, r2, c2 in queries:
            diff[r1][c1] += 1
            diff[r1][c2 + 1] -= 1
            diff[r2 + 1][c1] -= 1
            diff[r2 + 1][c2 + 1] += 1
        result = [[0] * n for _ in range(n)]
        for i in range(n):
            for j in range(n):
                if i > 0:
                    diff[i][j] += diff[i-1][j]
                if j > 0:
                    diff[i][j] += diff[i][j-1]
                if i > 0 and j > 0:
                    diff[i][j] -= diff[i-1][j-1]
                result[i][j] = diff[i][j]
        return result
```

```Python
class Solution:
    def rangeAddQueries(self, n: int, queries: List[List[int]]) -> List[List[int]]:
        diff = [[0] * (n + 2) for _ in range(n + 2)]
        for r1, c1, r2, c2 in queries:
            diff[r1][c1] += 1
            diff[r1][c2 + 1] -= 1
            diff[r2 + 1][c1] -= 1
            diff[r2 + 1][c2 + 1] += 1
        mat = [[0] * (n) for _ in range(n)]
        for i in range(n):
            cur = 0
            for j in range(n):
                cur += diff[i][j]
                if i > 0:
                    mat[i][j] = cur + mat[i - 1][j]
                else:
                    mat[i][j] = cur
        return mat
```

这是leetcode每日一题第2536题\.

[2536\. 子矩阵元素加 1 \- 力扣（LeetCode）](https://leetcode.cn/problems/increment-submatrices-by-one/?envType=daily-question&envId=2026-03-31)

解法一是我的解法,解法二是时间分布排行榜最前的解法\.

他的解法和我一样都是用二维前缀和\+差分矩阵来解题\.

当时看到这个答案我都怀疑他开了会员,用的专用测试机,同样的解法能比我快两倍\.

差分矩阵构建和我的一样,唯一的不同就是前缀和的更新\.他采用了两个加法和一个判断来更新,比我的算法少了两个判断,多了一个加法,但是他的用时是我的**二分之一\.**

多两个if最终效率天差地别\.(其实他那个才是前缀和更新的标准写法,但是**可读性没我高**)

**当然,他这个其实是内存换效率(实际上就多了一点点),但是在时间优化上非常值得一改\.**

**然而实际上不推荐手动优化代码，你优化的肯定没有编译器厉害，除非手动实现向量化(你虽然向量化的也没有AI厉害)，否则编译器做的优化始终更好，应该注重怎么配合编译器优化而不是自己优化给编译器找麻烦。**

