---
title: "Qwen27B-gfx936适配"
date: 2026-10-10T22:00:00+08:00
draft: false
tags: ["GitHub", "AI", "推理优化", "vllm", "海光系列"]
summary: "整理一下先导杯"
comments: true
---
再不写我都忘了.  
因为雷霆失误,导致最后遗憾退场.
[GitHub](https://github.com/tuan4743/Qwen-DCU-optimization)

# 简介

本赛题以 Qwen3.5-27B(MoE:64 层 = 48 层 GDN 门控增量网络 + 16 层全注意力,hidden 5120,vocab 248320)为对象,在非 CUDA 主流栈(ROCm 家族)的海光 DCU gfx936 上完成 vLLM 全链路适配与算子级重写适配。  
[赛题链接](https://course.educg.net//pages/contest/contest.jsp?contestID=rF1452h6En0&tabDocID=10424454&my=false&contestCID=0#contestSubAn)  

总体来说就是在非常限制(limited)的场景下完成对vllm在gfx936的适配和推理优化.  

# 心路历程

## 插桩

### 受害者陈述

期末前两个星期干了一件非常糖的事情，我一直在插Vllm的桩，找那个profile数据里面耗时最大的函数到底叫啥。  

但是问题是 **Vllm启动是两层** ，一层是APISever父进程,一层是EngineCore子进程，spawn子进程的过程不会继承父进程的env，导致桩和trace经常会被拦在第一层，进不去子进程。但是模型的实际计算调用却是在子进程中的。  

第二个问题是 **狗屎** 机器的vllm只允许non-editable安装，每次都要重装wheel，然后神秘缓存就开始发力了，hook莫名奇妙就被丢掉了.又不能改dtk包，因为别人还要用。  

还要一个扫的:gpu.model_runner 和 gpu_model_runner是vllm服务的两个runner(V1和V2)，这谁绷的住。  

最后还是力大砖飞，打印运行时的snapshoot，然后在其中发现了 Triton autotune 的 L2-cache-flush buffer(triton/backends/amd/driver.py:718-721 写死 256MB int32 + do_bench 反复 zero_())，161 个 EXACT_256MB 块命中。  

### 结果

比赛结束的第二天(play day),我上GitHub搜了一下,发现早就有答案了:[GitHub](https://github.com/pytorch/pytorch/issues/93509).这个事情告诉我们一定要关注开源社区,不要搁那使劲钻.甚至连钩子都有(白干(white do)这一块):[GitHub](https://github.com/pytorch/pytorch/blob/main/torch/cuda/_memory_viz.py)

## 算子插桩 + 重写

孤注一掷还是败了，我的学生们都在看着呢，让我再耍耍帅吧。  

### 被害者陈述

为了查 GEMM 归属，又造了三个钩子去抓核名的op标签，然后搞了两天来回修，修的发现不对劲，然后跑去查，结果发现奈奈的，造钩子的时候原本想插的位置是record——function，因为这个函数在加载过程中被载入到程序中，并且函数直接关联kernel的核名，但是结果是这个函数是CPU侧元数据事件，导致这玩意根本就没有进cudagraph的静态图。  

然后不搞了，改用 eager trace 邻接推断 + 抓  qkvz 形状 + 做了三方的benchmark（vLLM dispatch / hipBLASLt / rocBLAS）搞了两天才推断出 op 标签是 LLMM1。  

然后还有第三关，抓出来的算子中，只有 decode 阶段的 rocBLAS 有一点点的提升空间，其他的要么没用rocBLAS，直接用的LLMM1（比如GDN的三层投影），要么就根本耗时不长（decode阶段耗时差不多一半多）。只有FFN gate_up GEMV，算子实测只有 390.7us 的极限速度，上限是 111us，尝试改写成splitk-K（找函数名也找了半天，差点没找到），最终极限性能 298us。但是问题就是集成过程由于集成链，需要对齐5个对接点，然后编译含有_rocm_C.so的wheel，尝试了两天，一直报错，最终没时间以失败告终。

## 其他

### ssh连接

ssh吃大了，使用agent难免都会吃到机器访问的构式，没有及时固化文件管理系统，导致老是卡在ssh访问上。  

然后就是ssh速度问题，密码的就算是vscode直连，也只能保证代码和指令中字的顺序不会乱（使用scnet如果打快了字的顺序会乱）。  

### 测试

测试也吃了一坨大的，由于单台机器，机器在进行测试的时候，必须吃满一张卡，导致同时只能有一个人在进行测试，其他人只能干看着。最开始启动vllm服务需要整整一个小时狗屎服务器磁盘速度太慢了，加载模型要整整五十多分钟，后面换了一个启动脚本才压到6分钟。  

然后还有第二关，编译。由于最开始是只是增量编译，所以耗时并不长，最多两分钟，但是后面改算子需要重编译，编译10分钟然后一个宇宙大停顿20分钟再继续编，爆出来个错是最搞笑的。  

也是熬穿了，天天3点睡，提交前的的一天直接没睡。最终也没个好结果。  

### 工具链

**我说不要开鸡煲笑话。**

最主要的问题都在写算子过程。第一关是矩阵乘 v_mfma_*，明明单独编译过程就能通过，按理来说就能跑，但是跑的时候就 VMFault。两个问题：
- 反编译自带的 hipBLASLt，发现里面根本就没有 v_mfma。- 宏头 __HIP__GFX9__ 没有设备编号gfx936，导致也报了一个VMFault的错误。  

然后是某高人指导说这个机器的 wave/CU 最大是2，但是实际测出来居然是 6-12wave/CU ，不知道什么问题，可能是测试工具不对。

然后是容器的 profile ，只能用 rocprof，或者用官方提供的轻量工具，完全不够用，剩下的只能抓虾或者推测。rocprof提供的数据也少的可怜，只有各函数时间等，抓不到各变量名，具体指标等。

# 教训

噶人们不要闷头搞，要关注GitHub等开源社区，这次好多东西都能在上面直接找到答复，不需要我搁这里自己摸索浪费时间。

整场初赛搞得我跟一直摸鱼一样。