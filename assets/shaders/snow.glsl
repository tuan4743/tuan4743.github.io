/* ============================================================
   雪(第五张盘 · 未来)—— 来自用户提供的 static/temp/snow.glsl
   ─────────────────────────────────────────────────────────────
   原文件是 Shadertoy 格式(snow,作者注释里注明噪声部分来自 stegu)。
   这里只做四处改造,噪声与雪层的数学一字未改:
     1. 顶部补 uniform:流速 / 缩放 / 密度 / 压暗 / 雾底,不再写死 speed=2.0
     2. 五层雪(8/6/4/3/1.2)的整体缩放接上 uScale → 雪更密更细
     3. 五层的 smoothstep 阈值接上 uGrow → 阈值放低,雪花更大更饱满
     4. 输出加一层 pow 压暗 + 冷色调:底是深蓝灰、雪花仍是亮白,
        不会把整块屏幕打成一片死白(范例是亮雪,想要原样就把 uDark 调成 1.0)
   ============================================================ */

/* ---- 可调参数(boot-glsl.js 每帧设置,见 cd-boot.js 的 SNOW_T)---- */
uniform float uSpeed;   /* 流速:范例 speed=2.0 → 现在默认 5.2 */
uniform float uScale;   /* 整体缩放:越大雪花越密越细 */
uniform float uGrow;    /* 密度/饱满度:1.0 = 范例原样,越大雪越多越大 */
uniform float uDark;    /* 压暗指数:1.0 = 范例原样(很亮),越大底越暗 */
uniform float uBias;    /* 底色雾亮度 */
uniform float uSun;     /* 太阳强度:1.0 = 范例原样(很曝),越小越像柔和光晕 */

    // This shader useds noise shaders by stegu -- http://webstaff.itn.liu.se/~stegu/
    // This is supposed to look like snow falling, for example like http://24.media.tumblr.com/tumblr_mdhvqrK2EJ1rcru73o1_500.gif

		vec2 mod289(vec2 x) {
		  return x - floor(x * (1.0 / 289.0)) * 289.0;
		}

		vec3 mod289(vec3 x) {
		  	return x - floor(x * (1.0 / 289.0)) * 289.0;
		}

		vec4 mod289(vec4 x) {
		  	return x - floor(x * (1.0 / 289.0)) * 289.0;
		}

		vec3 permute(vec3 x) {
		  return mod289(((x*34.0)+1.0)*x);
		}

		vec4 permute(vec4 x) {
		  return mod((34.0 * x + 1.0) * x, 289.0);
		}

		vec4 taylorInvSqrt(vec4 r)
		{
		  	return 1.79284291400159 - 0.85373472095314 * r;
		}

		float snoise(vec2 v)
		{
				const vec4 C = vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
				vec2 i  = floor(v + dot(v, C.yy) );
				vec2 x0 = v -   i + dot(i, C.xx);

				vec2 i1;
				i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
				vec4 x12 = x0.xyxy + C.xxzz;
				x12.xy -= i1;

				i = mod289(i); // Avoid truncation effects in permutation
				vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
					+ i.x + vec3(0.0, i1.x, 1.0 ));

				vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
				m = m*m ;
				m = m*m ;

				vec3 x = 2.0 * fract(p * C.www) - 1.0;
				vec3 h = abs(x) - 0.5;
				vec3 ox = floor(x + 0.5);
				vec3 a0 = x - ox;

				m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );

				vec3 g;
				g.x  = a0.x  * x0.x  + h.x  * x0.y;
				g.yz = a0.yz * x12.xz + h.yz * x12.yw;

				return 130.0 * dot(m, g);
		}

		float cellular2x2(vec2 P)
		{
				#define K 0.142857142857 // 1/7
				#define K2 0.0714285714285 // K/2
				#define jitter 0.8 // jitter 1.0 makes F1 wrong more often

				vec2 Pi = mod(floor(P), 289.0);
				vec2 Pf = fract(P);
				vec4 Pfx = Pf.x + vec4(-0.5, -1.5, -0.5, -1.5);
				vec4 Pfy = Pf.y + vec4(-0.5, -0.5, -1.5, -1.5);
				vec4 p = permute(Pi.x + vec4(0.0, 1.0, 0.0, 1.0));
				p = permute(p + Pi.y + vec4(0.0, 0.0, 1.0, 1.0));
				vec4 ox = mod(p, 7.0)*K+K2;
				vec4 oy = mod(floor(p*K),7.0)*K+K2;
				vec4 dx = Pfx + jitter*ox;
				vec4 dy = Pfy + jitter*oy;
				vec4 d = dx * dx + dy * dy; // d11, d12, d21 and d22, squared
				// Sort out the two smallest distances

				// Cheat and pick only F1
				d.xy = min(d.xy, d.zw);
				d.x = min(d.x, d.y);
				return d.x; // F1 duplicated, F2 not computed
		}

		float fbm(vec2 p) {
 		   float f = 0.0;
    		float w = 0.5;
    		for (int i = 0; i < 5; i ++) {
						f += w * snoise(p);
						p *= 2.;
						w *= 0.5;
    		}
    		return f;
		}

		void mainImage( out vec4 fragColor, in vec2 fragCoord )
		{
				float speed = 2.0 * uSpeed;          /* ← 原为写死的 2.0 */

				vec2 uv = fragCoord.xy / iResolution.xy;

				uv.x*=(iResolution.x/iResolution.y);

				vec2 suncent=vec2(0.3,0.9);

				float suns=(1.0-distance(uv,suncent));
				suns=clamp(0.2+suns,0.0,1.0);
				float sunsh=smoothstep(0.85,0.95,suns);

				float slope;
				slope=0.8+uv.x-(uv.y*2.3);
				slope=1.0-smoothstep(0.55,0.0,slope);

				float noise=abs(fbm(uv*1.5*uScale));
				slope=(noise*0.2)+(slope-((1.0-noise)*slope*0.1))*0.6;
				slope=clamp(slope,0.0,1.0);

				vec2 GA = vec2(0.0);                 /* ← 原为未初始化(未定义行为),补成 0 */
				GA.x-=iTime*1.8;
				GA.y+=iTime*0.9;
				GA*=speed;

				float F1=0.0,F2=0.0,F3=0.0,F4=0.0,F5=0.0,N1=0.0,N2=0.0,N3=0.0,N4=0.0,N5=0.0;
				float A=0.0,A1=0.0,A2=0.0,A3=0.0,A4=0.0,A5=0.0;


				// Attentuation
				A = (uv.x-(uv.y*0.3));
				A = clamp(A,0.0,1.0);

				// Snow layers, somewhat like an fbm with worley layers.
				/* 阈值 0.998/0.995/0.99/0.98/0.98 除以 uGrow:
				   uGrow > 1 → 阈值更低 → 每层雪更大更饱满(密度上去了) */
				F1 = 1.0-cellular2x2((uv+(GA*0.1))*8.0*uScale);
				A1 = 1.0-(A*1.0);
				N1 = smoothstep(1.0-0.002/uGrow,1.0,F1)*1.0*A1;

				F2 = 1.0-cellular2x2((uv+(GA*0.2))*6.0*uScale);
				A2 = 1.0-(A*0.8);
				N2 = smoothstep(1.0-0.005/uGrow,1.0,F2)*0.85*A2;

				F3 = 1.0-cellular2x2((uv+(GA*0.4))*4.0*uScale);
				A3 = 1.0-(A*0.6);
				N3 = smoothstep(1.0-0.01/uGrow,1.0,F3)*0.65*A3;

				F4 = 1.0-cellular2x2((uv+(GA*0.6))*3.0*uScale);
				A4 = 1.0-(A*1.0);
				N4 = smoothstep(1.0-0.02/uGrow,1.0,F4)*0.4*A4;

				F5 = 1.0-cellular2x2((uv+(GA))*1.2*uScale);
				A5 = 1.0-(A*1.0);
				N5 = smoothstep(1.0-0.02/uGrow,1.0,F5)*0.25*A5;

				float Snowout=N5+N4+N3+N2+N1;

				/* 太阳那一大团白会被 uSun 压下来 —— 否则左上角一片死白,
				   从那儿入场的巨大雪花和扫线会看不见 */
				Snowout = 0.35+(slope*(0.3+suns*uSun))+(sunsh*0.6*uSun)+N1+N2+N3+N4+N5;

				/* 压暗 + 冷色调:底变深蓝灰,雪花保持亮白 */
				float v = clamp(Snowout, 0.0, 1.0);
				v = pow(v, uDark);
				vec3 col = vec3(v * 0.86, v * 0.95, v * 1.10) + vec3(0.010, 0.018, 0.034) * uBias;
				fragColor = vec4(col, 1.0);
		}
