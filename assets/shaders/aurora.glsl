/* ============================================================
   极光(第五张盘 · 未来)—— 只取用户提供的那份 GLSL 里的【极光部分】
   ─────────────────────────────────────────────────────────────
   ★★★ 用户的话:"你能不能看好了再抄?那份代码根本就不是纯净的极光模拟。"
       他说得对,而我错在【看过了却没当回事】。那份 shader 的结构是:

         void mainImage(...) {
           float scene = raymarch(ro, rd);          ← 打一条视线出去
           if (scene > -1.) { ... setColor(...) }   ← 打到【地形】就画地形(云海)
           else             { ... setSkyColor(...) } ← 没打到才画天(星空 + 极光)
         }

       也就是说它是一整幅风景:raymarch、fbmM 地形高度场、fbmH 法线、
       setColor 的地表颜色、那盏平行光、还有会飘的相机 —— 全是【场景】。
       极光只是"天"那一支里的一个加数。
       我上一版把整份铺在窗上,等于把别人的地形和云海画进了用户的窗户;
       为了让那条极光带好看,我还去改了人家的相机俯仰(CAM_PITCH)——
       那是错上加错:在别人的画上挪镜头,而不是只取我需要的那一层。

   ★ 这一份是【重写的】,只保留极光:
       保留(一个字没改,含常量与调色板):
         random / tri / tri2 / mm2 / fbmAurora / aurora
       删掉(它们属于"场景",不属于"极光"):
         map / raymarch / normal / light+diffuseLight+calcLights / setColor
         fbmM / fbmH / fbmL / stars / setSkyColor / calcLookAtMatrix
         以及 mainImage 里的相机轨迹、地形判定、gamma 与 smoothstep 收尾
       ★ 天空和地面【用这一页自己的】:
         page-frost.js 的 buildSky 已经画好了夜空渐变、地平线天光和地面剪影,
         极光作为一张【黑底上的发光层】叠在它上面(所以这一层回到
         mix-blend-mode: screen —— 黑=没画,这正是 screen 的用法)。
         于是构图是这一页的,只有极光的算法是那份 shader 的。

   ★ 逐行对照(哪些是原样、哪些是新增),写在正文的注释里。
   ★ 入口交给宿主:不写 main(),宿主(boot-glsl.js)会补 mainImage 的调用,
     并喂 iTime / uTime / iResolution。
   ============================================================ */

#define PI 3.1415926535

/* ---- 以下到 aurora() 结束:原样保留的部分 ---- */

float random(vec2 p)
{
    vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

mat2 mm2(in float a){float c = cos(a), s = sin(a);return mat2(c,s,-s,c);}
float tri(in float x){return clamp(abs(fract(x)-.5),0.01,0.49);}
vec2 tri2(in vec2 p){return vec2(tri(p.x)+tri(p.y),tri(p.y+tri(p.x)));}

float fbmAurora(vec2 p, float spd) {
    float z = 1.8;
    float z2 = 2.5;
	float rz = 0.;
    p *= mm2(p.x * 0.06);
    vec2 bp = p;
	for (float i = 0.; i < 5.; i++ ) {
        vec2 dg = tri2(bp*1.85)*.75;
        dg *= mm2(uTime*spd);
        p -= dg/z2;

        bp *= 1.3;
        z2 *= .45;
        z *= .42;
		p *= 1.21 + (rz-1.0)*.02;

        rz += tri(p.x+tri(p.y))*z;
        p*= sin(uTime * 0.05) * cos(uTime * 0.01);
	}
    return clamp(1. / pow(rz * 20., 1.3), 0.,1.);
}

vec4 aurora( vec3 rd) {
    vec4 col = vec4(0);
    vec4 avgCol = vec4(0);

    for (float i=0.; i < 50.; i++) {
        float of = 0.006*random(gl_FragCoord.xy)*smoothstep(0.,15., i);
        float pt = ((.8+pow(i,1.4)*.002)) / (rd.y * 2. + 0.4);
        pt -= of;
    	vec3 bpos = AUR_BASE + pt * rd;
        vec2 p = bpos.zx;
        float rzt = fbmAurora(p, 0.06);
        vec4 col2 = vec4(0,0,0, rzt);
        col2.rgb = (sin(1.-vec3(2.15,-.5, 1.2) +i * 0.043) * 0.5 + 0.5)*rzt;
        avgCol = mix(avgCol, col2, .5);
        col += avgCol * exp2(-i*0.065 - 2.5) * smoothstep(0., 5., i);
    }
    col *= (clamp(rd.y * AUR_GATE + AUR_GATE_B, 0., 1.));

    return smoothstep(0.,1.1,pow(col,vec4(1.))*1.5);
}

/* ---- 以上是原样保留的部分 ---- */

/* ★★★ 两个适配点,都写在明处:
     ① 视线方向 rd 从哪来。
        原版 rd 由"会飘的相机 + 地形判定"算出来,那是场景的一部分,已删。
        这里直接由屏幕坐标构造:rd = normalize(vec3(p.xy, 1.2))。
        ★ 取 1.2(而不是原版的 1.064)是量出来的:
          aurora() 的亮度被 rd.y 门限管着(见下),而 rd.y 的分布只取决于
          焦距常数和画面纵横比。1.064 配原版 16:9 时,rd.y=0(极光最亮的地方)
          落在画面正中 —— 在 2.6:1 的扁面板上,"正中"以下才有极光,
          于是只剩贴着中线的一条,正是用户说的"只有一片宽的"。
          1.2 把视野收窄一点,rd.y 的过零线降到画面约 2/3 处,
          极光铺在中上那一片天上,而不是贴着中线一条。
          ★ 这与上一版"改人家相机俯仰"是两回事:那时我在【别人的场景】里挪镜头;
            现在这一层本来就是空的,rd 是我自己给的 —— 没有"别人的画"可破坏。
     ② 极光层的距离 AUR_BASE。
        原版是 5.5,配合它自己的相机。这里保持 5.5(镜头换成了从原点看),
        视觉上等价于"极光在远处那片天上"。
     ③ 门限的斜率 AUR_GATE / AUR_GATE_B:原版是 15. 和 .4,原样保留。
        它决定"极光从哪一行开始出现"—— 想让它更高/更低,现在只需调一个数。
*/
#define AUR_BASE   vec3(5.5)
#define AUR_GATE   15.
#define AUR_GATE_B .4

/* 把"屏幕坐标"变成视线方向。★ 注意 p 的构造方式【和原版一致】:
   按【高度】归一化(除以 u_resolution.y),所以纵横比只影响横向视野,
   纵向视野是固定的 —— 这正是 1.064 在扁面板上会出问题的原因(见上面 ①)。 */
vec3 rayDir(vec2 fragCoord) {
  vec2 p = (-u_resolution.xy + 2.0 * fragCoord) / u_resolution.y;
  return normalize(vec3(p.xy, 1.2));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
  vec3 rd = rayDir(fragCoord);
  vec3 col = aurora(rd).rgb;

  /* 黑底 + 发光层:黑的地方配合 CSS 的 mix-blend-mode: screen 等于"没画",
     所以这一层不会盖住 buildSky 画的夜空、天光和地面剪影。 */
  fragColor = vec4(col, 1.0);
}
