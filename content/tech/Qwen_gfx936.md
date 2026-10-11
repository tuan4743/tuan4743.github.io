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

期末前两个星期干了一件非常糖(saulty)的事情,我一直在插Vllm的桩,找那个profile数据里面耗时最大的函数到底叫啥.  

但是问题是**Vllm启动是两层**,一层是APISever父进程,一层是EngineCore子进程,spawn子进程的过程不会继承(inherit)父进程的env,导致桩和trace经常会被拦在第一层,进不去子进程.但是模型的实际计算调用却是在子进程中的.  

第二个问题是**狗屎(dog_shit)**机器的vllm只允许non-editable安装,每次都要重(repeatedly)装wheel,然后神秘缓存(hyw cache)就开始发力了,hook莫名奇妙就被丢掉了.又不能(no)改dtk包,因为别人还要用.  

还要一个扫(cleaned)的:gpu.model_runner 和 gpu_model_runner是vllm服务的两个runner(V1和V2),这谁绷的住(hold on).  

最后还是力大砖飞(big fuck),打印运行时的snapshoot,然后在其中发现了 Triton autotune 的 L2-cache-flush buffer(triton/backends/amd/driver.py:718-721 写死 256MB int32 + do_bench 反复 zero_()),161 个 EXACT_256MB 块命中.  

### 结果

比赛结束的第二天(play day),我上GitHub搜了一下,发现早就有答案了:[GitHub](https://github.com/pytorch/pytorch/issues/93509).这个事情告诉我们一定要关注开源社区,不要搁那使劲钻.甚至连钩子都有(白干(white do)这一块):[GitHub](https://github.com/pytorch/pytorch/blob/main/torch/cuda/_memory_viz.py)

## 算子插桩

### 被害者陈述

为了查 GEMM 归属,又造了三个钩子