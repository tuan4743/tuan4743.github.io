/* 生成物 —— 由 tools/dat-to-chart.ts 从 CCLocalLevels.dat 生成,别手改。
 * 关卡:WATER · 物件 8980 个(含 1 条补的地面)· 长 3620 块 · 高 127 格
 * 段:按形态门/速度门切,共 72 段
 * 重新生成:cd gd-web && node tools/dat-to-chart.ts --level=WATER
 *
 * 物件表格式:每行 "code b r [w] [h] [key=value …]",默认 w=h=1 —— 见 sim/gdids.ts 的文件头。
 */
import { makeChart } from '../gdids.ts';

const TABLE = `
S 203 0 id=8
S 204 0 id=8
S 203 3 rot=180 id=8
S 204 3 rot=180 id=8
D 202 -0.033 1 0.2 pad=pink id=140 z=2
S 202 3 rot=180 id=8
S 211 0 id=8
S 215 -0.05 1 0.5 id=39
S 216 0 id=8
S 217 0 id=8
S 218 0 id=8
S 219 0 id=8
S 220 0 id=8
O 217.5 1 orb=yellow id=36 z=2
D 221 1 1 0.2 pad=blue id=67 z=2
B 221 0 id=1
D 215 -0.2 1 0.2 pad=blue rot=180 id=67 z=2
B 222 4 id=1
D 222 3.8 1 0.2 pad=blue rot=180 id=67 z=2
H 227 1 fm=corner id=469
H 228 1.95 1 0.05 fm=edge id=468
H 227 0 0.05 1 rot=270 fm=edge id=468
H 229 1 rot=-270 fm=corner id=469
H 229.95 0 0.05 1 rot=-270 fm=edge id=468
S 229 2 id=8
D 225 -0.033 1 0.2 pad=pink id=140 z=2
H 231.5 3 1 0.5 fm=box id=662
H 235 4 fm=corner id=469
H 236 4.95 1 0.05 fm=edge id=468
H 237 4.95 1 0.05 fm=edge id=468
H 238 4.95 1 0.05 fm=edge id=468
H 235 3 0.05 1 rot=270 fm=edge id=468
H 235 2 0.05 1 rot=270 fm=edge id=468
H 235 1 0.05 1 rot=270 fm=edge id=468
H 235 0 0.05 1 rot=270 fm=edge id=468
H 239 4 rot=90 fm=corner id=469
H 239.95 3 0.05 1 rot=-270 fm=edge id=468
H 239.95 2 0.05 1 rot=-270 fm=edge id=468
H 239.95 1 0.05 1 rot=-270 fm=edge id=468
H 239.95 0 0.05 1 rot=-270 fm=edge id=468
S 239 5 id=8
H 241.5 5.5 1 0.5 fm=box id=662
H 246 5.5 1 0.5 fm=box id=662
H 250.5 5.5 1 0.5 fm=box id=662
H 254 7.5 1 0.5 fm=box id=662
H 258 8 1 0.5 fm=box id=662
D 258 8.5 1 0.2 pad=blue id=67 z=2
D 259 11.8 1 0.2 pad=blue rot=180 id=67 z=2
H 259 12 1 0.5 fm=box id=662
S 227 4 rot=180 id=8
S 226 0 id=8
S 226 4 rot=180 id=8
S 225 4 rot=180 id=8
S 224 4 rot=180 id=8
S 240 0 id=8
S 241 0 id=8
S 242 0 id=8
S 243 0 id=8
S 244 0 id=8
S 245 0 id=8
S 246 0 id=8
S 247 0 id=8
S 248 0 id=8
S 249 0 id=8
S 250 0 id=8
S 251 0 id=8
S 252 0 id=8
S 253 0 id=8
S 254 0 id=8
S 255 0 id=8
S 256 0 id=8
S 257 0 id=8
H 261 7 fm=corner id=469
H 261 6 0.05 1 rot=270 fm=edge id=468
H 261 5 0.05 1 rot=270 fm=edge id=468
H 261 4 0.05 1 rot=270 fm=edge id=468
H 261 3 0.05 1 rot=270 fm=edge id=468
H 261 2 0.05 1 rot=270 fm=edge id=468
H 261 1 0.05 1 rot=270 fm=edge id=468
H 261 0 0.05 1 rot=270 fm=edge id=468
H 261 -1 0.05 1 rot=270 fm=edge id=468
S 260 0 id=8
S 259 0 id=8
S 258 0 id=8
H 262 7.95 1 0.05 fm=edge id=468
H 263 7.95 1 0.05 fm=edge id=468
H 264 7.95 1 0.05 fm=edge id=468
S 263 7.95 1 0.5 id=39
H 265 7 rot=90 fm=corner id=469
H 265.95 6 0.05 1 rot=90 fm=edge id=468
H 265.95 5 0.05 1 rot=90 fm=edge id=468
H 265.95 4 0.05 1 rot=90 fm=edge id=468
H 265.95 3 0.05 1 rot=90 fm=edge id=468
H 265.95 2 0.05 1 rot=90 fm=edge id=468
H 265.95 1 0.05 1 rot=90 fm=edge id=468
H 265.95 0 0.05 1 rot=90 fm=edge id=468
H 265.95 -1 0.05 1 rot=90 fm=edge id=468
H 266 8 0.05 1 rot=-90 fm=edge id=468
H 266 9 fm=corner id=469
H 267 9.95 1 0.05 fm=edge id=468
H 268 9.95 1 0.05 fm=edge id=468
H 269 9.95 1 0.05 fm=edge id=468
S 265 8 id=8
S 264 8 id=8
S 265 9 rot=-90 id=8
H 267 14 1 0.05 rot=180 fm=edge id=468
H 268 14 1 0.05 rot=180 fm=edge id=468
H 269 14 1 0.05 rot=180 fm=edge id=468
H 270 14 1 0.05 rot=180 fm=edge id=468
H 271 14 1 0.05 rot=180 fm=edge id=468
H 272 14 1 0.05 rot=180 fm=edge id=468
H 273 14 1 0.05 rot=180 fm=edge id=468
H 266 14 1 0.05 rot=180 fm=edge id=468
H 265 14 1 0.05 rot=180 fm=edge id=468
H 264 14 1 0.05 rot=180 fm=edge id=468
H 263 14 1 0.05 rot=180 fm=edge id=468
H 262 14 1 0.05 rot=180 fm=edge id=468
S 273 13 rot=180 id=8
H 275 5.95 1 0.05 fm=edge id=468
H 276 5.95 1 0.05 fm=edge id=468
H 277 5.95 1 0.05 fm=edge id=468
H 278 5.95 1 0.05 fm=edge id=468
H 279 5.95 1 0.05 fm=edge id=468
H 280 5.95 1 0.05 fm=edge id=468
H 281 5.95 1 0.05 fm=edge id=468
S 271 10 id=8
S 272 9 id=8
H 271 9 rot=90 fm=corner id=469
H 272 8 rot=90 fm=corner id=469
H 274 5.95 1 0.05 fm=edge id=468
H 275 12 rot=270 fm=corner id=469
H 276 11 rot=270 fm=corner id=469
H 277 11 1 0.05 rot=180 fm=edge id=468
H 278 11 1 0.05 rot=180 fm=edge id=468
H 279 11 1 0.05 rot=180 fm=edge id=468
H 277 8 1 0.5 fm=box id=662
H 278 8 1 0.5 fm=box id=662
H 279 8 1 0.5 fm=box id=662
S 278 5.95 1 0.5 id=39
S 281 7.55 1 0.5 rot=180 id=39
H 280 8 1 0.5 fm=box id=662
H 281 8 1 0.5 fm=box id=662
H 280 11 1 0.05 rot=180 fm=edge id=468
H 281 11 1 0.05 rot=180 fm=edge id=468
H 282 11 rot=180 fm=corner id=469
H 283 12 rot=180 fm=corner id=469
H 284 13 rot=180 fm=corner id=469
H 274 13 rot=270 fm=corner id=469
S 274 12 rot=180 id=8
S 275 11 rot=180 id=8
S 276 10 rot=180 id=8
S 277 10 rot=180 id=8
S 278 10 rot=180 id=8
S 279 10 rot=180 id=8
S 280 10 rot=180 id=8
S 281 10 rot=180 id=8
S 282 10 rot=180 id=8
S 281 8.5 id=8
S 280 8.5 id=8
S 279 8.5 id=8
S 278 8.5 id=8
S 277 8.5 id=8
H 282 5.95 1 0.05 fm=edge id=468
H 283 5.95 1 0.05 fm=edge id=468
H 284 5.95 1 0.05 fm=edge id=468
S 283 11 rot=180 id=8
S 284 12 rot=180 id=8
S 285 13 rot=180 id=8
H 285 13.95 1 0.05 fm=edge id=468
H 287 13.95 1 0.05 fm=edge id=468
H 288 13.95 1 0.05 fm=edge id=468
H 289 13.95 1 0.05 fm=edge id=468
S 287 13 rot=180 id=8
S 288 13 rot=180 id=8
S 289 13 rot=180 id=8
G 290 11 gd=1 id=10 z=2
S 290 13 rot=180 id=8
S 291 13 rot=180 id=8
S 292 13 rot=180 id=8
H 290 13.95 1 0.05 fm=edge id=468
H 291 13.95 1 0.05 fm=edge id=468
H 292 13.95 1 0.05 fm=edge id=468
H 294 5.95 1 0.05 fm=edge id=468
H 295 5.95 1 0.05 fm=edge id=468
H 296 5.95 1 0.05 fm=edge id=468
H 297 5.95 1 0.05 fm=edge id=468
H 298 5.95 1 0.05 fm=edge id=468
H 286 7 fm=corner id=469
H 287 8 fm=corner id=469
H 288 9 fm=corner id=469
H 289 9.95 1 0.05 fm=edge id=468
H 285 6 fm=corner id=469
S 303 7 rot=180 id=8
S 299 6 id=8
S 300 6 id=8
H 303 8 1 0.5 fm=box id=662
H 302 8 1 0.5 fm=box id=662
H 301 8 1 0.5 fm=box id=662
H 300 8 1 0.5 fm=box id=662
H 299 8 1 0.5 fm=box id=662
H 298 8 1 0.5 fm=box id=662
H 297 8 1 0.5 fm=box id=662
S 297 9 rot=180 id=8
S 298 9 rot=180 id=8
S 299 9 rot=180 id=8
S 300 9 rot=180 id=8
S 301 9 rot=180 id=8
S 302 9 rot=180 id=8
S 303 9 rot=180 id=8
H 297 10 1 0.05 rot=180 fm=edge id=468
H 298 10 1 0.05 rot=180 fm=edge id=468
H 299 10 1 0.05 rot=180 fm=edge id=468
H 300 10 1 0.05 rot=180 fm=edge id=468
H 301 10 1 0.05 rot=180 fm=edge id=468
H 302 10 1 0.05 rot=180 fm=edge id=468
H 299 5.95 1 0.05 fm=edge id=468
H 300 5.95 1 0.05 fm=edge id=468
H 301 5.95 1 0.05 fm=edge id=468
H 302 5.95 1 0.05 fm=edge id=468
H 303 5.95 1 0.05 fm=edge id=468
H 303 10 1 0.05 rot=180 fm=edge id=468
H 304 5.95 1 0.05 fm=edge id=468
H 305 5.95 1 0.05 fm=edge id=468
H 306 5.95 1 0.05 fm=edge id=468
H 307 5.95 1 0.05 fm=edge id=468
S 307 6 id=8
H 304 10 rot=180 fm=corner id=469
H 305 11 rot=180 fm=corner id=469
H 306 12 rot=180 fm=corner id=469
H 307 13 rot=180 fm=corner id=469
S 304 9 rot=180 id=8
S 305 10 rot=180 id=8
S 306 11 rot=180 id=8
S 307 12 rot=180 id=8
H 308 13.95 1 0.05 fm=edge id=468
H 309 13.95 1 0.05 fm=edge id=468
H 310 13.95 1 0.05 fm=edge id=468
S 308 13 rot=180 id=8
S 309 13 rot=180 id=8
S 311 13 rot=180 id=8
S 310 13 rot=180 id=8
H 311 13.95 1 0.05 fm=edge id=468
S 308 7 id=8
S 309 6 id=8
H 308 6 fm=u id=470
H 309 6 1 0.05 rot=180 fm=edge id=468
H 310 6 1 0.05 rot=180 fm=edge id=468
D 312 12.3 1 0.2 pad=blue rot=180 id=67 z=2
H 312 12.5 1 0.5 fm=box id=662
H 313 6 1 0.05 rot=180 fm=edge id=468
H 314 6 1 0.05 rot=180 fm=edge id=468
H 315 6 1 0.05 rot=180 fm=edge id=468
H 316 6 1 0.05 rot=180 fm=edge id=468
H 317 6 1 0.05 rot=180 fm=edge id=468
H 319 6 1 0.05 rot=180 fm=edge id=468
S 284 5.95 1 0.5 id=39
S 285 6.95 1 0.5 id=39
S 286 7.95 1 0.5 id=39
S 287 8.95 1 0.5 id=39
H 311 6 1 0.05 rot=180 fm=edge id=468
H 312 6 1 0.05 rot=180 fm=edge id=468
G 308 11 gd=1 id=10 z=2
D 311 10 1 0.2 pad=blue id=67 z=2
H 311 9.5 1 0.5 fm=box id=662
D 316 6 1 0.2 pad=blue id=67 z=2
D 317 8.8 1 0.2 pad=blue rot=180 id=67 z=2
H 317 9 1 0.5 fm=box id=662
H 318 6 1 0.05 rot=180 fm=edge id=468
D 320 9.8 1 0.2 pad=blue rot=180 id=67 z=2
D 319 6 1 0.2 pad=blue id=67 z=2
H 320 6 1 0.05 rot=180 fm=edge id=468
H 321 6 1 0.05 rot=180 fm=edge id=468
H 322 6 1 0.05 rot=180 fm=edge id=468
H 323 6 1 0.05 rot=180 fm=edge id=468
H 320 10 1 0.5 fm=box id=662
R 323 7 to=ufo id=111 z=2
H 327 11.95 1 0.05 fm=edge id=468
H 326 11.95 1 0.05 fm=edge id=468
H 325 11.95 1 0.05 fm=edge id=468
H 324 11.95 1 0.05 fm=edge id=468
H 323 11.95 1 0.05 fm=edge id=468
H 322 11.95 1 0.05 fm=edge id=468
H 321 11.95 1 0.05 fm=edge id=468
H 320 11.95 1 0.05 fm=edge id=468
H 319 11.95 1 0.05 fm=edge id=468
H 318 11.95 1 0.05 fm=edge id=468
H 317 11.95 1 0.05 fm=edge id=468
H 316 11.95 1 0.05 fm=edge id=468
H 315 11.95 1 0.05 fm=edge id=468
H 314 11.95 1 0.05 fm=edge id=468
H 313.95 12 0.05 1 rot=90 fm=edge id=468
H 313 13 rot=90 fm=corner id=469
H 312 13.95 1 0.05 fm=edge id=468
H 324 5 rot=90 fm=corner id=469
H 324.95 4 0.05 1 rot=90 fm=edge id=468
H 324.95 3 0.05 1 rot=90 fm=edge id=468
H 325 2 rot=-90 fm=corner id=469
H 326 2 1 0.05 rot=180 fm=edge id=468
H 327 2 1 0.05 rot=180 fm=edge id=468
H 328 2 1 0.05 rot=180 fm=edge id=468
S 330 4 id=8
S 331 4 id=8
S 329 3 id=8
S 328 2 id=8
H 330 3 fm=corner id=469
H 329 2 fm=corner id=469
H 330 3.95 1 0.05 fm=edge id=468
H 331 3.95 1 0.05 fm=edge id=468
S 330 8 rot=-180 id=8
H 330 9 rot=-90 fm=corner id=469
H 329 10 rot=-90 fm=corner id=469
H 328 11 rot=-90 fm=corner id=469
S 329 9 rot=-180 id=8
S 328 10 rot=-180 id=8
S 327 11 rot=-180 id=8
S 334 6.95 1 0.5 id=39
S 332 9 rot=180 id=8
S 333 10 rot=180 id=8
S 334 10 rot=180 id=8
S 335 10 rot=180 id=8
S 336 11 rot=180 id=8
S 337 11 rot=180 id=8
S 336 7 id=8
S 335 7 id=8
S 337 7 id=8
S 332 5 id=8
S 333 6 id=8
S 331 8 rot=180 id=8
H 331 9 rot=180 fm=corner id=469
H 332 10 rot=180 fm=corner id=469
H 333 11 1 0.05 rot=180 fm=edge id=468
H 334 11 1 0.05 rot=180 fm=edge id=468
H 335 11 rot=180 fm=corner id=469
H 332 4 fm=corner id=469
H 333 5 fm=corner id=469
H 334 6 fm=corner id=469
H 335 6.95 1 0.05 fm=edge id=468
H 336 6.95 1 0.05 fm=edge id=468
H 337 6.95 1 0.05 fm=edge id=468
G 337 9 gd=-1 id=11 z=2
S 338 11 rot=180 id=8
S 340 10 rot=180 id=8
S 341 9 rot=180 id=8
S 339 11 rot=180 id=8
S 342 8 rot=-180 id=8
S 338 6 id=8
S 339 5 id=8
S 340 4 id=8
G 345 5 gd=1 id=10 z=2
S 341 3 id=8
S 342 3 id=8
S 343 3 id=8
H 340 11 rot=-90 fm=corner id=469
H 341 10 rot=-90 fm=corner id=469
H 342 9 rot=-90 fm=corner id=469
H 343 8 rot=-90 fm=corner id=469
E 339 9 rot=90 art=3812 id=3812 z=3
E 347 5 rot=270 art=3812 id=3812 z=3
E 328 4 rot=270 art=3812 id=3812 z=3
E 331 6 rot=270 art=3812 id=3812 z=3
E 334 8 rot=270 art=3812 id=3812 z=3
E 340 8 rot=90 art=3812 id=3812 z=3
E 341 7 rot=90 art=3812 id=3812 z=3
E 348 6 rot=-90 art=3812 id=3812 z=3
E 349 7 rot=-90 art=3812 id=3812 z=3
S 344 3 id=8
S 345 3 id=8
S 346 3 id=8
S 343 7 rot=180 id=8
S 344 7 rot=180 id=8
S 345 7 rot=180 id=8
S 346 8 rot=180 id=8
S 347 9 rot=180 id=8
S 348 10 rot=180 id=8
S 349 10 rot=180 id=8
S 347 4 id=8
S 348 5 id=8
S 349 6 id=8
S 350 7 id=8
S 351 7 id=8
S 352 6 id=8
S 353 5 id=8
S 354 4 id=8
S 350 10 rot=180 id=8
S 351 10 rot=180 id=8
S 352 10 rot=180 id=8
S 353 10 rot=180 id=8
S 354 10 rot=180 id=8
S 355 4 id=8
S 356 4 id=8
S 357 4 id=8
S 355 9 rot=180 id=8
S 356 8 rot=180 id=8
S 358 5 id=8
E 356 5 rot=270 art=3812 id=3812 z=3
S 357 8 rot=180 id=8
S 358 8 rot=180 id=8
S 359 8 rot=180 id=8
S 360 9 rot=180 id=8
E 360 6 rot=-90 art=3812 id=3812 z=3
S 359 5 id=8
S 360 5 id=8
S 361 10 rot=180 id=8
S 362 10 rot=180 id=8
S 363 10 rot=180 id=8
E 364 7 rot=-90 art=3812 id=3812 z=3
S 361 5 id=8
S 362 6 id=8
S 363 6 id=8
S 364 6 id=8
S 365 6 id=8
S 364 11 rot=180 id=8
S 365 11 rot=180 id=8
S 366 11 rot=180 id=8
S 367 11 rot=180 id=8
S 368 10 rot=180 id=8
A 367 9 rot=90 ar=pink id=1751 z=2
S 366 5 id=8
S 367 5 id=8
S 368 5 id=8
S 369 5 id=8
S 370 5 id=8
S 371 5 id=8
S 372 4 id=8
S 373 4 id=8
S 374 4 id=8
S 375 3 id=8
S 376 3 id=8
S 377 3 id=8
E 374 7 rot=90 art=3812 id=3812 z=3
E 378 6 rot=90 art=3812 id=3812 z=3
S 373 8 rot=180 id=8
S 374 8 rot=180 id=8
S 375 8 rot=180 id=8
S 376 7 rot=180 id=8
S 377 7 rot=180 id=8
S 378 7 rot=180 id=8
S 379 7 rot=180 id=8
S 380 6 rot=180 id=8
G 380 4 gd=1 id=10 z=2
E 370 8 rot=90 art=3812 id=3812 z=3
S 372 8 rot=180 id=8
S 378 2 id=8
S 379 2 id=8
S 380 2 id=8
S 386 2 id=8
E 385 2 rot=-90 art=3812 id=3812 z=3
E 388 3 rot=-90 art=3812 id=3812 z=3
S 387 2 id=8
S 388 2 id=8
S 389 2 id=8
S 381 6 rot=180 id=8
S 382 6 rot=180 id=8
S 383 6 rot=180 id=8
S 384 6 rot=180 id=8
S 385 6 rot=180 id=8
S 386 6 rot=180 id=8
S 387 6 rot=180 id=8
S 388 6 rot=180 id=8
S 389 6 rot=180 id=8
E 392 4 rot=-90 art=3812 id=3812 z=3
S 390 3 id=8
S 391 3 id=8
S 392 3 id=8
S 390 7 rot=180 id=8
S 391 7 rot=180 id=8
S 392 7 rot=180 id=8
S 393 8 rot=180 id=8
S 394 8 rot=180 id=8
S 395 8 rot=180 id=8
E 397 5 rot=-90 art=3812 id=3812 z=3
E 398 6 rot=-90 art=3812 id=3812 z=3
S 393 4 id=8
S 394 4 id=8
S 395 4 id=8
S 396 4 id=8
S 397 4 id=8
S 398 5 id=8
S 399 6 id=8
S 396 8 rot=180 id=8
S 397 9 rot=180 id=8
S 398 10 rot=180 id=8
S 400 7 id=8
S 399 10 rot=-180 id=8
S 400 11 rot=-180 id=8
S 401 7 id=8
S 401 11 rot=-180 id=8
S 402 11 rot=-180 id=8
E 401 8 rot=-90 art=3812 id=3812 z=3
S 402 7 id=8
S 403 11 rot=180 id=8
S 404 11 rot=180 id=8
A 404 9 rot=90 ar=pink id=1751 z=2
E 407 8 rot=90 art=3812 id=3812 z=3
S 403 7 id=8
S 404 6 id=8
S 405 6 id=8
S 406 6 id=8
S 407 5 id=8
S 408 5 id=8
S 409 4 id=8
S 410 3 id=8
S 410 8 rot=180 id=8
S 411 7 rot=180 id=8
S 412 6 rot=180 id=8
S 413 5 rot=180 id=8
E 418 3 rot=-90 art=3812 id=3812 z=3
S 415 5 rot=180 id=8
S 417 6 rot=180 id=8
S 417 2 id=8
S 418 2 id=8
S 418 7 rot=180 id=8
S 419 7 rot=180 id=8
S 420 7 rot=180 id=8
S 421 7 rot=180 id=8
H 418 1.95 1 0.05 fm=edge id=468
S 419 2 id=8
H 420 3 fm=corner id=469
H 420.002 2 0.05 1 rot=270 fm=edge id=468
H 419 1.95 1 0.05 fm=edge id=468
H 421 3.95 1 0.05 fm=edge id=468
H 422 3.95 1 0.05 fm=edge id=468
H 423 3.95 1 0.05 fm=edge id=468
H 424 3.95 1 0.05 fm=edge id=468
H 410 2 rot=90 fm=corner id=469
H 409 3 rot=90 fm=corner id=469
H 408 4 rot=90 fm=corner id=469
H 406 5 rot=90 fm=corner id=469
H 403 6 rot=90 fm=corner id=469
H 407 4.95 1 0.05 fm=edge id=468
H 405 5.95 1 0.05 fm=edge id=468
H 402 6.95 1 0.05 fm=edge id=468
H 401 6.95 1 0.05 fm=edge id=468
H 400 6 fm=corner id=469
H 399 5 fm=corner id=469
H 398 4 fm=corner id=469
H 397 3.95 1 0.05 fm=edge id=468
H 395 3.95 1 0.05 fm=edge id=468
H 396 3.95 1 0.05 fm=edge id=468
H 394 3.95 1 0.05 fm=edge id=468
H 393 3 fm=corner id=469
H 390 2 fm=corner id=469
H 392 2.95 1 0.05 fm=edge id=468
H 391 2.95 1 0.05 fm=edge id=468
H 389 1.95 1 0.05 fm=edge id=468
H 388 1.95 1 0.05 fm=edge id=468
H 387 1.95 1 0.05 fm=edge id=468
H 386 1.95 1 0.05 fm=edge id=468
H 385 1.95 1 0.05 fm=edge id=468
H 384 1.95 1 0.05 fm=edge id=468
H 382 1.95 1 0.05 fm=edge id=468
H 383 1.95 1 0.05 fm=edge id=468
H 381 1.95 1 0.05 fm=edge id=468
H 380 1.95 1 0.05 fm=edge id=468
H 379 1.95 1 0.05 fm=edge id=468
H 378 1.95 1 0.05 fm=edge id=468
H 377 2 rot=90 fm=corner id=469
H 374 3 rot=90 fm=corner id=469
H 371 4 rot=90 fm=corner id=469
H 376 2.95 1 0.05 fm=edge id=468
H 375 2.95 1 0.05 fm=edge id=468
H 373 3.95 1 0.05 fm=edge id=468
H 372 3.95 1 0.05 fm=edge id=468
H 370 4.95 1 0.05 fm=edge id=468
H 369 4.95 1 0.05 fm=edge id=468
H 368 4.95 1 0.05 fm=edge id=468
H 367 4.95 1 0.05 fm=edge id=468
H 366 4.95 1 0.05 fm=edge id=468
H 365 5 rot=90 fm=corner id=469
H 362 5 fm=corner id=469
H 364 5.95 1 0.05 fm=edge id=468
H 363 5.95 1 0.05 fm=edge id=468
H 361 4.95 1 0.05 fm=edge id=468
H 360 4.95 1 0.05 fm=edge id=468
H 359 4.95 1 0.05 fm=edge id=468
H 358 4 fm=corner id=469
H 353 4 rot=90 fm=corner id=469
H 352 5 rot=90 fm=corner id=469
H 351 6 rot=90 fm=corner id=469
H 350 6 fm=corner id=469
H 349 5 fm=corner id=469
H 348 4 fm=corner id=469
H 347 3 fm=corner id=469
H 357 3.95 1 0.05 fm=edge id=468
H 356 3.95 1 0.05 fm=edge id=468
H 355 3.95 1 0.05 fm=edge id=468
H 354 3.95 1 0.05 fm=edge id=468
H 346 2.95 1 0.05 fm=edge id=468
H 345 2.95 1 0.05 fm=edge id=468
H 344 2.95 1 0.05 fm=edge id=468
H 343 2.95 1 0.05 fm=edge id=468
H 342 2.95 1 0.05 fm=edge id=468
H 341 2.95 1 0.05 fm=edge id=468
H 340 3 rot=90 fm=corner id=469
H 339 4 rot=90 fm=corner id=469
H 338 5 rot=90 fm=corner id=469
H 337 6 rot=90 fm=corner id=469
H 344 8 1 0.05 rot=180 fm=edge id=468
H 345 8 rot=180 fm=corner id=469
H 346 9 rot=180 fm=corner id=469
H 347 10 rot=180 fm=corner id=469
H 348 11 1 0.05 rot=180 fm=edge id=468
H 349 11 1 0.05 rot=180 fm=edge id=468
H 350 11 1 0.05 rot=180 fm=edge id=468
H 351 11 1 0.05 rot=180 fm=edge id=468
H 352 11 1 0.05 rot=180 fm=edge id=468
H 353 11 1 0.05 rot=180 fm=edge id=468
H 354 11 1 0.05 rot=180 fm=edge id=468
H 355 10 rot=-90 fm=corner id=469
H 356 9 rot=-90 fm=corner id=469
H 359 9 rot=180 fm=corner id=469
H 360 10 rot=180 fm=corner id=469
H 357 9 1 0.05 rot=180 fm=edge id=468
H 358 9 1 0.05 rot=180 fm=edge id=468
H 361 11 1 0.05 rot=180 fm=edge id=468
H 362 11 1 0.05 rot=180 fm=edge id=468
H 363 11 rot=180 fm=corner id=469
H 364 12 1 0.05 rot=180 fm=edge id=468
H 365 12 1 0.05 rot=180 fm=edge id=468
H 366 12 1 0.05 rot=180 fm=edge id=468
H 367 12 1 0.05 rot=180 fm=edge id=468
H 368 11 rot=-90 fm=corner id=469
H 369 10 rot=-90 fm=corner id=469
H 372 9 rot=-90 fm=corner id=469
H 370 10 1 0.05 rot=180 fm=edge id=468
H 371 10 1 0.05 rot=180 fm=edge id=468
H 373 9 1 0.05 rot=180 fm=edge id=468
H 374 9 1 0.05 rot=180 fm=edge id=468
H 375 9 1 0.05 rot=180 fm=edge id=468
H 376 8 rot=-90 fm=corner id=469
H 377 8 1 0.05 rot=180 fm=edge id=468
H 378 8 1 0.05 rot=180 fm=edge id=468
H 379 8 1 0.05 rot=180 fm=edge id=468
H 380 7 rot=-90 fm=corner id=469
H 381 7 1 0.05 rot=180 fm=edge id=468
H 382 7 1 0.05 rot=180 fm=edge id=468
H 383 7 1 0.05 rot=180 fm=edge id=468
H 384 7 1 0.05 rot=180 fm=edge id=468
H 385 7 1 0.05 rot=180 fm=edge id=468
H 386 7 1 0.05 rot=180 fm=edge id=468
H 387 7 1 0.05 rot=180 fm=edge id=468
H 388 7 1 0.05 rot=180 fm=edge id=468
H 390 8 1 0.05 rot=180 fm=edge id=468
H 391 8 1 0.05 rot=180 fm=edge id=468
H 389 7 rot=180 fm=corner id=469
H 392 8 rot=180 fm=corner id=469
H 396 9 rot=180 fm=corner id=469
H 397 10 rot=180 fm=corner id=469
H 399 11 rot=180 fm=corner id=469
H 393 9 1 0.05 rot=180 fm=edge id=468
H 394 9 1 0.05 rot=180 fm=edge id=468
H 395 9 1 0.05 rot=180 fm=edge id=468
H 398 11 1 0.05 rot=180 fm=edge id=468
H 400 12 1 0.05 rot=180 fm=edge id=468
H 401 12 1 0.05 rot=180 fm=edge id=468
H 402 12 1 0.05 rot=180 fm=edge id=468
H 403 12 1 0.05 rot=180 fm=edge id=468
H 404 12 1 0.05 rot=180 fm=edge id=468
H 405 11 rot=-90 fm=corner id=469
H 410 9 rot=-90 fm=corner id=469
H 411 8 rot=-90 fm=corner id=469
H 412 7 rot=-90 fm=corner id=469
H 413 6 rot=-90 fm=corner id=469
H 415 5.95 1 0.05 fm=edge id=468
H 417 7 rot=180 fm=corner id=469
H 418 7.95 1 0.05 fm=edge id=468
H 419 7.95 1 0.05 fm=edge id=468
H 420 7.95 1 0.05 fm=edge id=468
H 421 8 rot=180 fm=corner id=469
H 421.948 9 0.05 1 rot=90 fm=edge id=468
H 421.948 10 0.05 1 rot=90 fm=edge id=468
H 421.948 11 0.05 1 rot=90 fm=edge id=468
H 421.948 12 0.05 1 rot=90 fm=edge id=468
H 421.948 13 0.05 1 rot=90 fm=edge id=468
H 421.948 14 0.05 1 rot=90 fm=edge id=468
H 421.948 15 0.05 1 rot=90 fm=edge id=468
H 421.948 16 0.05 1 rot=90 fm=edge id=468
H 421.948 17 0.05 1 rot=90 fm=edge id=468
S 369 9.55 1 0.5 rot=180 id=39
S 370 9.55 1 0.5 rot=180 id=39
S 371 9.55 1 0.5 rot=180 id=39
S 405 10.55 1 0.5 rot=180 id=39
S 406 10.55 1 0.5 rot=180 id=39
S 407 10.55 1 0.5 rot=180 id=39
S 408 10.55 1 0.5 rot=180 id=39
H 406 11 1 0.05 rot=180 fm=edge id=468
H 407 11 1 0.05 rot=180 fm=edge id=468
H 408 11 1 0.05 rot=180 fm=edge id=468
H 409 10 rot=-90 fm=corner id=469
S 409 9 rot=180 id=8
R 421 5 to=cube id=12 z=2
E 367 7 art=3810 id=3810 z=3
E 404 8 art=3810 id=3810 z=3
G 408 7 gd=1 id=10 z=2
E 414 2 rot=-90 art=3812 id=3812 z=3
S 416 2 id=8
S 415 2 id=8
H 417 1.95 1 0.05 fm=edge id=468
H 416 1.95 1 0.05 fm=edge id=468
H 415 1.95 1 0.05 fm=edge id=468
H 413 1.95 1 0.05 fm=edge id=468
H 414 1.95 1 0.05 fm=edge id=468
S 414 5 rot=180 id=8
H 414 6 1 0.05 rot=180 fm=edge id=468
H 415 6 rot=180 fm=corner id=469
S 416 6 rot=180 id=8
H 416 7 1 0.05 rot=180 fm=edge id=468
H 412 1.95 1 0.05 fm=edge id=468
S 411 1.95 1 0.5 id=39
H 411 1.95 1 0.05 fm=edge id=468
S 223 4 rot=180 id=8
S 312 13 rot=180 id=8
S 313 13 rot=180 id=8
S 314 11 rot=180 id=8
S 315 11 rot=180 id=8
S 316 11 rot=180 id=8
S 317 11 rot=180 id=8
S 318 11 rot=180 id=8
S 319 11 rot=180 id=8
S 320 11 rot=180 id=8
S 321 11 rot=180 id=8
S 322 11 rot=180 id=8
S 323 11 rot=180 id=8
S 324 11 rot=180 id=8
S 325 11 rot=180 id=8
S 326 11 rot=180 id=8
C 315 7 id=2063
S 306 6 id=8
S 310 6 id=8
E 305 6 rot=-90 art=3812 id=3812 z=3
H 310 9.5 1 0.5 fm=box id=662
S 311 6 id=8
S 312 6 id=8
S 313 6 id=8
E 328 6 art=3810 id=3810 z=3
E 283 6 rot=-90 art=3812 id=3812 z=3
D 286 12.833 1 0.2 pad=yellow rot=180 id=35 z=2
H 286 13 rot=180 fm=u id=470
S 293 13 rot=180 id=8
S 294 12 rot=180 id=8
S 295 11 rot=180 id=8
S 296 10 rot=180 id=8
H 297 10 rot=-90 fm=corner id=469
H 296 11 rot=-90 fm=corner id=469
H 295 12 rot=-90 fm=corner id=469
H 294 13 rot=-90 fm=corner id=469
S 327 2 id=8
S 326 2 id=8
S 325 2 id=8
H 426 3.95 1 0.05 fm=edge id=468
H 425 3.95 1 0.05 fm=edge id=468
H 427 3 rot=90 fm=corner id=469
H 427.948 2 0.05 1 rot=-270 fm=edge id=468
H 427.948 1 0.05 1 rot=-270 fm=edge id=468
H 427.948 0 0.05 1 rot=-270 fm=edge id=468
H 290 9 rot=90 fm=corner id=469
H 291 8 rot=90 fm=corner id=469
H 292 7 rot=90 fm=corner id=469
H 293 6 rot=90 fm=corner id=469
S 291 9 id=8
S 292 8 id=8
H 430 4 1 0.5 fm=box id=662
H 434 5.5 1 0.5 fm=box id=662
S 428 0 id=8
S 429 0 id=8
S 430 0 id=8
S 431 0 id=8
S 432 0 id=8
S 433 0 id=8
S 434 0 id=8
S 435 0 id=8
S 436 0 id=8
S 437 0 id=8
H 443 5.95 1 0.05 fm=edge id=468
H 444 5.95 1 0.05 fm=edge id=468
H 438 5 fm=corner id=469
H 438.002 4 0.05 1 rot=-90 fm=edge id=468
H 438.002 3 0.05 1 rot=-90 fm=edge id=468
H 438.002 2 0.05 1 rot=-90 fm=edge id=468
H 438.002 1 0.05 1 rot=-90 fm=edge id=468
H 438.002 0 0.05 1 rot=-90 fm=edge id=468
H 439 5.95 1 0.05 fm=edge id=468
H 440 5.95 1 0.05 fm=edge id=468
H 441 5.95 1 0.05 fm=edge id=468
H 442 5.95 1 0.05 fm=edge id=468
R 439 7 to=spider id=1331 z=2
H 445 9 rot=-90 fm=corner id=469
H 445.002 10 0.05 1 rot=-90 fm=edge id=468
H 445.002 11 0.05 1 rot=-90 fm=edge id=468
H 446 9 1 0.05 rot=180 fm=edge id=468
H 447 9 1 0.05 rot=180 fm=edge id=468
H 448 9 rot=-180 fm=corner id=469
H 448.948 10 0.05 1 rot=90 fm=edge id=468
H 448.948 11 0.05 1 rot=90 fm=edge id=468
H 448 5 fm=corner id=469
H 448.002 4 0.05 1 rot=-90 fm=edge id=468
H 448.002 3 0.05 1 rot=-90 fm=edge id=468
H 449 5.95 1 0.05 fm=edge id=468
H 448.002 2 0.05 1 rot=-90 fm=edge id=468
H 448.002 1 0.05 1 rot=-90 fm=edge id=468
H 448.002 0 0.05 1 rot=-90 fm=edge id=468
H 450 5.95 1 0.05 fm=edge id=468
H 451 5 rot=90 fm=corner id=469
H 451.948 4 0.05 1 rot=-270 fm=edge id=468
H 451.948 3 0.05 1 rot=-270 fm=edge id=468
H 451.948 2 0.05 1 rot=-270 fm=edge id=468
H 451.948 1 0.05 1 rot=-270 fm=edge id=468
H 451.948 0 0.05 1 rot=-270 fm=edge id=468
H 451 9 rot=-90 fm=corner id=469
H 454 9 rot=180 fm=corner id=469
H 451.002 10 0.05 1 rot=-90 fm=edge id=468
H 451.002 11 0.05 1 rot=-90 fm=edge id=468
H 454.948 11 0.05 1 rot=90 fm=edge id=468
H 454.948 10 0.05 1 rot=90 fm=edge id=468
H 453 9 1 0.05 rot=180 fm=edge id=468
H 452 9 1 0.05 rot=180 fm=edge id=468
H 454 5 fm=corner id=469
H 456 5 rot=-270 fm=corner id=469
H 456.948 4 0.05 1 rot=90 fm=edge id=468
H 456.948 3 0.05 1 rot=90 fm=edge id=468
H 454.002 4 0.05 1 rot=-90 fm=edge id=468
H 454.002 3 0.05 1 rot=-90 fm=edge id=468
H 455 5.95 1 0.05 fm=edge id=468
H 454.002 2 0.05 1 rot=-90 fm=edge id=468
H 454.002 1 0.05 1 rot=-90 fm=edge id=468
H 454.002 0 0.05 1 rot=-90 fm=edge id=468
H 456.948 2 0.05 1 rot=90 fm=edge id=468
H 456.948 1 0.05 1 rot=90 fm=edge id=468
H 456.948 0 0.05 1 rot=90 fm=edge id=468
H 445 5 rot=90 fm=corner id=469
H 445.948 4 0.05 1 rot=90 fm=edge id=468
H 445.948 3 0.05 1 rot=90 fm=edge id=468
H 445.948 2 0.05 1 rot=90 fm=edge id=468
H 445.948 1 0.05 1 rot=90 fm=edge id=468
H 445.948 0 0.05 1 rot=90 fm=edge id=468
E 445 6 rot=-90 art=3812 id=3812 z=3
E 448 8 rot=90 art=3812 id=3812 z=3
E 451 6 rot=-90 art=3812 id=3812 z=3
E 454 8 rot=90 art=3812 id=3812 z=3
E 456 6 rot=-90 art=3812 id=3812 z=3
H 456 9 rot=-90 fm=corner id=469
H 458 9 rot=180 fm=corner id=469
H 456.002 10 0.05 1 rot=-90 fm=edge id=468
H 456.002 11 0.05 1 rot=-90 fm=edge id=468
H 458.948 11 0.05 1 rot=90 fm=edge id=468
H 458.948 10 0.05 1 rot=90 fm=edge id=468
H 457 9 1 0.05 rot=-180 fm=edge id=468
E 458 8 rot=90 art=3812 id=3812 z=3
H 458 5 fm=corner id=469
H 461 5 rot=-270 fm=corner id=469
H 459 5.95 1 0.05 fm=edge id=468
H 460 5.95 1 0.05 fm=edge id=468
H 458.002 4 0.05 1 rot=270 fm=edge id=468
H 458.002 3 0.05 1 rot=270 fm=edge id=468
H 458.002 2 0.05 1 rot=270 fm=edge id=468
H 458.002 1 0.05 1 rot=270 fm=edge id=468
H 458.002 0 0.05 1 rot=270 fm=edge id=468
H 461.948 4 0.05 1 rot=90 fm=edge id=468
H 461.948 3 0.05 1 rot=90 fm=edge id=468
H 461.948 2 0.05 1 rot=90 fm=edge id=468
H 461.948 1 0.05 1 rot=90 fm=edge id=468
H 461.948 0 0.05 1 rot=90 fm=edge id=468
E 461 6 rot=-90 art=3812 id=3812 z=3
H 461 9 rot=270 fm=corner id=469
H 464 9 rot=180 fm=corner id=469
H 461.002 10 0.05 1 rot=-90 fm=edge id=468
H 461.002 11 0.05 1 rot=-90 fm=edge id=468
H 464.948 11 0.05 1 rot=90 fm=edge id=468
H 464.948 10 0.05 1 rot=90 fm=edge id=468
H 463 9 1 0.05 rot=180 fm=edge id=468
H 462 9 1 0.05 rot=180 fm=edge id=468
H 464 5 fm=corner id=469
H 467 5 rot=90 fm=corner id=469
H 465 5.95 1 0.05 fm=edge id=468
H 466 5.95 1 0.05 fm=edge id=468
H 464.002 4 0.05 1 rot=-90 fm=edge id=468
H 464.002 3 0.05 1 rot=-90 fm=edge id=468
H 464.002 2 0.05 1 rot=-90 fm=edge id=468
H 464.002 1 0.05 1 rot=-90 fm=edge id=468
H 464.002 0 0.05 1 rot=-90 fm=edge id=468
H 467.948 4 0.05 1 rot=90 fm=edge id=468
H 467.948 3 0.05 1 rot=90 fm=edge id=468
H 467.948 1 0.05 1 rot=90 fm=edge id=468
H 467.948 0 0.05 1 rot=90 fm=edge id=468
H 467.948 2 0.05 1 rot=90 fm=edge id=468
H 467 9 rot=-90 fm=corner id=469
H 470 9 rot=180 fm=corner id=469
H 468 9 1 0.05 rot=180 fm=edge id=468
H 467.002 10 0.05 1 rot=-90 fm=edge id=468
H 467.002 11 0.05 1 rot=-90 fm=edge id=468
H 470.948 11 0.05 1 rot=90 fm=edge id=468
H 470.948 10 0.05 1 rot=90 fm=edge id=468
H 469 5 fm=corner id=469
H 473 5 rot=90 fm=corner id=469
H 470 5.95 1 0.05 fm=edge id=468
H 471 5.95 1 0.05 fm=edge id=468
H 469.002 4 0.05 1 rot=-90 fm=edge id=468
H 469.002 3 0.05 1 rot=-90 fm=edge id=468
H 469.002 2 0.05 1 rot=-90 fm=edge id=468
H 469.002 1 0.05 1 rot=-90 fm=edge id=468
H 469.002 0 0.05 1 rot=-90 fm=edge id=468
H 473.948 4 0.05 1 rot=90 fm=edge id=468
H 473.948 3 0.05 1 rot=90 fm=edge id=468
H 473.948 2 0.05 1 rot=90 fm=edge id=468
H 473.948 1 0.05 1 rot=90 fm=edge id=468
H 473.948 0 0.05 1 rot=90 fm=edge id=468
H 472 9 rot=-90 fm=corner id=469
H 472.002 11 0.05 1 rot=270 fm=edge id=468
H 476 9 rot=180 fm=corner id=469
H 473 9 1 0.05 rot=180 fm=edge id=468
H 474 9 1 0.05 rot=180 fm=edge id=468
H 476.948 11 0.05 1 rot=90 fm=edge id=468
H 477 5.95 1 0.05 fm=edge id=468
H 478 9 rot=-90 fm=corner id=469
H 478.002 11 0.05 1 rot=270 fm=edge id=468
H 479 9 1 0.05 rot=180 fm=edge id=468
H 481 5 rot=90 fm=corner id=469
H 481.948 4 0.05 1 rot=90 fm=edge id=468
H 481.948 3 0.05 1 rot=90 fm=edge id=468
H 481.948 2 0.05 1 rot=90 fm=edge id=468
H 481.948 1 0.05 1 rot=90 fm=edge id=468
H 481.948 0 0.05 1 rot=90 fm=edge id=468
H 480 9 1 0.05 rot=180 fm=edge id=468
H 481 9 1 0.05 rot=180 fm=edge id=468
H 489 9 rot=180 fm=corner id=469
H 489.948 11 0.05 1 rot=90 fm=edge id=468
H 489.948 10 0.05 1 rot=90 fm=edge id=468
H 488 9 1 0.05 rot=180 fm=edge id=468
H 489 5 fm=corner id=469
H 489.002 4 0.05 1 rot=-90 fm=edge id=468
H 489.002 3 0.05 1 rot=-90 fm=edge id=468
H 489.002 1 0.05 1 rot=-90 fm=edge id=468
H 489.002 0 0.05 1 rot=-90 fm=edge id=468
H 489.002 2 0.05 1 rot=-90 fm=edge id=468
H 491 5.95 1 0.05 fm=edge id=468
H 490 5.95 1 0.05 fm=edge id=468
K 490 7 inert=1 id=286 z=2
H 495 9 1 0.05 rot=180 fm=edge id=468
H 496 9 1 0.05 rot=180 fm=edge id=468
H 497 9 1 0.05 rot=180 fm=edge id=468
H 492 5.95 1 0.05 fm=edge id=468
H 493 5.95 1 0.05 fm=edge id=468
H 494 5.95 1 0.05 fm=edge id=468
H 495 5.95 1 0.05 fm=edge id=468
H 496 5.95 1 0.05 fm=edge id=468
R 492 10 to=ball id=47 z=2
H 494 9 rot=-90 fm=corner id=469
H 494 10 fm=corner id=469
H 495 10.95 1 0.05 fm=edge id=468
H 496 10.95 1 0.05 fm=edge id=468
H 497 10.95 1 0.05 fm=edge id=468
H 498 10.95 1 0.05 fm=edge id=468
H 499 10.95 1 0.05 fm=edge id=468
H 500 10.95 1 0.05 fm=edge id=468
H 501 10.95 1 0.05 fm=edge id=468
H 503 10.95 1 0.05 fm=edge id=468
H 502 10.95 1 0.05 fm=edge id=468
H 504 10.95 1 0.05 fm=edge id=468
H 505 10.95 1 0.05 fm=edge id=468
H 506 10.95 1 0.05 fm=edge id=468
H 507 10.95 1 0.05 fm=edge id=468
H 508 10.95 1 0.05 fm=edge id=468
H 509 10.95 1 0.05 fm=edge id=468
H 510 10.95 1 0.05 fm=edge id=468
H 511 10.95 1 0.05 fm=edge id=468
H 498 9 1 0.05 rot=180 fm=edge id=468
H 499 9 1 0.05 rot=180 fm=edge id=468
H 500 9 1 0.05 rot=180 fm=edge id=468
H 501 9 1 0.05 rot=180 fm=edge id=468
H 502 9 1 0.05 rot=180 fm=edge id=468
S 493.3 9.25 1 0.5 rot=270 id=39
H 497 5.95 1 0.05 fm=edge id=468
H 498 5.95 1 0.05 fm=edge id=468
H 499 5.95 1 0.05 fm=edge id=468
H 500 5.95 1 0.05 fm=edge id=468
H 501 5.95 1 0.05 fm=edge id=468
H 502 5.95 1 0.05 fm=edge id=468
R 489 7 to=ball id=47 z=2
S 494 8 rot=180 id=8
S 495 8 rot=180 id=8
S 496 8 rot=180 id=8
H 503 5.95 1 0.05 fm=edge id=468
H 504 5.95 1 0.05 fm=edge id=468
H 505 5.95 1 0.05 fm=edge id=468
H 506 5.95 1 0.05 fm=edge id=468
H 507 5.95 1 0.05 fm=edge id=468
H 503 9 1 0.05 rot=180 fm=edge id=468
H 504 9 1 0.05 rot=180 fm=edge id=468
H 505 9 1 0.05 rot=180 fm=edge id=468
H 506 9 1 0.05 rot=180 fm=edge id=468
D 498 6 1 0.2 pad=blue id=67 z=2
D 499 8.8 1 0.2 pad=blue rot=180 id=67 z=2
S 501 8 rot=180 id=8
S 502 8 rot=180 id=8
D 504 6 1 0.2 pad=blue id=67 z=2
D 505 8.8 1 0.2 pad=blue rot=180 id=67 z=2
H 507 9 1 0.05 rot=180 fm=edge id=468
H 508 9 1 0.05 rot=180 fm=edge id=468
H 509 9 1 0.05 rot=180 fm=edge id=468
H 510 9 1 0.05 rot=180 fm=edge id=468
H 511 9 1 0.05 rot=180 fm=edge id=468
H 508 5.95 1 0.05 fm=edge id=468
H 509 5.95 1 0.05 fm=edge id=468
H 511 5.95 1 0.05 fm=edge id=468
H 512 5.95 1 0.05 fm=edge id=468
H 510 5.95 1 0.05 fm=edge id=468
H 514 5.95 1 0.05 fm=edge id=468
H 513 5.95 1 0.05 fm=edge id=468
H 516 5.95 1 0.05 fm=edge id=468
H 517 5.95 1 0.05 fm=edge id=468
H 515 5.95 1 0.05 fm=edge id=468
H 512 9 1 0.05 rot=180 fm=edge id=468
H 513 9 1 0.05 rot=180 fm=edge id=468
H 514 9 1 0.05 rot=180 fm=edge id=468
H 516 9 1 0.05 rot=180 fm=edge id=468
H 515 9 1 0.05 rot=180 fm=edge id=468
H 512 10.95 1 0.05 fm=edge id=468
H 513 10.95 1 0.05 fm=edge id=468
D 510 6 1 0.2 pad=blue id=67 z=2
D 511 8.8 1 0.2 pad=blue rot=180 id=67 z=2
X 501 6 id=143
X 514 6 id=143
S 507 8 rot=180 id=8
S 508 8 rot=180 id=8
S 509 8 rot=180 id=8
S 513 8 rot=180 id=8
S 514 8 rot=180 id=8
S 515 8 rot=180 id=8
X 498 11 id=143
X 504 11 id=143
X 507 11 id=143
X 510 11 id=143
X 513 11 id=143
H 518 5.95 1 0.05 fm=edge id=468
H 519 5.95 1 0.05 fm=edge id=468
H 522 5.95 1 0.05 fm=edge id=468
H 520 5.95 1 0.05 fm=edge id=468
H 521 5.95 1 0.05 fm=edge id=468
H 523 5.95 1 0.05 fm=edge id=468
H 524 5.95 1 0.05 fm=edge id=468
H 643 18.95 1 0.05 fm=edge id=468
K 516 7 inert=1 id=287 z=2
H 514 10.95 1 0.05 fm=edge id=468
H 515 10.95 1 0.05 fm=edge id=468
H 515.948 11 0.05 1 rot=90 fm=edge id=468
H 516.948 8 0.05 1 rot=90 fm=edge id=468
H 516.948 7 0.05 1 rot=90 fm=edge id=468
H 517 7 1 0.05 rot=180 fm=edge id=468
H 518 7 1 0.05 rot=180 fm=edge id=468
H 519 7 1 0.05 rot=180 fm=edge id=468
H 520 7 1 0.05 rot=180 fm=edge id=468
H 521 7 1 0.05 rot=180 fm=edge id=468
X 517 6 id=143
X 518 6 id=143
X 519 6 id=143
X 520 6 id=143
X 521 6 id=143
X 522 6 id=143
X 523 6 id=143
X 524 6 id=143
H 522 7 1 0.05 rot=180 fm=edge id=468
H 523 7 1 0.05 rot=180 fm=edge id=468
H 524 7 1 0.05 rot=180 fm=edge id=468
E 461 8 art=3810 id=3810 z=3
H 644 18.95 1 0.05 fm=edge id=468
H 645 18.95 1 0.05 fm=edge id=468
H 646 18.95 1 0.05 fm=edge id=468
H 647 18.95 1 0.05 fm=edge id=468
C 643 19 id=2063
H 648 18.95 1 0.05 fm=edge id=468
H 649 18.95 1 0.05 fm=edge id=468
V 512 7 spd=1 id=201 z=2
V 423 5 spd=0 id=200 z=2
H 650 18.95 1 0.05 fm=edge id=468
H 651 18.95 1 0.05 fm=edge id=468
H 652 18.95 1 0.05 fm=edge id=468
H 653 18.95 1 0.05 fm=edge id=468
H 654 18.95 1 0.05 fm=edge id=468
H 655 18.95 1 0.05 fm=edge id=468
H 656 18.95 1 0.05 fm=edge id=468
H 658 18.95 1 0.05 fm=edge id=468
H 657 18.95 1 0.05 fm=edge id=468
H 659 18.95 1 0.05 fm=edge id=468
H 660 18.95 1 0.05 fm=edge id=468
H 661 18.95 1 0.05 fm=edge id=468
H 662 18.95 1 0.05 fm=edge id=468
V 650 20 spd=4 id=1334 z=2
R 657 20 to=cube id=12 z=2
H 663 18.95 1 0.05 fm=edge id=468
O 666 21 orb=yellow id=36 z=2
O 668.5 23 orb=yellow id=36 z=2
O 671 25 orb=yellow id=36 z=2
W 667.033 14.167 2.933 5.667 id=1705 z=5
W 670.033 17.667 2.933 5.667 id=1705 z=5
W 671.539 15.644 1.921 3.712 id=1705 z=5
W 662.407 22.389 2.185 4.222 id=1705 z=5
W 662.907 25.889 2.185 4.222 id=1705 z=5
O 674 27 orb=black id=1330 z=2
O 681 17 orb=blue id=84 z=2
O 682 18 orb=black id=1330 z=2
B 686 26 id=83
B 687 26 id=83
B 688 26 id=83
B 686 27 id=83
B 687 27 id=83
B 688 27 id=83
B 686 28 id=83
B 687 28 id=83
B 688 28 id=83
B 687 29 id=83
B 688 29 id=83
B 689 29 id=83
B 689 28 id=83
B 689 27 id=83
B 690 28 id=83
B 690 29 id=83
B 688 30 id=83
B 687 30 id=83
S 685 27 rot=270 id=8
S 685 26 rot=270 id=8
S 691 28 rot=90 id=8
W 677.033 28.667 2.933 5.667 id=1705 z=5
W 677.649 24.857 1.701 3.287 id=1705 z=5
W 679.827 21.233 2.347 4.533 id=1705 z=5
W 684.767 13.083 1.467 2.833 id=1705 z=5
W 678.033 11.667 2.933 5.667 id=1705 z=5
W 685.327 15.233 2.347 4.533 id=1705 z=5
W 680.246 25.078 2.508 4.845 id=1705 z=5
B 695 26 id=83
B 696 26 id=83
B 693 28 id=83
B 694 27 id=83
B 694 28 id=83
B 695 27 id=83
B 695 28 id=83
B 693 29 id=83
B 694 29 id=83
S 692 29 rot=270 id=8
W 690.767 24.083 1.467 2.833 id=1705 z=5
O 699 23 orb=yellow id=36 z=2
B 693 20 id=83
B 692 19 id=83
B 691 19 id=83
B 691 18 id=83
B 693 19 id=83
B 694 19 id=83
B 695 19 id=83
B 696 18 id=83
B 697 18 id=83
B 696 19 id=83
B 698 17 id=83
B 697 17 id=83
B 696 17 id=83
B 695 18 id=83
B 694 18 id=83
B 693 18 id=83
B 695 17 id=83
B 694 17 id=83
B 693 17 id=83
B 692 18 id=83
B 692 17 id=83
B 690 18 id=83
B 690 19 id=83
B 692 20 id=83
S 690 20 id=8
S 691 20 id=8
S 689 19 rot=-90 id=8
S 692 21 id=8
S 693 21 id=8
S 694 20 id=8
S 695 20 id=8
S 696 20 id=8
S 697 19 id=8
S 698 18 id=8
S 699 17 rot=90 id=8
S 698 16 rot=180 id=8
S 697 16 rot=180 id=8
S 696 16 rot=180 id=8
S 694 16 rot=180 id=8
S 695 16 rot=180 id=8
S 693 16 rot=180 id=8
S 692 16 rot=180 id=8
S 691 17 rot=180 id=8
S 690 17 rot=180 id=8
S 689 18 rot=270 id=8
E 639 22 art=3823 id=3823 z=3
D 703 26.8 1 0.2 pad=blue rot=180 id=67 z=2
B 704 27 id=83
B 703 27 id=83
B 702 28 id=83
B 702 29 id=83
B 703 28 id=83
B 703 29 id=83
B 704 28 id=83
B 705 28 id=83
B 705 27 id=83
S 701 28 rot=-90 id=8
S 701 29 rot=-90 id=8
S 703 30 id=8
S 702 30 id=8
W 697.783 25.148 2.435 4.703 id=1705 z=5
W 699.767 29.083 1.467 2.833 id=1705 z=5
W 700.283 16.148 2.435 4.703 id=1705 z=5
W 703.267 19.583 1.467 2.833 id=1705 z=5
S 706 28 rot=90 id=8
W 666.033 25.667 2.933 5.667 id=1705 z=5
O 701 21 orb=black id=1330 z=2
B 710 16 id=83
B 711 16 id=83
B 711 17 id=83
B 710 17 id=83
B 709 18 id=83
B 708 17 id=83
B 710 18 id=83
B 709 17 id=83
B 711 18 id=83
B 709 16 id=83
B 708 16 id=83
B 707 16 id=83
B 712 16 id=83
B 712 17 id=83
B 709 15 id=83
B 708 15 id=83
B 707 15 id=83
B 707 17 id=83
B 706 16 id=83
O 711 24 orb=yellow id=36 z=2
G 714 22.5 gd=-1 id=11 z=2
B 717 25 id=83
B 717 26 id=83
B 716 26 id=83
B 718 25 id=83
B 722 19 id=83
B 723 18 id=83
B 723 19 id=83
B 722 18 id=83
B 721 17 id=83
B 722 17 id=83
B 726 25 id=83
B 725 26 id=83
B 726 26 id=83
B 726 27 id=83
B 727 27 id=83
B 730 19 id=83
B 730 18 id=83
B 729 19 id=83
B 731 18 id=83
B 729 18 id=83
D 718 24.8 1 0.2 pad=blue rot=180 id=67 z=2
D 722 20 1 0.2 pad=blue id=67 z=2
D 726 24.8 1 0.2 pad=blue rot=180 id=67 z=2
D 729 20 1 0.2 pad=blue id=67 z=2
W 713.451 26.474 2.097 4.052 id=1705 z=5
W 709.533 28.167 2.933 5.667 id=1705 z=5
W 714.863 14.304 2.273 4.392 id=1705 z=5
W 718.525 16.616 1.951 3.768 id=1705 z=5
W 720.533 24.667 2.933 5.667 id=1705 z=5
W 725.18 14.95 2.64 5.1 id=1705 z=5
W 708.767 26.083 1.467 2.833 id=1705 z=5
S 717 27 id=8
S 718 26 id=8
S 726 28 id=8
S 727 28 id=8
S 723 17 rot=180 id=8
S 722 16 rot=180 id=8
S 730 17 rot=180 id=8
S 731 17 rot=180 id=8
S 731 19 id=8
S 732 18 rot=90 id=8
E 709 19.65 art=41 id=41 z=6
G 732 24 gd=1 id=10 z=2
V 733 24 spd=2 id=202 z=2
O 737 19 orb=yellow id=36 z=2
O 739 22 orb=yellow id=36 z=2
O 741 25 orb=pink id=141 col=13017343 z=2
B 746 19 id=83
B 747 19 id=83
B 746 18 id=83
B 747 18 id=83
B 745 18 id=83
B 748 18 id=83
B 748 17 id=83
B 747 17 id=83
B 745 17 id=83
B 746 17 id=83
B 749 17 id=83
B 750 16 id=83
B 749 16 id=83
B 749 18 id=83
B 748 16 id=83
B 747 16 id=83
A 751 22 rot=-45 ar=pink id=1751 z=2
B 756 27 id=83
B 755 27 id=83
B 756 28 id=83
B 755 28 id=83
B 757 28 id=83
B 756 29 id=83
B 757 29 id=83
B 758 29 id=83
B 757 30 id=83
B 756 30 id=83
B 755 29 id=83
B 754 28 id=83
B 754 29 id=83
G 758 24 gd=1 id=10 z=2
D 761 20 1 0.2 pad=blue id=67 z=2
D 762 23.8 1 0.2 pad=blue rot=180 id=67 z=2
D 763 21 1 0.2 pad=blue id=67 z=2
D 765 23.8 1 0.2 pad=blue rot=180 id=67 z=2
B 762 24 id=83
B 762 25 id=83
B 761 24 id=83
B 765 24 id=83
B 765 25 id=83
B 764 25 id=83
B 763 20 id=83
B 762 19 id=83
B 763 19 id=83
B 761 19 id=83
B 762 18 id=83
W 740.033 14.667 2.933 5.667 id=1705 z=5
W 744.033 24.667 2.933 5.667 id=1705 z=5
W 750.202 25.993 2.596 5.015 id=1705 z=5
W 748.032 23.63 1.936 3.74 id=1705 z=5
W 746.51 28.588 1.98 3.825 id=1705 z=5
W 759.767 26.083 1.467 2.833 id=1705 z=5
W 755.033 16.667 2.933 5.667 id=1705 z=5
W 751.407 15.389 2.185 4.222 id=1705 z=5
B 769 18 id=83
B 770 18 id=83
B 769 17 id=83
B 768 18 id=83
B 768 17 id=83
B 767 17 id=83
B 767 18 id=83
B 768 16 id=83
B 767 16 id=83
B 766 17 id=83
B 766 18 id=83
B 765 17 id=83
V 767 20 spd=4 id=1334 z=2
B 771 18 id=83
B 770 17 id=83
B 769 16 id=83
R 769 20 to=ufo id=111 z=2
B 772 24 id=83
B 772 25 id=83
B 771 25 id=83
B 771 24 id=83
B 773 25 id=83
B 775 17 id=83
B 776 18 id=83
B 776 17 id=83
B 777 18 id=83
B 778 17 id=83
B 777 16 id=83
B 778 15 id=83
B 777 17 id=83
B 778 16 id=83
W 775.767 15.083 1.467 2.833 id=1705 z=5
W 777.767 17.083 1.467 2.833 id=1705 z=5
W 771.569 21.701 1.863 3.598 id=1705 z=5
W 783.686 19.928 1.628 3.145 id=1705 z=5
W 779.327 25.233 2.347 4.533 id=1705 z=5
B 781 14 id=83
B 782 14 id=83
B 783 14 id=83
B 783 15 id=83
B 784 21 id=83
B 777 25 id=83
B 776 25 id=83
B 776 24 id=83
B 786 28 id=83
B 787 28 id=83
B 787 27 id=83
B 785 28 id=83
B 786 29 id=83
W 790.686 15.928 1.628 3.145 id=1705 z=5
W 789.686 23.928 1.628 3.145 id=1705 z=5
W 782.686 27.928 1.628 3.145 id=1705 z=5
N 791 15 id=1329 z=2
B 794 23 id=83
B 795 23 id=83
B 793 24 id=83
B 795 24 id=83
B 794 24 id=83
B 796 23 id=83
B 796 24 id=83
B 797 24 id=83
B 796 25 id=83
B 795 25 id=83
S 786 27 rot=180 id=8
S 785 27 rot=180 id=8
S 787 26 rot=180 id=8
S 788 27 rot=90 id=8
S 788 28 rot=90 id=8
S 785 29 id=8
S 787 29 id=8
S 786 30 id=8
S 777 24 rot=180 id=8
S 776 23 rot=180 id=8
S 775 24 rot=270 id=8
S 775 25 rot=270 id=8
S 776 26 id=8
S 777 26 id=8
S 778 25 rot=90 id=8
X 790 15 id=143
X 790 14 id=143
X 790 13 id=143
X 792 15 id=143
X 792 14 id=143
X 792 13 id=143
B 792 16 id=83
B 790 16 id=83
B 792 17 id=83
B 791 16 id=83
S 781 15 id=8
S 782 15 id=8
S 783 16 id=8
S 784 15 rot=90 id=8
S 784 14 rot=90 id=8
S 780 14 rot=-90 id=8
W 800.033 11.667 2.933 5.667 id=1705 z=5
B 803 15 id=83
B 803 14 id=83
B 802 13 id=83
B 803 13 id=83
W 803.767 15.083 1.467 2.833 id=1705 z=5
B 804 15 id=83
B 804 14 id=83
W 800.033 24.667 2.933 5.667 id=1705 z=5
W 810.767 27.083 1.467 2.833 id=1705 z=5
B 810 29 id=83
B 811 29 id=83
B 812 29 id=83
B 811 30 id=83
B 810 28 id=83
W 807.576 25.715 1.848 3.57 id=1705 z=5
W 806.767 8.083 1.467 2.833 id=1705 z=5
W 812.767 8.083 1.467 2.833 id=1705 z=5
S 783 13 rot=180 id=8
S 782 13 rot=180 id=8
S 781 13 rot=180 id=8
W 818.767 22.083 1.467 2.833 id=1705 z=5
W 811.334 18.248 2.332 4.505 id=1705 z=5
W 816.517 16.602 1.965 3.797 id=1705 z=5
W 823.767 20.083 1.467 2.833 id=1705 z=5
B 817 17 id=83
B 816 17 id=83
B 818 18 id=83
B 818 17 id=83
B 819 24 id=83
B 820 24 id=83
B 820 23 id=83
S 821 23 rot=90 id=8
S 821 24 rot=90 id=8
W 807.033 16.667 2.933 5.667 id=1705 z=5
B 810 17 id=83
B 809 17 id=83
B 808 16 id=83
B 809 16 id=83
B 810 16 id=83
B 811 17 id=83
B 808 18 id=83
B 809 18 id=83
B 808 17 id=83
B 807 17 id=83
G 810 23 gd=-1 id=11 z=2
B 811 16 id=83
B 812 17 id=83
B 812 18 id=83
B 812 19 id=83
B 813 19 id=83
B 813 18 id=83
B 811 18 id=83
B 810 18 id=83
S 808 15 rot=180 id=8
S 811 15 rot=180 id=8
S 809 15 rot=180 id=8
S 810 15 rot=180 id=8
S 812 16 rot=180 id=8
S 813 17 rot=180 id=8
S 814 18 rot=90 id=8
S 815 17 rot=-90 id=8
S 806 17 rot=-90 id=8
S 807 16 rot=-180 id=8
W 818.767 15.083 1.467 2.833 id=1705 z=5
B 818 16 id=83
B 817 16 id=83
R 824 18 to=ship id=13 z=2
G 825 18 gd=1 id=10 z=2
W 827.253 20.092 2.493 4.817 id=1705 z=5
W 836.767 22.083 1.467 2.833 id=1705 z=5
W 828.444 12.46 2.112 4.08 id=1705 z=5
W 833.371 19.318 2.259 4.363 id=1705 z=5
W 834.569 12.701 1.863 3.598 id=1705 z=5
W 839.459 20.488 2.083 4.023 id=1705 z=5
W 840.319 13.219 2.361 4.562 id=1705 z=5
W 845.525 14.616 1.951 3.768 id=1705 z=5
W 849.495 21.559 2.009 3.882 id=1705 z=5
W 843.767 23.083 1.467 2.833 id=1705 z=5
W 850.033 12.667 2.933 5.667 id=1705 z=5
W 855.033 21.667 2.933 5.667 id=1705 z=5
W 859.767 21.083 1.467 2.833 id=1705 z=5
W 860.561 13.687 1.877 3.627 id=1705 z=5
W 862.767 20.083 1.467 2.833 id=1705 z=5
W 864.466 13.503 2.068 3.995 id=1705 z=5
W 843.943 13.423 1.115 2.153 id=1705 z=5
W 847.943 13.423 1.115 2.153 id=1705 z=5
W 852.943 21.423 1.115 2.153 id=1705 z=5
W 836.943 19.423 1.115 2.153 id=1705 z=5
W 837.943 14.423 1.115 2.153 id=1705 z=5
B 832 14 id=83
B 833 15 id=83
B 832 15 id=83
B 833 14 id=83
B 831 14 id=83
E 832 16.65 art=41 id=41 z=6
B 846 23 id=83
B 847 23 id=83
B 847 22 id=83
B 848 23 id=83
B 848 22 id=83
B 846 22 id=83
B 845 22 id=83
B 846 24 id=83
B 847 24 id=83
S 848 24 id=8
S 847 25 id=8
S 846 25 id=8
B 855 13 id=83
B 855 14 id=83
B 856 15 id=83
B 856 14 id=83
B 857 15 id=83
B 858 14 id=83
B 857 14 id=83
B 858 15 id=83
B 856 13 id=83
S 855 15 id=8
S 856 15.95 1 0.5 id=39
S 858 15.95 1 0.5 id=39
S 857 15.95 1 0.5 id=39
S 854 14 rot=-90 id=8
S 854 13 rot=-90 id=8
S 859 14 rot=90 id=8
S 859 15 rot=90 id=8
W 870.033 20.667 2.933 5.667 id=1705 z=5
W 868.371 12.318 2.259 4.363 id=1705 z=5
W 849.033 9.667 2.933 5.667 id=1705 z=5
B 866 22 id=83
B 867 22 id=83
B 866 23 id=83
B 865 22 id=83
B 867 23 id=83
B 868 22 id=83
S 865 21 rot=180 id=8
S 866 21 rot=180 id=8
S 867 21 rot=180 id=8
S 868 21 rot=180 id=8
S 865 23 id=8
S 866 24 id=8
S 867 24 id=8
S 868 23 id=8
E 857 16.65 art=41 id=41 z=6
R 871 18 to=cube id=12 z=2
D 874 17 1 0.2 pad=blue id=67 z=2
B 873 16 id=83
B 874 16 id=83
B 875 16 id=83
B 875 15 id=83
B 874 15 id=83
B 872 15 id=83
B 873 15 id=83
R 879 26 to=wave id=660 z=2
W 887.767 28.083 1.467 2.833 id=1705 z=5
W 892.033 27.667 2.933 5.667 id=1705 z=5
W 889.767 19.083 1.467 2.833 id=1705 z=5
W 896.033 18.667 2.933 5.667 id=1705 z=5
W 885.033 17.667 2.933 5.667 id=1705 z=5
B 891 22 id=83
B 892 21 id=83
B 893 21 id=83
B 893 22 id=83
B 892 22 id=83
N 710 24 id=1329 z=2
W 881.356 15.29 2.288 4.42 id=1705 z=5
B 880 17 id=83
B 881 17 id=83
B 881 16 id=83
B 880 16 id=83
B 879 16 id=83
B 879 15 id=83
B 882 17 id=83
W 877.033 13.667 2.933 5.667 id=1705 z=5
V 873 18 spd=3 id=203 z=2
W 906.767 26.083 1.467 2.833 id=1705 z=5
W 904.767 23.083 1.467 2.833 id=1705 z=5
W 900.767 20.083 1.467 2.833 id=1705 z=5
W 903.033 24.667 2.933 5.667 id=1705 z=5
B 898 29 id=83
B 898 30 id=83
B 897 30 id=83
B 897 29 id=83
B 896 29 id=83
B 899 29 id=83
B 899 30 id=83
B 900 29 id=83
B 901 29 id=83
B 900 30 id=83
B 899 31 id=83
B 898 31 id=83
B 897 31 id=83
B 901 30 id=83
B 902 29 id=83
S 897 32 id=8
S 898 32 id=8
S 899 32 id=8
S 900 31 id=8
S 901 31 id=8
S 902 30 id=8
S 896 30 id=8
W 909.033 16.667 2.933 5.667 id=1705 z=5
W 909.767 28.083 1.467 2.833 id=1705 z=5
W 914.525 23.616 1.951 3.768 id=1705 z=5
S 891 23 id=8
S 892 23 id=8
S 893 23 id=8
S 890 22 rot=-90 id=8
W 898.275 27.134 2.449 4.732 id=1705 z=5
B 920 30 id=83
B 921 30 id=83
B 923 30 id=83
B 923 29 id=83
B 922 29 id=83
B 922 30 id=83
B 920 18 id=83
B 922 20 id=83
B 921 19 id=83
B 922 19 id=83
B 922 18 id=83
B 923 18 id=83
B 923 19 id=83
B 923 20 id=83
B 924 19 id=83
B 924 21 id=83
B 923 21 id=83
B 922 22 id=83
B 924 20 id=83
B 925 19 id=83
B 924 18 id=83
B 925 18 id=83
B 926 18 id=83
B 925 20 id=83
B 926 19 id=83
B 921 18 id=83
B 920 19 id=83
B 924 24 id=83
B 922 28 id=83
B 924 29 id=83
B 924 30 id=83
S 923 22 id=8
S 921 20 id=8
S 920 20 id=8
S 921 29 rot=180 id=8
S 920 29 rot=180 id=8
S 923 28 rot=180 id=8
S 924 28 rot=180 id=8
S 925 24 rot=90 id=8
W 918.767 18.083 1.467 2.833 id=1705 z=5
W 918.767 28.083 1.467 2.833 id=1705 z=5
W 927.767 28.083 1.467 2.833 id=1705 z=5
W 930.767 24.083 1.467 2.833 id=1705 z=5
W 927.033 16.667 2.933 5.667 id=1705 z=5
W 931.033 26.667 2.933 5.667 id=1705 z=5
W 934.268 24.12 2.464 4.76 id=1705 z=5
W 935.422 28.418 2.156 4.165 id=1705 z=5
B 932 19 id=83
B 934 19 id=83
B 933 20 id=83
B 934 20 id=83
B 933 19 id=83
B 936 20 id=83
B 935 21 id=83
B 935 20 id=83
B 934 21 id=83
B 935 19 id=83
B 936 19 id=83
B 932 20 id=83
S 932 21 id=8
S 933 21 id=8
S 936 21 id=8
W 943.033 17.667 2.933 5.667 id=1705 z=5
W 939.033 26.667 2.933 5.667 id=1705 z=5
W 943.767 29.083 1.467 2.833 id=1705 z=5
W 945.767 22.083 1.467 2.833 id=1705 z=5
W 948.253 22.092 2.493 4.817 id=1705 z=5
W 947.525 18.616 1.951 3.768 id=1705 z=5
W 955.033 23.667 2.933 5.667 id=1705 z=5
W 951.033 17.667 2.933 5.667 id=1705 z=5
B 960 25 id=83
B 960 27 id=83
B 959 27 id=83
B 961 27 id=83
B 960 26 id=83
B 961 26 id=83
B 961 25 id=83
B 962 25 id=83
S 959 28 id=8
S 960 28 id=8
S 961 28 id=8
S 960 24 rot=180 id=8
S 961 24 rot=180 id=8
S 959 25 rot=270 id=8
S 959 26 rot=270 id=8
S 962 26 rot=90 id=8
S 962 27 rot=90 id=8
S 963 25 rot=90 id=8
S 962 24 rot=180 id=8
S 958 27 rot=270 id=8
V 968 25 spd=4 id=1334 z=2
W 955.488 17.545 2.024 3.91 id=1705 z=5
W 959.033 15.667 2.933 5.667 id=1705 z=5
W 963.767 19.083 1.467 2.833 id=1705 z=5
N 961 22 id=1329 z=2
B 967 30 id=83
B 969 30 id=83
B 968 30 id=83
B 966 30 id=83
B 968 29 id=83
B 967 29 id=83
B 969 29 id=83
S 965 30 rot=-90 id=8
S 966 29 rot=-90 id=8
S 970 30 rot=90 id=8
S 970 29 rot=90 id=8
B 968 28 id=83
B 969 27 id=83
B 967 28 id=83
B 966 18 id=83
B 967 19 id=83
B 968 20 id=83
B 968 19 id=83
B 968 21 id=83
B 967 20 id=83
B 969 21 id=83
B 969 20 id=83
B 968 22 id=83
B 969 19 id=83
B 970 18 id=83
B 971 21 id=83
B 969 18 id=83
B 968 18 id=83
B 967 18 id=83
S 967 21 id=8
S 966 19 id=8
S 966 28 rot=-90 id=8
S 970 27 rot=90 id=8
S 972 21 rot=90 id=8
S 969 22 id=8
W 971.363 26.304 2.273 4.392 id=1705 z=5
W 973.033 16.667 2.933 5.667 id=1705 z=5
W 976.033 27.667 2.933 5.667 id=1705 z=5
W 978.033 18.667 2.933 5.667 id=1705 z=5
W 986.033 18.667 2.933 5.667 id=1705 z=5
W 984.033 27.667 2.933 5.667 id=1705 z=5
W 989.422 27.418 2.156 4.165 id=1705 z=5
W 995.51 22.588 1.98 3.825 id=1705 z=5
W 1001.767 26.083 1.467 2.833 id=1705 z=5
W 997.767 28.083 1.467 2.833 id=1705 z=5
W 975.921 21.381 1.159 2.238 id=1705 z=5
B 982 23 id=83
B 983 23 id=83
B 984 22 id=83
B 983 22 id=83
B 983 21 id=83
B 982 21 id=83
B 982 20 id=83
B 982 22 id=83
B 981 22 id=83
B 981 21 id=83
S 981 23 id=8
S 982 24 id=8
S 983 24 id=8
S 984 23 id=8
S 982 19 rot=180 id=8
S 983 20 rot=180 id=8
S 984 21 rot=180 id=8
S 981 20 rot=180 id=8
B 980 29 id=83
B 982 29 id=83
B 983 29 id=83
B 981 29 id=83
B 982 30 id=83
B 983 30 id=83
B 980 30 id=83
B 981 30 id=83
B 981 31 id=83
B 982 31 id=83
B 983 31 id=83
B 984 31 id=83
B 984 30 id=83
S 980 31 id=8
S 981 32 id=8
S 982 32 id=8
S 983 32 id=8
S 984 32 id=8
W 994.033 25.667 2.933 5.667 id=1705 z=5
W 998.422 24.418 2.156 4.165 id=1705 z=5
Z 1002 22 mini=1 id=101 z=2
W 1003.033 27.667 2.933 5.667 id=1705 z=5
W 1016.613 18.786 1.775 3.428 id=1705 z=5
W 1021.033 27.667 2.933 5.667 id=1705 z=5
W 1012.033 16.667 2.933 5.667 id=1705 z=5
B 1010 19 id=83
B 1009 19 id=83
B 1008 19 id=83
B 1009 18 id=83
B 1009 20 id=83
B 1010 20 id=83
S 1008 20 id=8
E 1009 21.65 art=41 id=41 z=6
Z 1019 24 mini=0 id=99 z=2
B 1010 28 id=83
B 1009 28 id=83
B 1009 27 id=83
B 1011 28 id=83
B 1011 29 id=83
B 1012 29 id=83
B 1012 28 id=83
B 1013 29 id=83
B 1014 29 id=83
B 1013 30 id=83
B 1014 30 id=83
B 1012 30 id=83
B 1011 30 id=83
B 1010 29 id=83
B 1009 29 id=83
B 1008 29 id=83
B 1008 28 id=83
S 1008 27 rot=180 id=8
S 1010 27 rot=180 id=8
S 1011 27 rot=180 id=8
S 1012 27 rot=180 id=8
S 1013 28 rot=180 id=8
S 1014 28 rot=180 id=8
S 1009 26 rot=180 id=8
S 1007 28 rot=270 id=8
S 1007 29 rot=270 id=8
S 1008 30 id=8
S 1009 30 id=8
S 1010 30 id=8
S 1011 31 id=8
S 1012 31 id=8
S 1013 31 id=8
S 1014 31 id=8
S 1015 30 rot=90 id=8
S 1015 29 rot=90 id=8
W 1017.319 28.219 2.361 4.562 id=1705 z=5
W 1021.767 18.083 1.467 2.833 id=1705 z=5
B 1025 19 id=83
B 1026 20 id=83
B 1025 20 id=83
B 1026 19 id=83
B 1027 19 id=83
B 1027 20 id=83
B 1024 19 id=83
B 1025 18 id=83
B 1026 18 id=83
B 1027 18 id=83
B 1020 20 id=83
B 1019 20 id=83
B 1019 19 id=83
S 1019 18 rot=180 id=8
S 1025 17 rot=180 id=8
S 1026 17 rot=180 id=8
S 1027 17 rot=180 id=8
S 1024 18 rot=180 id=8
S 1028 18 rot=90 id=8
S 1028 19 rot=90 id=8
S 1028 20 rot=90 id=8
S 1024 20 id=8
S 1025 21 id=8
S 1026 21 id=8
S 1027 21 id=8
W 1029.767 19.083 1.467 2.833 id=1705 z=5
W 1033.033 16.667 2.933 5.667 id=1705 z=5
B 1026 27 id=83
B 1025 27 id=83
B 1026 29 id=83
B 1025 28 id=83
B 1026 28 id=83
B 1028 29 id=83
B 1027 28 id=83
B 1027 29 id=83
B 1026 30 id=83
B 1027 30 id=83
B 1030 28 id=83
S 1025 26 rot=180 id=8
S 1026 26 rot=180 id=8
S 1027 27 rot=180 id=8
S 1028 28 rot=180 id=8
S 1031 28 rot=90 id=8
S 1030 29 id=8
S 1030 27 rot=180 id=8
W 1033.033 26.667 2.933 5.667 id=1705 z=5
W 1038.033 14.667 2.933 5.667 id=1705 z=5
W 1037.767 29.083 1.467 2.833 id=1705 z=5
W 1041.767 18.083 1.467 2.833 id=1705 z=5
W 1036.5 20.5 2 2 id=1706 z=5
W 1038.62 19.62 3.76 3.76 id=1706 z=5
W 1041.033 27.667 2.933 5.667 id=1705 z=5
B 1045 28 id=83
B 1046 29 id=83
B 1045 29 id=83
B 1046 30 id=83
B 1045 30 id=83
B 1047 29 id=83
B 1046 28 id=83
B 1047 28 id=83
B 1047 30 id=83
B 1046 31 id=83
B 1043 27 id=83
B 1045 21 id=83
B 1044 20 id=83
B 1045 19 id=83
B 1046 20 id=83
B 1046 21 id=83
B 1045 20 id=83
B 1046 19 id=83
B 1047 20 id=83
B 1047 19 id=83
B 1047 18 id=83
B 1045 18 id=83
B 1044 18 id=83
B 1046 18 id=83
B 1047 21 id=83
B 1048 21 id=83
B 1048 20 id=83
B 1050 21 id=83
S 1045 22 id=8
S 1046 22 id=8
S 1047 22 id=8
S 1048 22 id=8
S 1050 22 id=8
S 1051 21 rot=90 id=8
S 1050 20 rot=180 id=8
S 1043 26 rot=180 id=8
S 1042 27 rot=270 id=8
S 1045 27 rot=180 id=8
S 1046 27 rot=180 id=8
S 1047 27 rot=180 id=8
S 1048 28 rot=90 id=8
S 1048 29 rot=90 id=8
S 1048 30 rot=90 id=8
S 1044 21 id=8
R 1054 25 to=cube id=12 z=2
W 1050.4 27.375 2.2 4.25 id=1705 z=5
W 1052.385 19.347 2.229 4.307 id=1705 z=5
W 1053.767 29.083 1.467 2.833 id=1705 z=5
W 1048.767 30.083 1.467 2.833 id=1705 z=5
B 1056 21 id=83
B 1057 21 id=83
B 1058 21 id=83
B 1057 20 id=83
B 1058 20 id=83
B 1059 21 id=83
B 1059 20 id=83
B 1060 20 id=83
B 1060 21 id=83
B 1061 20 id=83
B 1061 21 id=83
B 1062 21 id=83
B 1062 20 id=83
B 1063 21 id=83
B 1063 20 id=83
B 1064 21 id=83
B 1064 20 id=83
B 1065 21 id=83
B 1065 20 id=83
B 1066 21 id=83
C 1059 22 id=2063
V 1055 25 spd=2 id=202 z=2
R 1060 23 to=robot id=745 z=2
O 1068 23 orb=yellow id=36 z=2
O 1073 25 orb=pink id=141 col=13017343 z=2
B 1078 23 id=83
B 1078 22 id=83
B 1078 21 id=83
D 1078 24 1 0.2 pad=blue id=67 z=2
B 1080 28 id=83
A 1083 25 rot=-45 ar=pink id=1751 z=2
D 1080 27.833 1 0.2 pad=pink rot=180 id=140 z=2
B 1088 28 id=83
B 1089 29 id=83
B 1089 28 id=83
B 1090 29 id=83
B 1090 28 id=83
B 1091 29 id=83
B 1092 28 id=83
B 1091 28 id=83
B 1092 29 id=83
B 1093 28 id=83
B 1093 29 id=83
B 1094 28 id=83
E 1090 30.65 art=41 id=41 z=6
E 1092 30.65 art=41 id=41 z=6
E 1080 29.65 art=41 id=41 z=6
O 1097 32 orb=yellow id=36 z=2
O 1102 32 orb=green id=1022 z=2
B 1107 32 id=83
B 1108 32 id=83
B 1106 32 id=83
B 1107 33 id=83
E 1107 30.417 rot=180 art=106 id=106 z=7
O 1112 30 orb=pink id=141 col=13017343 z=2
D 1117 31.8 1 0.2 pad=blue rot=180 id=67 z=2
D 1118 28 1 0.2 pad=blue id=67 z=2
D 1120 30.8 1 0.2 pad=blue rot=180 id=67 z=2
R 1121 29 to=ball id=47 z=2
B 1117 32 id=83
B 1117 33 id=83
B 1120 32 id=83
B 1120 31 id=83
B 1120 33 id=83
B 1118 27 id=83
B 1118 26 id=83
B 1118 25 id=83
B 1118 24 id=83
H 1122 26 fm=corner id=469
H 1122.002 25 0.05 1 rot=-90 fm=edge id=468
H 1122.002 24 0.05 1 rot=-90 fm=edge id=468
H 1123 26.95 1 0.05 fm=edge id=468
H 1124 26.95 1 0.05 fm=edge id=468
H 1125 26.95 1 0.05 fm=edge id=468
H 1126 26.95 1 0.05 fm=edge id=468
H 1127 26.95 1 0.05 fm=edge id=468
H 1128 26.95 1 0.05 fm=edge id=468
H 1129 26.95 1 0.05 fm=edge id=468
H 1130 26.95 1 0.05 fm=edge id=468
H 1131 26.95 1 0.05 fm=edge id=468
H 1132 26.95 1 0.05 fm=edge id=468
H 1123 30 rot=-90 fm=corner id=469
H 1123.002 31 0.05 1 rot=-90 fm=edge id=468
H 1123.002 32 0.05 1 rot=-90 fm=edge id=468
H 1123.002 33 0.05 1 rot=-90 fm=edge id=468
H 1124 30 1 0.05 rot=-180 fm=edge id=468
H 1125 30 1 0.05 rot=-180 fm=edge id=468
H 1126 30 1 0.05 rot=-180 fm=edge id=468
H 1127 30 1 0.05 rot=-180 fm=edge id=468
X 1127 29 id=143
X 1127 28 id=143
X 1127 27 id=143
H 1128 30 rot=-180 fm=corner id=469
H 1129 31 rot=-180 fm=corner id=469
H 1130 32 rot=-180 fm=corner id=469
S 1129 30 rot=180 id=8
S 1130 31 rot=180 id=8
S 1131 32 rot=180 id=8
S 1132 27 id=8
H 1130 29 1 0.5 fm=box id=662
H 1131 29 1 0.5 fm=box id=662
H 1132 29 1 0.5 fm=box id=662
H 1133 29 1 0.5 fm=box id=662
H 1134 29 1 0.5 fm=box id=662
H 1135 29 1 0.5 fm=box id=662
S 1136 28 rot=180 id=8
H 1136 29 1 0.5 fm=box id=662
H 1137 29 1 0.5 fm=box id=662
H 1133 26 rot=90 fm=corner id=469
H 1135 24.95 1 0.05 fm=edge id=468
H 1136 24.95 1 0.05 fm=edge id=468
H 1137 24.95 1 0.05 fm=edge id=468
H 1138 24.95 1 0.05 fm=edge id=468
H 1139 24.95 1 0.05 fm=edge id=468
H 1140 24.95 1 0.05 fm=edge id=468
H 1134 25 rot=90 fm=corner id=469
S 1133 27 id=8
S 1134 26 id=8
S 1135 25 id=8
H 1138 32 rot=-90 fm=corner id=469
H 1139 31 rot=180 fm=u id=470
H 1140 32 rot=180 fm=corner id=469
S 1137 32 rot=180 id=8
S 1138 31 rot=180 id=8
S 1139 30 rot=180 id=8
S 1140 31 rot=180 id=8
S 1141 32 rot=180 id=8
S 1132 32 rot=180 id=8
S 1133 32 rot=180 id=8
S 1134 32 rot=180 id=8
S 1135 32 rot=180 id=8
S 1136 32 rot=180 id=8
S 1142 32 rot=180 id=8
S 1141 25 id=8
H 1149 29 1 0.5 fm=box id=662
D 1144 32.8 1 0.2 pad=blue rot=180 id=67 z=2
D 1145 31 1 0.2 pad=blue id=67 z=2
S 1149 32 rot=180 id=8
D 1148 32.8 1 0.2 pad=blue rot=180 id=67 z=2
H 1150 29 1 0.5 fm=box id=662
H 1151 29 1 0.5 fm=box id=662
H 1152 29 1 0.5 fm=box id=662
H 1142 25 fm=corner id=469
H 1143 26 fm=corner id=469
H 1144 26.95 1 0.05 fm=edge id=468
H 1145 26.95 1 0.05 fm=edge id=468
H 1146 26.95 1 0.05 fm=edge id=468
H 1147 26.95 1 0.05 fm=edge id=468
H 1148 26.95 1 0.05 fm=edge id=468
H 1149 26.95 1 0.05 fm=edge id=468
H 1150 26.95 1 0.05 fm=edge id=468
H 1151 26.95 1 0.05 fm=edge id=468
H 1152 26.95 1 0.05 fm=edge id=468
S 1142 26 id=8
S 1143 27 id=8
S 1144 27 id=8
S 1145 27 id=8
S 1146 27 id=8
S 1147 27 id=8
S 1148 27 id=8
S 1149 27 id=8
S 1150 27 id=8
S 1151 27 id=8
S 1152 27 id=8
H 1153 29 1 0.5 fm=box id=662
H 1154 29 1 0.5 fm=box id=662
S 1154 29.5 id=8
H 1153 26.95 1 0.05 fm=edge id=468
H 1154 26.95 1 0.05 fm=edge id=468
H 1155 26.95 1 0.05 fm=edge id=468
H 1156 26.95 1 0.05 fm=edge id=468
S 1150 32 rot=180 id=8
S 1151 32 rot=180 id=8
S 1153 27 id=8
S 1154 27 id=8
S 1155 27 id=8
S 1156 27 id=8
H 1157 26 rot=90 fm=corner id=469
H 1158 25 rot=90 fm=corner id=469
H 1159 25 1 0.05 rot=180 fm=edge id=468
H 1160 25 1 0.05 rot=180 fm=edge id=468
H 1161 25 1 0.05 rot=180 fm=edge id=468
H 1162 25 1 0.05 rot=180 fm=edge id=468
H 1163 25 1 0.05 rot=180 fm=edge id=468
H 1164 25 1 0.05 rot=180 fm=edge id=468
H 1165 25 1 0.05 rot=180 fm=edge id=468
H 1166 25 1 0.05 rot=180 fm=edge id=468
H 1167 25 1 0.05 rot=180 fm=edge id=468
S 1157 27 id=8
S 1158 26 id=8
S 1159 25 id=8
O 1180 31 orb=blue id=84 z=2
W 1179.767 32.083 1.467 2.833 id=1705 z=5
W 1174.033 29.667 2.933 5.667 id=1705 z=5
W 1169.033 23.667 2.933 5.667 id=1705 z=5
W 1179.209 23.007 2.581 4.987 id=1705 z=5
W 1162.033 28.667 2.933 5.667 id=1705 z=5
A 1184 25 rot=315 ar=pink id=1751 z=2
V 1120 29 spd=2 id=202 z=2
W 1186.767 25.083 1.467 2.833 id=1705 z=5
W 1190.033 24.667 2.933 5.667 id=1705 z=5
W 1183.033 28.667 2.933 5.667 id=1705 z=5
D 1189 32.8 1 0.2 pad=blue rot=180 id=67 z=2
D 1193 32.8 1 0.2 pad=blue rot=180 id=67 z=2
D 1194 31 1 0.2 pad=blue id=67 z=2
D 1190 31 1 0.2 pad=blue id=67 z=2
H 1190 30.5 1 0.5 fm=box id=662
H 1194 30.5 1 0.5 fm=box id=662
R 1196 31 to=cube id=12 z=2
G 1199 37 gd=1 id=10 z=2
D 1204 31.967 1 0.2 pad=yellow id=35 z=2
H 1204 31.5 1 0.5 fm=box id=662
O 1209 36 orb=green id=1022 z=2
K 1211 34 inert=1 id=286 z=2
H 1211 39 rot=-90 fm=corner id=469
H 1211.002 40 0.05 1 rot=-90 fm=edge id=468
H 1211.002 41 0.05 1 rot=-90 fm=edge id=468
H 1211.002 42 0.05 1 rot=-90 fm=edge id=468
H 1212 39 1 0.05 rot=-180 fm=edge id=468
H 1213 39 1 0.05 rot=-180 fm=edge id=468
H 1214 39 1 0.05 rot=-180 fm=edge id=468
H 1216 39 1 0.05 rot=-180 fm=edge id=468
H 1217 39 1 0.05 rot=-180 fm=edge id=468
H 1215 39 1 0.05 rot=-180 fm=edge id=468
H 1218 39 1 0.05 rot=-180 fm=edge id=468
H 1219 39 1 0.05 rot=-180 fm=edge id=468
H 1220 39 1 0.05 rot=-180 fm=edge id=468
H 1221 39 1 0.05 rot=-180 fm=edge id=468
H 1222 39 1 0.05 rot=-180 fm=edge id=468
H 1212 29.95 1 0.05 fm=edge id=468
H 1213 29.95 1 0.05 fm=edge id=468
H 1214 29.95 1 0.05 fm=edge id=468
H 1215 29.95 1 0.05 fm=edge id=468
H 1216 29.95 1 0.05 fm=edge id=468
H 1217 29.95 1 0.05 fm=edge id=468
H 1218 29.95 1 0.05 fm=edge id=468
H 1219 29.95 1 0.05 fm=edge id=468
H 1220 29.95 1 0.05 fm=edge id=468
H 1221 29.95 1 0.05 fm=edge id=468
H 1222 29.95 1 0.05 fm=edge id=468
H 1224 29.95 1 0.05 fm=edge id=468
H 1225 29.95 1 0.05 fm=edge id=468
H 1226 29.95 1 0.05 fm=edge id=468
H 1227 29.95 1 0.05 fm=edge id=468
H 1223 29.95 1 0.05 fm=edge id=468
H 1211 29 fm=corner id=469
H 1211.002 28 0.05 1 rot=-90 fm=edge id=468
H 1211.002 27 0.05 1 rot=-90 fm=edge id=468
H 1211.002 26 0.05 1 rot=-90 fm=edge id=468
H 1211.002 25 0.05 1 rot=-90 fm=edge id=468
H 1215 31 fm=corner id=469
H 1215 37 rot=-90 fm=corner id=469
H 1217 31 rot=-270 fm=corner id=469
H 1217 37 rot=-180 fm=corner id=469
H 1216 31.95 1 0.05 fm=edge id=468
H 1215.002 30 0.05 1 rot=-90 fm=edge id=468
H 1217.948 30 0.05 1 rot=90 fm=edge id=468
H 1217.948 38 0.05 1 rot=90 fm=edge id=468
H 1215.002 38 0.05 1 rot=270 fm=edge id=468
H 1216 37 1 0.05 rot=180 fm=edge id=468
O 1219 34 orb=black id=1330 z=2
S 1218 37 rot=90 id=8
S 1218 38 rot=90 id=8
S 1218 31 rot=90 id=8
S 1218 30 rot=90 id=8
W 1221.767 33.083 1.467 2.833 id=1705 z=5
H 1225 37 rot=-90 fm=corner id=469
H 1227 37 rot=180 fm=corner id=469
H 1225 31 fm=corner id=469
H 1227 31 rot=90 fm=corner id=469
H 1226 31.95 1 0.05 fm=edge id=468
H 1227.948 38 0.05 1 rot=90 fm=edge id=468
H 1225.002 38 0.05 1 rot=-90 fm=edge id=468
H 1226 37 1 0.05 rot=-180 fm=edge id=468
H 1225.002 30 0.05 1 rot=-90 fm=edge id=468
H 1227.948 30 0.05 1 rot=-270 fm=edge id=468
O 1228 34 orb=pink id=141 col=13017343 z=2
S 1228 38 rot=180 id=8
S 1229 38 rot=180 id=8
S 1230 38 rot=180 id=8
S 1231 38 rot=180 id=8
S 1233 38 rot=180 id=8
S 1232 38 rot=180 id=8
S 1228 30 id=8
S 1229 30 id=8
S 1230 30 id=8
S 1231 30 id=8
S 1232 30 id=8
S 1233 30 id=8
S 1234 30 id=8
O 1233 32 orb=pink id=141 col=13017343 z=2
O 1233 36 orb=pink id=141 col=13017343 z=2
S 1234 38 rot=180 id=8
S 1235 38 rot=180 id=8
S 1235 30 id=8
S 1239 38 rot=180 id=8
S 1239 30 id=8
S 1240 30 id=8
S 1240 38 rot=180 id=8
O 1248 34 orb=pink id=141 col=13017343 z=2
H 1245 31.5 1 0.5 fm=box id=662
H 1245 37 1 0.5 fm=box id=662
W 1247.473 36.517 2.053 3.967 id=1705 z=5
W 1255.459 36.488 2.083 4.023 id=1705 z=5
W 1251.473 36.517 2.053 3.967 id=1705 z=5
W 1247.466 28.503 2.068 3.995 id=1705 z=5
W 1251.437 28.446 2.127 4.108 id=1705 z=5
W 1255.422 28.418 2.156 4.165 id=1705 z=5
K 1258 34 inert=1 id=287 z=2
D 1260 32 1 0.2 pad=blue id=67 z=2
D 1262 36.8 1 0.2 pad=blue rot=180 id=67 z=2
D 1263 32 1 0.2 pad=blue id=67 z=2
D 1265 36.8 1 0.2 pad=blue rot=-180 id=67 z=2
H 1261 37 rot=-90 fm=corner id=469
H 1266 37 rot=-180 fm=corner id=469
H 1264 31 rot=-270 fm=corner id=469
H 1259 31 fm=corner id=469
H 1260 31.95 1 0.05 fm=edge id=468
H 1261 31.95 1 0.05 fm=edge id=468
H 1262 31.95 1 0.05 fm=edge id=468
H 1263 31.95 1 0.05 fm=edge id=468
H 1264.948 30 0.05 1 rot=90 fm=edge id=468
H 1264.948 29 0.05 1 rot=90 fm=edge id=468
H 1264.948 28 0.05 1 rot=90 fm=edge id=468
H 1264.948 27 0.05 1 rot=90 fm=edge id=468
H 1259.002 30 0.05 1 rot=270 fm=edge id=468
H 1259.002 29 0.05 1 rot=270 fm=edge id=468
H 1259.002 28 0.05 1 rot=270 fm=edge id=468
H 1259.002 27 0.05 1 rot=270 fm=edge id=468
H 1259.002 26 0.05 1 rot=270 fm=edge id=468
H 1264.948 26 0.05 1 rot=90 fm=edge id=468
H 1262 37 1 0.05 rot=180 fm=edge id=468
H 1264 37 1 0.05 rot=180 fm=edge id=468
H 1263 37 1 0.05 rot=180 fm=edge id=468
H 1265 37 1 0.05 rot=180 fm=edge id=468
H 1261.002 38 0.05 1 rot=270 fm=edge id=468
H 1261.002 39 0.05 1 rot=270 fm=edge id=468
H 1261.002 40 0.05 1 rot=270 fm=edge id=468
H 1261.002 41 0.05 1 rot=270 fm=edge id=468
H 1266.948 38 0.05 1 rot=90 fm=edge id=468
H 1266.948 39 0.05 1 rot=90 fm=edge id=468
H 1266.948 40 0.05 1 rot=90 fm=edge id=468
H 1266.948 41 0.05 1 rot=90 fm=edge id=468
H 1267 31 fm=corner id=469
H 1268 31.95 1 0.05 fm=edge id=468
H 1269 31.95 1 0.05 fm=edge id=468
H 1270 31.95 1 0.05 fm=edge id=468
H 1271 31.95 1 0.05 fm=edge id=468
H 1267.002 30 0.05 1 rot=-90 fm=edge id=468
H 1267.002 29 0.05 1 rot=-90 fm=edge id=468
H 1267.002 28 0.05 1 rot=-90 fm=edge id=468
H 1267.002 27 0.05 1 rot=-90 fm=edge id=468
H 1267.002 26 0.05 1 rot=-90 fm=edge id=468
R 1268 33 to=spider id=1331 z=2
H 1272 31.95 1 0.05 fm=edge id=468
H 1273 31.95 1 0.05 fm=edge id=468
H 1274 31 rot=90 fm=corner id=469
H 1274.948 30 0.05 1 rot=90 fm=edge id=468
H 1274.948 28 0.05 1 rot=90 fm=edge id=468
H 1274.948 29 0.05 1 rot=90 fm=edge id=468
H 1274.948 27 0.05 1 rot=90 fm=edge id=468
H 1274.948 26 0.05 1 rot=90 fm=edge id=468
H 1274 37 rot=-90 fm=corner id=469
H 1277 37 rot=-180 fm=corner id=469
H 1276 37 1 0.05 rot=180 fm=edge id=468
H 1275 37 1 0.05 rot=180 fm=edge id=468
H 1274.002 38 0.05 1 rot=270 fm=edge id=468
H 1274.002 39 0.05 1 rot=270 fm=edge id=468
H 1274.002 40 0.05 1 rot=270 fm=edge id=468
H 1274.002 41 0.05 1 rot=270 fm=edge id=468
H 1274.002 42 0.05 1 rot=270 fm=edge id=468
H 1261.002 42 0.05 1 rot=270 fm=edge id=468
H 1266.948 42 0.05 1 rot=90 fm=edge id=468
H 1277.948 38 0.05 1 rot=90 fm=edge id=468
H 1277.948 40 0.05 1 rot=90 fm=edge id=468
H 1277.948 41 0.05 1 rot=90 fm=edge id=468
H 1277.948 42 0.05 1 rot=90 fm=edge id=468
H 1277.948 39 0.05 1 rot=90 fm=edge id=468
H 1277 31 fm=corner id=469
H 1277.002 30 0.05 1 rot=-90 fm=edge id=468
H 1277.002 29 0.05 1 rot=-90 fm=edge id=468
H 1277.002 28 0.05 1 rot=-90 fm=edge id=468
H 1277.002 27 0.05 1 rot=-90 fm=edge id=468
H 1277.002 26 0.05 1 rot=-90 fm=edge id=468
H 1278 31.95 1 0.05 fm=edge id=468
H 1279 31.95 1 0.05 fm=edge id=468
H 1280 31.95 1 0.05 fm=edge id=468
H 1281 31 rot=90 fm=corner id=469
H 1281.948 29 0.05 1 rot=90 fm=edge id=468
H 1281.948 30 0.05 1 rot=90 fm=edge id=468
H 1281.948 28 0.05 1 rot=90 fm=edge id=468
H 1281.948 27 0.05 1 rot=90 fm=edge id=468
H 1281.948 26 0.05 1 rot=90 fm=edge id=468
H 1281 37 rot=-90 fm=corner id=469
H 1281.002 38 0.05 1 rot=-90 fm=edge id=468
H 1281.002 39 0.05 1 rot=-90 fm=edge id=468
H 1281.002 41 0.05 1 rot=-90 fm=edge id=468
H 1281.002 40 0.05 1 rot=-90 fm=edge id=468
H 1281.002 42 0.05 1 rot=-90 fm=edge id=468
H 1282 37 1 0.05 rot=180 fm=edge id=468
H 1283 37 1 0.05 rot=180 fm=edge id=468
H 1284 37 rot=180 fm=corner id=469
H 1284.948 38 0.05 1 rot=90 fm=edge id=468
H 1284.948 39 0.05 1 rot=90 fm=edge id=468
H 1284.948 40 0.05 1 rot=90 fm=edge id=468
H 1284.948 41 0.05 1 rot=90 fm=edge id=468
H 1284.948 42 0.05 1 rot=90 fm=edge id=468
H 1284 31 fm=corner id=469
H 1284.002 29 0.05 1 rot=-90 fm=edge id=468
H 1284.002 28 0.05 1 rot=-90 fm=edge id=468
H 1284.002 30 0.05 1 rot=-90 fm=edge id=468
H 1284.002 27 0.05 1 rot=-90 fm=edge id=468
H 1284.002 26 0.05 1 rot=-90 fm=edge id=468
H 1285 31.95 1 0.05 fm=edge id=468
H 1286 31 rot=90 fm=corner id=469
H 1286.948 29 0.05 1 rot=90 fm=edge id=468
H 1286.948 30 0.05 1 rot=90 fm=edge id=468
H 1286.948 28 0.05 1 rot=90 fm=edge id=468
H 1286.948 27 0.05 1 rot=90 fm=edge id=468
H 1286.948 26 0.05 1 rot=90 fm=edge id=468
H 1286 37 rot=-90 fm=corner id=469
H 1286.002 38 0.05 1 rot=-90 fm=edge id=468
H 1286.002 39 0.05 1 rot=-90 fm=edge id=468
H 1286.002 40 0.05 1 rot=-90 fm=edge id=468
H 1286.002 41 0.05 1 rot=-90 fm=edge id=468
H 1286.002 42 0.05 1 rot=-90 fm=edge id=468
H 1287 37 1 0.05 rot=-180 fm=edge id=468
H 1288 37 1 0.05 rot=-180 fm=edge id=468
H 1289 37 1 0.05 rot=-180 fm=edge id=468
H 1290 37 1 0.05 rot=-180 fm=edge id=468
H 1291 37 rot=-180 fm=corner id=469
H 1291.948 38 0.05 1 rot=90 fm=edge id=468
H 1291.948 39 0.05 1 rot=90 fm=edge id=468
H 1291.948 40 0.05 1 rot=90 fm=edge id=468
H 1291.948 41 0.05 1 rot=90 fm=edge id=468
H 1291.948 42 0.05 1 rot=90 fm=edge id=468
H 1291 31 fm=corner id=469
H 1291.002 30 0.05 1 rot=-90 fm=edge id=468
H 1291.002 29 0.05 1 rot=-90 fm=edge id=468
H 1291.002 28 0.05 1 rot=-90 fm=edge id=468
H 1291.002 27 0.05 1 rot=-90 fm=edge id=468
H 1291.002 26 0.05 1 rot=-90 fm=edge id=468
H 1292 31.95 1 0.05 fm=edge id=468
H 1293 37 rot=270 fm=corner id=469
H 1293.002 39 0.05 1 rot=-90 fm=edge id=468
H 1293.002 38 0.05 1 rot=-90 fm=edge id=468
H 1293.002 40 0.05 1 rot=-90 fm=edge id=468
H 1293.002 41 0.05 1 rot=-90 fm=edge id=468
H 1293.002 42 0.05 1 rot=-90 fm=edge id=468
H 1294 37 1 0.05 rot=-180 fm=edge id=468
H 1295 37 1 0.05 rot=-180 fm=edge id=468
H 1296 37 1 0.05 rot=-180 fm=edge id=468
H 1297 37 1 0.05 rot=-180 fm=edge id=468
H 1298 37 rot=-180 fm=corner id=469
H 1298.948 38 0.05 1 rot=90 fm=edge id=468
H 1298.948 39 0.05 1 rot=90 fm=edge id=468
H 1298.948 40 0.05 1 rot=90 fm=edge id=468
H 1298.948 41 0.05 1 rot=90 fm=edge id=468
H 1298.948 42 0.05 1 rot=90 fm=edge id=468
H 1298 31 fm=corner id=469
H 1301 31 rot=90 fm=corner id=469
H 1300 31.95 1 0.05 fm=edge id=468
H 1299 31.95 1 0.05 fm=edge id=468
H 1298.002 30 0.05 1 rot=-90 fm=edge id=468
H 1298.002 29 0.05 1 rot=-90 fm=edge id=468
H 1298.002 28 0.05 1 rot=-90 fm=edge id=468
H 1298.002 26 0.05 1 rot=-90 fm=edge id=468
H 1298.002 27 0.05 1 rot=-90 fm=edge id=468
H 1301.948 30 0.05 1 rot=90 fm=edge id=468
H 1301.948 29 0.05 1 rot=90 fm=edge id=468
H 1301.948 28 0.05 1 rot=90 fm=edge id=468
H 1301.948 27 0.05 1 rot=90 fm=edge id=468
H 1301.948 26 0.05 1 rot=90 fm=edge id=468
H 1301 37 rot=-90 fm=corner id=469
H 1301.002 38 0.05 1 rot=-90 fm=edge id=468
H 1301.002 39 0.05 1 rot=-90 fm=edge id=468
H 1301.002 40 0.05 1 rot=-90 fm=edge id=468
H 1301.002 42 0.05 1 rot=-90 fm=edge id=468
H 1301.002 41 0.05 1 rot=-90 fm=edge id=468
H 1302 37 1 0.05 rot=180 fm=edge id=468
H 1303 37 1 0.05 rot=180 fm=edge id=468
H 1304 37 1 0.05 rot=180 fm=edge id=468
H 1305 37 1 0.05 rot=180 fm=edge id=468
H 1306 37 rot=-180 fm=corner id=469
H 1306.948 38 0.05 1 rot=90 fm=edge id=468
H 1306.948 39 0.05 1 rot=90 fm=edge id=468
H 1306.948 40 0.05 1 rot=90 fm=edge id=468
H 1306.948 41 0.05 1 rot=90 fm=edge id=468
H 1306.948 42 0.05 1 rot=90 fm=edge id=468
H 1306 31 fm=corner id=469
H 1308 31 rot=90 fm=corner id=469
H 1307 31.95 1 0.05 fm=edge id=468
H 1306.002 30 0.05 1 rot=-90 fm=edge id=468
H 1306.002 29 0.05 1 rot=-90 fm=edge id=468
H 1306.002 27 0.05 1 rot=-90 fm=edge id=468
H 1306.002 26 0.05 1 rot=-90 fm=edge id=468
H 1306.002 28 0.05 1 rot=-90 fm=edge id=468
H 1308.948 30 0.05 1 rot=90 fm=edge id=468
H 1308.948 28 0.05 1 rot=90 fm=edge id=468
H 1308.948 27 0.05 1 rot=90 fm=edge id=468
H 1308.948 26 0.05 1 rot=90 fm=edge id=468
H 1308.948 29 0.05 1 rot=90 fm=edge id=468
H 1308 37 rot=-90 fm=corner id=469
H 1308.002 38 0.05 1 rot=-90 fm=edge id=468
H 1308.002 39 0.05 1 rot=-90 fm=edge id=468
H 1308.002 40 0.05 1 rot=-90 fm=edge id=468
H 1308.002 42 0.05 1 rot=-90 fm=edge id=468
H 1308.002 41 0.05 1 rot=-90 fm=edge id=468
H 1311 37 rot=180 fm=corner id=469
H 1310 37 1 0.05 rot=180 fm=edge id=468
H 1309 37 1 0.05 rot=180 fm=edge id=468
H 1311.948 38 0.05 1 rot=90 fm=edge id=468
H 1311.948 39 0.05 1 rot=90 fm=edge id=468
H 1311.948 41 0.05 1 rot=90 fm=edge id=468
H 1311.948 42 0.05 1 rot=90 fm=edge id=468
H 1311.948 40 0.05 1 rot=90 fm=edge id=468
H 1311 31 fm=corner id=469
H 1311.002 29 0.05 1 rot=-90 fm=edge id=468
H 1311.002 30 0.05 1 rot=-90 fm=edge id=468
H 1311.002 28 0.05 1 rot=-90 fm=edge id=468
H 1311.002 27 0.05 1 rot=-90 fm=edge id=468
H 1311.002 26 0.05 1 rot=-90 fm=edge id=468
H 1312 31.95 1 0.05 fm=edge id=468
H 1313 31.95 1 0.05 fm=edge id=468
H 1314 31.95 1 0.05 fm=edge id=468
H 1315 31 rot=90 fm=corner id=469
H 1315.948 30 0.05 1 rot=90 fm=edge id=468
H 1315.948 29 0.05 1 rot=90 fm=edge id=468
H 1315.948 28 0.05 1 rot=90 fm=edge id=468
H 1315.948 27 0.05 1 rot=90 fm=edge id=468
H 1315.948 26 0.05 1 rot=90 fm=edge id=468
H 1315 37 rot=-90 fm=corner id=469
H 1315.002 38 0.05 1 rot=-90 fm=edge id=468
H 1315.002 39 0.05 1 rot=-90 fm=edge id=468
H 1315.002 40 0.05 1 rot=-90 fm=edge id=468
H 1315.002 41 0.05 1 rot=-90 fm=edge id=468
H 1315.002 42 0.05 1 rot=-90 fm=edge id=468
H 1316 37 1 0.05 rot=-180 fm=edge id=468
H 1317 37 1 0.05 rot=-180 fm=edge id=468
H 1318 37 rot=-180 fm=corner id=469
H 1318.948 38 0.05 1 rot=-270 fm=edge id=468
H 1318.948 39 0.05 1 rot=-270 fm=edge id=468
H 1318.948 40 0.05 1 rot=-270 fm=edge id=468
H 1318.948 41 0.05 1 rot=-270 fm=edge id=468
H 1318.948 42 0.05 1 rot=-270 fm=edge id=468
H 1318 31 fm=corner id=469
H 1318.002 30 0.05 1 rot=-90 fm=edge id=468
H 1318.002 28 0.05 1 rot=-90 fm=edge id=468
H 1318.002 27 0.05 1 rot=-90 fm=edge id=468
H 1318.002 29 0.05 1 rot=-90 fm=edge id=468
H 1318.002 26 0.05 1 rot=-90 fm=edge id=468
H 1319 31.95 1 0.05 fm=edge id=468
H 1320 31.95 1 0.05 fm=edge id=468
H 1321 31.95 1 0.05 fm=edge id=468
A 1252 34 ar=pink id=1751 z=2
H 1322 31 rot=90 fm=corner id=469
H 1322.948 30 0.05 1 rot=90 fm=edge id=468
H 1322.948 28 0.05 1 rot=90 fm=edge id=468
H 1322.948 29 0.05 1 rot=90 fm=edge id=468
H 1322.948 27 0.05 1 rot=90 fm=edge id=468
H 1322.948 26 0.05 1 rot=90 fm=edge id=468
R 1322 33 to=cube id=12 z=2
H 1325 30 fm=corner id=469
H 1294 31 rot=-270 fm=corner id=469
H 1293 31.95 1 0.05 fm=edge id=468
H 1294.948 30 0.05 1 rot=90 fm=edge id=468
H 1294.948 29 0.05 1 rot=90 fm=edge id=468
H 1294.948 28 0.05 1 rot=90 fm=edge id=468
H 1294.948 27 0.05 1 rot=90 fm=edge id=468
H 1294.948 26 0.05 1 rot=90 fm=edge id=468
V 1325 32 spd=0 id=200 z=2
H 1326 30 rot=90 fm=corner id=469
H 1325.002 29 0.05 1 rot=-90 fm=edge id=468
H 1325.002 28 0.05 1 rot=-90 fm=edge id=468
H 1325.002 27 0.05 1 rot=-90 fm=edge id=468
H 1325.002 26 0.05 1 rot=-90 fm=edge id=468
H 1325.002 25 0.05 1 rot=-90 fm=edge id=468
H 1325.002 24 0.05 1 rot=-90 fm=edge id=468
H 1326.948 29 0.05 1 rot=90 fm=edge id=468
H 1326.948 28 0.05 1 rot=90 fm=edge id=468
H 1326.948 27 0.05 1 rot=90 fm=edge id=468
H 1326.948 26 0.05 1 rot=90 fm=edge id=468
H 1326.948 25 0.05 1 rot=90 fm=edge id=468
H 1326.948 24 0.05 1 rot=90 fm=edge id=468
H 1322.948 25 0.05 1 rot=90 fm=edge id=468
H 1322.948 24 0.05 1 rot=90 fm=edge id=468
H 1318.002 25 0.05 1 rot=-90 fm=edge id=468
H 1318.002 24 0.05 1 rot=-90 fm=edge id=468
H 1335.5 29.5 1 0.5 fm=box id=662
H 1339 29.5 1 0.5 fm=box id=662
H 1328 30.5 0.5 0.5 fm=corner id=661
H 1329.5 30 0.5 0.5 fm=corner id=661
H 1331 29.5 1 0.5 fm=box id=662
O 1343 30 orb=yellow id=36 z=2
R 1345 32 to=ship id=13 z=2
V 1351 28 spd=1 id=201 z=2
V 1359 28 spd=2 id=202 z=2
V 1368 28 spd=3 id=203 z=2
V 1377 28 spd=4 id=1334 z=2
C 1344 32 id=2063
W 1359.481 28.531 2.039 3.938 id=1705 z=5
W 1355.033 28.667 2.933 5.667 id=1705 z=5
W 1363.033 29.667 2.933 5.667 id=1705 z=5
W 1369.033 28.667 2.933 5.667 id=1705 z=5
W 1375.033 29.667 2.933 5.667 id=1705 z=5
W 1351.481 29.531 2.039 3.938 id=1705 z=5
W 1366.767 29.083 1.467 2.833 id=1705 z=5
W 1371.033 32.667 2.933 5.667 id=1705 z=5
W 1366.033 33.667 2.933 5.667 id=1705 z=5
W 1348.033 31.667 2.933 5.667 id=1705 z=5
W 1344.033 34.667 2.933 5.667 id=1705 z=5
W 1369.767 37.083 1.467 2.833 id=1705 z=5
W 1375.767 35.083 1.467 2.833 id=1705 z=5
W 1379.767 29.083 1.467 2.833 id=1705 z=5
W 1382.033 30.667 2.933 5.667 id=1705 z=5
W 1386.349 33.276 2.303 4.448 id=1705 z=5
W 1389.767 36.083 1.467 2.833 id=1705 z=5
W 1380.016 31.565 0.968 1.87 id=1705 z=5
W 1378.422 33.418 2.156 4.165 id=1705 z=5
W 1382.121 35.837 2.757 5.327 id=1705 z=5
W 1386.422 37.418 2.156 4.165 id=1705 z=5
W 1382.767 25.083 1.467 2.833 id=1705 z=5
W 1386.033 23.667 2.933 5.667 id=1705 z=5
W 1392.767 31.083 1.467 2.833 id=1705 z=5
W 1395.114 24.822 2.772 5.355 id=1705 z=5
R 1393 35 to=cube id=12 z=2
B 1398 32 id=83
B 1397 32 id=83
B 1398 31 id=83
B 1399 31 id=83
B 1398 30 id=83
B 1397 31 id=83
B 1396 30 id=83
B 1397 30 id=83
B 1396 31 id=83
B 1395 30 id=83
B 1397 29 id=83
B 1398 29 id=83
B 1398 28 id=83
S 1395 31 id=8
S 1396 32 id=8
S 1399 30 rot=90 id=8
S 1400 31 rot=90 id=8
S 1399 29 rot=90 id=8
S 1399 28 rot=90 id=8
W 1359.033 31.667 2.933 5.667 id=1705 z=5
W 1353.033 33.667 2.933 5.667 id=1705 z=5
D 1422 36.8 1 0.2 pad=blue rot=180 id=67 z=2
D 1425 34 1 0.2 pad=blue id=67 z=2
B 1422 37 id=83
B 1421 37 id=83
B 1422 38 id=83
B 1423 37 id=83
B 1421 38 id=83
B 1425 33 id=83
B 1424 33 id=83
B 1425 32 id=83
B 1424 32 id=83
B 1423 32 id=83
B 1424 31 id=83
S 1422 32 rot=-90 id=8
S 1426 32 rot=90 id=8
S 1426 33 rot=90 id=8
S 1424 30 rot=180 id=8
S 1423 31 rot=180 id=8
S 1425 31 rot=180 id=8
S 1420 37 rot=270 id=8
S 1420 38 rot=270 id=8
S 1421 39 id=8
S 1422 39 id=8
S 1423 38 id=8
S 1424 37 rot=90 id=8
R 1432 35 to=ship id=13 z=2
W 1436.767 37.083 1.467 2.833 id=1705 z=5
T 1433 35 tpy=-4.667 id=747 z=2
W 1439.767 29.083 1.467 2.833 id=1705 z=5
W 1435.767 32.083 1.467 2.833 id=1705 z=5
W 1437.539 33.644 1.921 3.712 id=1705 z=5
W 1440.033 35.667 2.933 5.667 id=1705 z=5
W 1442.349 29.276 2.303 4.448 id=1705 z=5
W 1446.033 30.667 2.933 5.667 id=1705 z=5
W 1449.767 35.083 1.467 2.833 id=1705 z=5
W 1444.444 39.46 2.112 4.08 id=1705 z=5
W 1448.075 35.678 0.851 1.643 id=1705 z=5
B 1450 38 id=83
B 1451 38 id=83
R 1450 40 to=spider id=1331 z=2
B 1452 38 id=83
B 1453 38 id=83
B 1452 37 id=83
B 1453 37 id=83
B 1451 37 id=83
B 1451 36 id=83
B 1452 36 id=83
B 1453 36 id=83
B 1454 37 id=83
B 1454 36 id=83
B 1454 38 id=83
B 1455 38 id=83
B 1455 37 id=83
B 1455 36 id=83
B 1456 38 id=83
B 1456 37 id=83
B 1456 36 id=83
B 1454 35 id=83
B 1453 35 id=83
B 1457 37 id=83
E 1455 39 rot=-90 art=3812 id=3812 z=3
B 1455 43 id=83
B 1454 43 id=83
B 1456 43 id=83
B 1454 44 id=83
B 1455 44 id=83
B 1454 45 id=83
B 1453 44 id=83
B 1456 44 id=83
B 1452 46 id=83
B 1457 43 id=83
B 1457 38 id=83
B 1458 38 id=83
B 1458 37 id=83
B 1457 36 id=83
B 1459 37 id=83
S 1456.25 39.144 1 0.063 id=392
B 1459 38 id=83
B 1460 38 id=83
B 1460 37 id=83
B 1458 36 id=83
B 1461 38 id=83
B 1461 37 id=83
B 1462 38 id=83
B 1462 37 id=83
E 1457 42 rot=90 art=3812 id=3812 z=3
E 1462 39 rot=-90 art=3812 id=3812 z=3
B 1462 43 id=83
B 1463 43 id=83
B 1461 43 id=83
B 1462 44 id=83
B 1461 44 id=83
B 1463 45 id=83
B 1464 44 id=83
B 1463 44 id=83
B 1464 43 id=83
B 1465 44 id=83
B 1466 44 id=83
B 1465 43 id=83
B 1467 43 id=83
B 1468 43 id=83
B 1469 43 id=83
B 1466 43 id=83
B 1467 44 id=83
B 1469 44 id=83
B 1468 44 id=83
B 1467 45 id=83
B 1466 45 id=83
B 1465 45 id=83
B 1464 45 id=83
B 1466 46 id=83
B 1461 46 id=83
B 1467 48 id=83
B 1469 46 id=83
E 1469 42 rot=90 art=3812 id=3812 z=3
B 1464 36 id=83
B 1457 34 id=83
B 1469 37 id=83
B 1469 36 id=83
B 1470 35 id=83
B 1470 37 id=83
B 1470 36 id=83
B 1471 36 id=83
B 1471 37 id=83
B 1472 37 id=83
B 1474 37 id=83
B 1473 37 id=83
B 1472 36 id=83
B 1473 36 id=83
E 1474 38 rot=-90 art=3812 id=3812 z=3
B 1473 34 id=83
B 1474 44 id=83
B 1475 44 id=83
B 1474 45 id=83
B 1475 46 id=83
B 1475 45 id=83
B 1476 44 id=83
B 1477 44 id=83
B 1478 44 id=83
B 1479 44 id=83
B 1480 44 id=83
B 1481 44 id=83
B 1482 44 id=83
B 1476 45 id=83
B 1477 46 id=83
B 1478 45 id=83
B 1479 45 id=83
B 1477 45 id=83
B 1478 46 id=83
B 1479 46 id=83
B 1480 45 id=83
B 1481 45 id=83
B 1481 47 id=83
B 1480 46 id=83
B 1473 46 id=83
B 1482 47 id=83
B 1484 47 id=83
E 1482 43 rot=90 art=3812 id=3812 z=3
B 1482 39 id=83
B 1481 38 id=83
B 1482 38 id=83
B 1481 39 id=83
B 1483 38 id=83
B 1483 39 id=83
B 1484 38 id=83
B 1484 39 id=83
B 1480 39 id=83
B 1480 38 id=83
B 1479 37 id=83
B 1479 39 id=83
B 1485 38 id=83
B 1482 37 id=83
B 1483 37 id=83
B 1476 48 id=83
B 1451 34 id=83
R 1483 41 to=cube id=12 z=2
B 1485 39 id=83
B 1486 38 id=83
B 1487 36 id=83
R 1488 41 to=ship id=13 z=2
T 1489 41 tpy=-5.667 id=747 z=2
G 1428 38 gd=1 id=10 z=2
W 1390.033 26.667 2.933 5.667 id=1705 z=5
O 1401 35 orb=yellow id=36 z=2
O 1409 35 orb=pink id=141 col=13017343 z=2
O 1414 35 orb=green id=1022 z=2
B 1468 37 id=83
B 1473 44 id=83
W 1490.913 38.367 1.173 2.267 id=1705 z=5
V 1481 41 spd=4 id=1334 z=2
W 1490.767 33.083 1.467 2.833 id=1705 z=5
W 1494.033 31.667 2.933 5.667 id=1705 z=5
W 1492.033 39.667 2.933 5.667 id=1705 z=5
W 1496.415 42.403 2.171 4.193 id=1705 z=5
W 1499.29 45.163 2.42 4.675 id=1705 z=5
W 1500.033 31.667 2.933 5.667 id=1705 z=5
W 1497.459 35.488 2.083 4.023 id=1705 z=5
W 1501.033 36.667 2.933 5.667 id=1705 z=5
W 1496.133 41.792 0.733 1.417 id=1705 z=5
W 1493.033 44.667 2.933 5.667 id=1705 z=5
W 1505.033 33.667 2.933 5.667 id=1705 z=5
B 1504 42 id=83
B 1506 42 id=83
B 1505 41 id=83
B 1505 42 id=83
B 1506 41 id=83
B 1505 40 id=83
B 1506 40 id=83
B 1505 39 id=83
B 1506 39 id=83
B 1504 40 id=83
B 1504 41 id=83
B 1503 41 id=83
B 1503 42 id=83
B 1501 41 id=83
B 1502 41 id=83
R 1504 44 to=ball id=47 z=2
B 1517 47 id=83
B 1509 42 id=83
B 1508 42 id=83
B 1507 41 id=83
B 1508 41 id=83
B 1507 42 id=83
B 1509 41 id=83
B 1507 40 id=83
B 1510 42 id=83
S 1511 42 rot=90 id=8
S 1510 41 rot=90 id=8
S 1508 40 rot=90 id=8
S 1507 39 rot=90 id=8
B 1514 47 id=83
B 1513 47 id=83
B 1515 47 id=83
B 1514 46 id=83
B 1513 46 id=83
B 1515 46 id=83
B 1512 47 id=83
B 1517 47 id=83
B 1514 49 id=83
B 1511 49 id=83
B 1513 48 id=83
B 1514 48 id=83
E 1509 43 rot=-90 art=3812 id=3812 z=3
E 1515 45 rot=90 art=3812 id=3812 z=3
B 1522 41 id=83
B 1521 41 id=83
B 1520 41 id=83
B 1523 41 id=83
B 1521 40 id=83
B 1522 40 id=83
B 1520 40 id=83
B 1519 40 id=83
B 1517 41 id=83
E 1522 42 rot=-90 art=3812 id=3812 z=3
B 1528 47 id=83
B 1528 46 id=83
B 1529 47 id=83
B 1527 46 id=83
B 1527 47 id=83
B 1529 46 id=83
B 1530 47 id=83
B 1530 46 id=83
B 1534 47 id=83
B 1529 48 id=83
B 1520 39 id=83
B 1521 39 id=83
B 1525 40 id=83
B 1527 42 id=83
S 1525 41 id=8
S 1526 42 rot=-90 id=8
S 1527 43 id=8
S 1517 42 id=8
S 1516 41 rot=-90 id=8
S 1517 46 rot=-180 id=8
S 1518 47 rot=-270 id=8
S 1510 49 rot=-90 id=8
S 1511 47 rot=-90 id=8
S 1519 41 id=8
S 1526 47 rot=-90 id=8
S 1534 48 id=8
S 1535 47 rot=90 id=8
S 1534 46 rot=180 id=8
S 1528 42 rot=90 id=8
S 1527 41 rot=180 id=8
B 1531 46 id=83
B 1532 46 id=83
B 1531 47 id=83
E 1531 45 rot=90 art=3812 id=3812 z=3
B 1536 41 id=83
B 1535 41 id=83
B 1535 40 id=83
B 1536 40 id=83
B 1533 40 id=83
B 1537 41 id=83
B 1537 40 id=83
B 1535 43 id=83
S 1535 44 id=8
S 1532 40 rot=-90 id=8
S 1539 40 rot=90 id=8
B 1538 40 id=83
E 1537 42 rot=-90 art=3812 id=3812 z=3
R 1542 45 to=ship id=13 z=2
T 1543 45 tpy=-4.667 id=747 z=2
B 1534 41 id=83
G 1541 45 gd=1 id=10 z=2
W 1545.4 36.375 2.2 4.25 id=1705 z=5
W 1549.033 36.667 2.933 5.667 id=1705 z=5
W 1556.767 43.083 1.467 2.833 id=1705 z=5
W 1553.033 39.667 2.933 5.667 id=1705 z=5
W 1546.539 43.644 1.921 3.712 id=1705 z=5
W 1545.033 46.667 2.933 5.667 id=1705 z=5
W 1551.033 48.667 2.933 5.667 id=1705 z=5
W 1552.133 47.792 0.733 1.417 id=1705 z=5
W 1549.686 45.928 1.628 3.145 id=1705 z=5
W 1550.847 41.239 1.305 2.522 id=1705 z=5
W 1547.133 39.792 0.733 1.417 id=1705 z=5
V 198 1 spd=1 id=201 z=2
H 472.027 5.95 1 0.05 fm=edge id=468
H 475 9 1 0.05 rot=180 fm=edge id=468
H 476 5 fm=corner id=469
H 476.002 4 0.05 1 rot=-90 fm=edge id=468
H 476.002 2 0.05 1 rot=-90 fm=edge id=468
H 476.002 1 0.05 1 rot=-90 fm=edge id=468
H 476.002 3 0.05 1 rot=-90 fm=edge id=468
H 476.002 0 0.05 1 rot=-90 fm=edge id=468
H 478 5.95 1 0.05 fm=edge id=468
H 479 5.95 1 0.05 fm=edge id=468
H 480 5.95 1 0.05 fm=edge id=468
H 472.002 10 0.05 1 rot=270 fm=edge id=468
H 476.948 10 0.05 1 rot=90 fm=edge id=468
H 478.002 10 0.05 1 rot=270 fm=edge id=468
H 482 9 1 0.05 rot=180 fm=edge id=468
H 483 9 rot=180 fm=corner id=469
H 483.948 10 0.05 1 rot=90 fm=edge id=468
H 483.948 11 0.05 1 rot=90 fm=edge id=468
H 483 5 fm=corner id=469
H 484 5.95 1 0.05 fm=edge id=468
H 485 5.95 1 0.05 fm=edge id=468
H 486 5 rot=90 fm=corner id=469
H 483.002 4 0.05 1 rot=-90 fm=edge id=468
H 483.002 3 0.05 1 rot=-90 fm=edge id=468
H 483.002 2 0.05 1 rot=-90 fm=edge id=468
H 483.002 0 0.05 1 rot=-90 fm=edge id=468
H 483.002 1 0.05 1 rot=-90 fm=edge id=468
H 486.948 4 0.05 1 rot=90 fm=edge id=468
H 486.948 3 0.05 1 rot=90 fm=edge id=468
H 486.948 2 0.05 1 rot=90 fm=edge id=468
H 486.948 1 0.05 1 rot=90 fm=edge id=468
H 486.948 0 0.05 1 rot=90 fm=edge id=468
H 486 9 rot=-90 fm=corner id=469
H 486.002 10 0.05 1 rot=-90 fm=edge id=468
H 486.002 11 0.05 1 rot=-90 fm=edge id=468
H 487 9 1 0.05 rot=-180 fm=edge id=468
R 484 7 to=spider id=1331 z=2
H 525 5 rot=90 fm=corner id=469
H 525 7 rot=-180 fm=corner id=469
H 525.948 8 0.05 1 rot=90 fm=edge id=468
H 525.948 9 0.05 1 rot=90 fm=edge id=468
H 525.948 10 0.05 1 rot=90 fm=edge id=468
H 525.948 11 0.05 1 rot=90 fm=edge id=468
H 525.948 4 0.05 1 rot=90 fm=edge id=468
H 525.948 3 0.05 1 rot=90 fm=edge id=468
H 525.948 2 0.05 1 rot=90 fm=edge id=468
H 525.948 1 0.05 1 rot=90 fm=edge id=468
H 525.948 0 0.05 1 rot=90 fm=edge id=468
H 528 4 fm=corner id=469
H 528.002 3 0.05 1 rot=-90 fm=edge id=468
H 528.002 2 0.05 1 rot=-90 fm=edge id=468
H 528.002 1 0.05 1 rot=-90 fm=edge id=468
H 528.002 0 0.05 1 rot=-90 fm=edge id=468
H 529 4.95 1 0.05 fm=edge id=468
H 530 4.95 1 0.05 fm=edge id=468
H 531 4 rot=90 fm=corner id=469
H 531.948 3 0.05 1 rot=90 fm=edge id=468
H 531.948 2 0.05 1 rot=90 fm=edge id=468
H 531.948 1 0.05 1 rot=90 fm=edge id=468
H 531.948 0 0.05 1 rot=90 fm=edge id=468
R 525 6 to=cube id=12 z=2
O 532 7 orb=yellow id=36 z=2
H 469 9 1 0.05 rot=180 fm=edge id=468
S 479 6.175 1 0.25 id=103
S 531 5 id=8
H 536 7 fm=corner id=469
H 536.002 6 0.05 1 rot=-90 fm=edge id=468
H 536.002 5 0.05 1 rot=-90 fm=edge id=468
H 536.002 4 0.05 1 rot=-90 fm=edge id=468
H 536.002 2 0.05 1 rot=-90 fm=edge id=468
H 536.002 1 0.05 1 rot=-90 fm=edge id=468
H 536.002 3 0.05 1 rot=-90 fm=edge id=468
H 536.002 0 0.05 1 rot=-90 fm=edge id=468
H 537 7.95 1 0.05 fm=edge id=468
H 538 7.95 1 0.05 fm=edge id=468
H 539 7.95 1 0.05 fm=edge id=468
H 540 7.95 1 0.05 fm=edge id=468
H 541 7.95 1 0.05 fm=edge id=468
H 542 7.95 1 0.05 fm=edge id=468
H 546 7 rot=90 fm=corner id=469
H 543 7.95 1 0.05 fm=edge id=468
H 544 7.95 1 0.05 fm=edge id=468
H 545 7.95 1 0.05 fm=edge id=468
H 546.948 6 0.05 1 rot=90 fm=edge id=468
H 546.948 5 0.05 1 rot=90 fm=edge id=468
H 546.948 4 0.05 1 rot=90 fm=edge id=468
H 546.948 3 0.05 1 rot=90 fm=edge id=468
H 546.948 2 0.05 1 rot=90 fm=edge id=468
H 546.948 1 0.05 1 rot=90 fm=edge id=468
H 546.948 0 0.05 1 rot=90 fm=edge id=468
D 546 8 1 0.2 pad=blue id=67 z=2
D 550 16.8 1 0.2 pad=blue rot=180 id=67 z=2
B 550 17 id=83
B 549 17 id=83
B 550 18 id=83
B 552 18 id=83
D 552 12 1 0.2 pad=blue id=67 z=2
B 552 11 id=83
B 553 11 id=83
B 553 10 id=83
B 552 10 id=83
B 554 10 id=83
B 553 17 id=83
B 553 18 id=83
B 554 17 id=83
D 554 16.8 1 0.2 pad=blue rot=180 id=67 z=2
B 547 18 id=83
O 557 8 orb=green id=1022 z=2
G 559 5 gd=1 id=10 z=2
D 561 2 1 0.2 pad=blue id=67 z=2
D 565 9.8 1 0.2 pad=blue rot=180 id=67 z=2
D 566 6 1 0.2 pad=blue id=67 z=2
B 561 1 id=83
B 560 1 id=83
B 562 1 id=83
B 562 0 id=83
B 561 0 id=83
B 560 0 id=83
B 563 1 id=83
B 566 5 id=83
B 565 5 id=83
B 566 4 id=83
B 567 3 id=83
B 565 2 id=83
B 565 10 id=83
B 564 10 id=83
B 564 11 id=83
B 565 11 id=83
B 566 10 id=83
B 563 11 id=83
B 563 12 id=83
B 564 12 id=83
B 561 12 id=83
B 569 13 id=83
B 568 14 id=83
B 569 14 id=83
B 566 12 id=83
D 569 12.8 1 0.2 pad=blue rot=180 id=67 z=2
D 570 9 1 0.2 pad=blue id=67 z=2
B 570 8 id=83
B 570 7 id=83
B 569 6 id=83
B 570 5 id=83
B 569 7 id=83
E 561 11 rot=90 art=3812 id=3812 z=3
E 559 7 rot=-90 art=3812 id=3812 z=3
E 559 3 rot=90 art=3812 id=3812 z=3
B 573 12 id=83
B 574 12 id=83
B 575 12 id=83
B 576 12 id=83
B 575 11 id=83
B 574 11 id=83
B 576 11 id=83
B 577 11 id=83
B 577 12 id=83
B 576 10 id=83
B 578 11 id=83
B 577 10 id=83
B 574 9 id=83
D 561 11.833 1 0.2 pad=pink rot=180 id=140 z=2
G 572 14 gd=1 id=10 z=2
O 580 14 orb=pink id=141 col=13017343 z=2
D 582 15 1 0.2 pad=blue id=67 z=2
D 585 22.8 1 0.2 pad=blue rot=180 id=67 z=2
D 587 19 1 0.2 pad=blue id=67 z=2
D 589 24.8 1 0.2 pad=blue rot=180 id=67 z=2
B 582 14 id=83
B 582 13 id=83
B 583 13 id=83
B 580 11 id=83
S 580 12 id=8
S 582 12 rot=-180 id=8
S 581 11 rot=-270 id=8
S 578 12 rot=-270 id=8
S 573 11 rot=-90 id=8
S 584 13 rot=-270 id=8
B 586 18 id=83
B 587 18 id=83
B 586 17 id=83
B 587 17 id=83
B 587 16 id=83
B 585 23 id=83
B 584 23 id=83
B 585 24 id=83
B 584 24 id=83
B 584 25 id=83
B 586 24 id=83
B 586 25 id=83
B 587 25 id=83
B 588 25 id=83
B 588 26 id=83
B 587 26 id=83
B 585 25 id=83
B 583 24 id=83
S 582 24 rot=-90 id=8
S 583 25 rot=-90 id=8
S 584 26 id=8
S 585 26 id=8
S 586 26 id=8
S 587 27 id=8
S 588 27 id=8
S 590 26 rot=90 id=8
S 590 25 rot=90 id=8
S 583 23 rot=-90 id=8
B 590 19 id=83
B 589 19 id=83
B 590 18 id=83
B 589 18 id=83
B 591 18 id=83
B 588 18 id=83
B 588 17 id=83
B 589 17 id=83
B 591 19 id=83
B 585 15 id=83
B 587 14 id=83
B 593 18 id=83
B 595 17 id=83
B 597 16 id=83
O 600 18 orb=pink id=141 col=13017343 z=2
B 592 16 id=83
B 594 15 id=83
B 594 16 id=83
B 595 16 id=83
B 588 16 id=83
B 589 16 id=83
B 588 15 id=83
B 588 14 id=83
B 590 16 id=83
B 590 15 id=83
B 590 13 id=83
D 602 20 1 0.2 pad=blue id=67 z=2
D 603 23.8 1 0.2 pad=blue rot=180 id=67 z=2
D 604 21 1 0.2 pad=blue id=67 z=2
B 604 19 id=83
B 603 19 id=83
B 604 20 id=83
B 602 18 id=83
B 602 19 id=83
B 603 18 id=83
B 602 24 id=83
B 603 24 id=83
B 603 25 id=83
B 601 24 id=83
B 600 24 id=83
B 598 23 id=83
B 599 24 id=83
B 599 23 id=83
B 598 24 id=83
B 601 25 id=83
B 600 25 id=83
B 602 25 id=83
B 599 25 id=83
B 597 26 id=83
B 589 25 id=83
B 589 26 id=83
S 589 27 id=8
B 587 24 id=83
G 605 23 gd=1 id=10 z=2
R 606 23 to=ufo id=111 z=2
B 610 26 rot=180 id=83
B 611 26 rot=180 id=83
B 611 27 rot=180 id=83
B 610 27 rot=180 id=83
B 609 26 rot=180 id=83
B 608 26 rot=180 id=83
B 609 27 rot=180 id=83
B 609 19 rot=180 id=83
B 610 18 rot=180 id=83
B 612 18 rot=180 id=83
B 610 19 rot=180 id=83
B 609 18 rot=180 id=83
B 608 18 rot=180 id=83
B 611 18 rot=180 id=83
B 611 17 rot=180 id=83
B 609 17 rot=180 id=83
B 610 17 rot=180 id=83
B 616 23 rot=180 id=83
B 615 22 rot=180 id=83
B 617 23 rot=180 id=83
B 618 22 rot=180 id=83
B 617 21 rot=180 id=83
W 616.495 20.559 2.009 3.882 id=1705 z=5
B 616 22 id=83
B 617 28 id=83
B 618 27 id=83
B 616 27 id=83
B 616 28 id=83
B 619 29 id=83
B 613 27 id=83
B 614 17 id=83
B 616 17 id=83
B 617 17 id=83
B 618 17 id=83
B 616 16 id=83
B 617 16 id=83
B 618 16 id=83
B 615 16 id=83
B 624 24 id=83
B 625 24 id=83
B 624 25 id=83
B 624 23 id=83
B 625 23 id=83
B 623 25 id=83
W 622.767 23.083 1.467 2.833 id=1705 z=5
B 625 19 id=83
B 623 18 id=83
B 624 18 id=83
B 625 18 id=83
B 625 17 id=83
B 626 16 id=83
B 624 16 id=83
B 623 16 id=83
B 623 17 id=83
W 623.356 15.29 2.288 4.42 id=1705 z=5
B 621 15 id=83
B 629 26 id=83
B 630 27 id=83
B 629 28 id=83
B 630 28 id=83
B 631 28 id=83
B 631 27 id=83
B 632 26 id=83
B 632 27 id=83
B 633 18 id=83
B 631 17 id=83
B 633 17 id=83
B 632 17 id=83
B 633 16 id=83
B 632 16 id=83
H 638 18 fm=corner id=469
H 642 18.95 1 0.05 fm=edge id=468
H 641 18.95 1 0.05 fm=edge id=468
H 640 18.95 1 0.05 fm=edge id=468
H 639 18.95 1 0.05 fm=edge id=468
H 638.002 17 0.05 1 rot=-90 fm=edge id=468
H 638.002 16 0.05 1 rot=-90 fm=edge id=468
H 638 26 rot=-90 fm=corner id=469
H 640 26 1 0.05 rot=-180 fm=edge id=468
H 639 26 1 0.05 rot=-180 fm=edge id=468
H 641 26 1 0.05 rot=-180 fm=edge id=468
H 642 26 1 0.05 rot=-180 fm=edge id=468
H 643 26 1 0.05 rot=-180 fm=edge id=468
H 644 26 1 0.05 rot=-180 fm=edge id=468
H 645 26 1 0.05 rot=-180 fm=edge id=468
H 638.002 27 0.05 1 rot=-90 fm=edge id=468
H 638.002 28 0.05 1 rot=-90 fm=edge id=468
H 646 26 1 0.05 rot=-180 fm=edge id=468
H 647 26 1 0.05 rot=-180 fm=edge id=468
H 648 26 1 0.05 rot=-180 fm=edge id=468
H 649 26 1 0.05 rot=-180 fm=edge id=468
H 650 26 1 0.05 rot=-180 fm=edge id=468
H 652 26 1 0.05 rot=-180 fm=edge id=468
H 654 26 1 0.05 rot=-180 fm=edge id=468
H 655 26 1 0.05 rot=-180 fm=edge id=468
H 651 26 1 0.05 rot=-180 fm=edge id=468
H 653 26 1 0.05 rot=-180 fm=edge id=468
H 656 26 1 0.05 rot=-180 fm=edge id=468
H 657 26 1 0.05 rot=-180 fm=edge id=468
H 658 26 1 0.05 rot=-180 fm=edge id=468
H 659 26 1 0.05 rot=-180 fm=edge id=468
H 660 26 1 0.05 rot=-180 fm=edge id=468
E 638 22 art=3823 id=3823 z=3
E 639 23 art=3823 id=3823 z=3
E 639 21 art=3823 id=3823 z=3
E 640 22 art=3823 id=3823 z=3
W 631.767 17.083 1.467 2.833 id=1705 z=5
W 629.767 25.083 1.467 2.833 id=1705 z=5
W 613.06 16.65 0.88 1.7 id=1705 z=5
W 605.561 16.687 1.877 3.627 id=1705 z=5
W 604.415 25.403 2.171 4.193 id=1705 z=5
W 613.561 25.687 1.877 3.627 id=1705 z=5
W 621.033 27.667 2.933 5.667 id=1705 z=5
W 625.51 27.588 1.98 3.825 id=1705 z=5
W 627.085 13.766 2.831 5.468 id=1705 z=5
W 634.033 24.667 2.933 5.667 id=1705 z=5
W 634.033 13.667 2.933 5.667 id=1705 z=5
W 619.576 13.715 1.848 3.57 id=1705 z=5
V 0 10 spd=0 id=200 z=2
B 0 9 id=83
B 0 14 id=83
B 1 13 id=83
B 0 13 id=83
B 1 14 id=83
B 0 8 id=83
B 1 9 id=83
B 1 8 id=83
B 1 7 id=83
B 2 8 id=83
B 2 7 id=83
B 3 7 id=83
B 2 9 id=83
B 0 6 id=83
B 2 13 id=83
B 2 14 id=83
B 3 13 id=83
B 3 14 id=83
B 3 16 id=83
B 2 15 id=83
B 0 15 id=83
B 1 15 id=83
B 5 15 id=83
B 4 13 id=83
B 3 9 id=83
B 3 8 id=83
B 4 9 id=83
B 5 5 id=83
B 5 6 id=83
B 5 9 id=83
B 6 9 id=83
B 7 8 id=83
B 7 9 id=83
B 6 8 id=83
B 5 8 id=83
B 7 7 id=83
B 8 8 id=83
B 8 7 id=83
B 9 8 id=83
B 8 9 id=83
B 9 7 id=83
B 9 9 id=83
B 10 9 id=83
B 11 8 id=83
B 11 9 id=83
B 13 9 id=83
B 12 9 id=83
B 13 8 id=83
B 12 8 id=83
B 14 8 id=83
B 18 8 id=83
B 19 8 id=83
B 20 8 id=83
B 17 9 id=83
B 16 9 id=83
B 15 9 id=83
B 14 9 id=83
B 18 9 id=83
B 19 9 id=83
B 20 9 id=83
B 21 9 id=83
B 22 9 id=83
B 22 8 id=83
B 21 8 id=83
B 20 7 id=83
B 14 7 id=83
B 13 7 id=83
B 12 7 id=83
B 16 7 id=83
B 15 6 id=83
B 9 6 id=83
B 11 5 id=83
B 21 6 id=83
B 23 9 id=83
B 24 7 id=83
B 26 9 id=83
B 27 9 id=83
B 26 8 id=83
B 27 8 id=83
B 27 7 id=83
B 28 7 id=83
B 28 8 id=83
B 30 7 id=83
B 30 8 id=83
B 29 8 id=83
B 28 9 id=83
B 31 7 id=83
B 31 8 id=83
B 32 8 id=83
B 32 7 id=83
B 29 5 id=83
B 34 8 id=83
B 33 8 id=83
B 35 8 id=83
B 36 8 id=83
B 36 7 id=83
B 37 7 id=83
B 35 7 id=83
B 34 6 id=83
B 32 6 id=83
B 37 8 id=83
B 38 8 id=83
B 38 7 id=83
B 39 8 id=83
B 40 8 id=83
B 41 8 id=83
B 42 8 id=83
B 43 8 id=83
B 44 8 id=83
B 45 8 id=83
B 46 8 id=83
B 47 8 id=83
B 47 7 id=83
B 46 7 id=83
B 39 6 id=83
B 43 6 id=83
B 46 6 id=83
B 44 5 id=83
B 38 5 id=83
B 35 5 id=83
B 38 6 id=83
B 39 7 id=83
B 40 5 id=83
B 41 5 id=83
B 44 6 id=83
B 41 6 id=83
B 45 7 id=83
B 48 6 id=83
B 50 7 id=83
B 50 6 id=83
B 51 7 id=83
B 51 6 id=83
B 52 6 id=83
B 53 6 id=83
B 52 7 id=83
B 53 5 id=83
B 55 5 id=83
B 53 7 id=83
B 54 7 id=83
B 54 6 id=83
B 55 6 id=83
B 56 6 id=83
B 56 5 id=83
B 57 5 id=83
B 57 6 id=83
B 58 6 id=83
B 59 5 id=83
B 59 6 id=83
B 60 6 id=83
B 61 5 id=83
B 62 5 id=83
B 62 6 id=83
B 61 6 id=83
B 63 6 id=83
B 63 5 id=83
B 64 6 id=83
B 66 6 id=83
B 65 6 id=83
B 65 5 id=83
B 66 5 id=83
B 67 6 id=83
B 68 6 id=83
B 69 6 id=83
B 68 5 id=83
B 51 5 id=83
B 56 4 id=83
B 59 4 id=83
B 60 4 id=83
B 62 4 id=83
B 63 4 id=83
B 66 4 id=83
B 68 4 id=83
B 56 3 id=83
B 55 3 id=83
B 53 4 id=83
B 49 3 id=83
B 58 3 id=83
B 64 3 id=83
B 66 3 id=83
B 70 6 id=83
B 71 6 id=83
B 72 6 id=83
B 72 5 id=83
B 71 5 id=83
B 70 5 id=83
B 73 5 id=83
B 71 4 id=83
B 70 3 id=83
B 75 5 id=83
B 76 5 id=83
B 76 4 id=83
B 77 5 id=83
B 77 4 id=83
B 76 3 id=83
B 78 4 id=83
B 78 5 id=83
B 79 5 id=83
B 79 4 id=83
B 78 3 id=83
B 79 3 id=83
B 80 3 id=83
B 85 3 id=83
B 84 4 id=83
B 83 4 id=83
B 82 5 id=83
B 81 5 id=83
B 80 5 id=83
B 83 5 id=83
B 84 5 id=83
B 85 5 id=83
B 86 5 id=83
B 87 5 id=83
B 87 4 id=83
B 88 5 id=83
B 88 4 id=83
B 89 5 id=83
B 90 5 id=83
B 91 5 id=83
B 92 5 id=83
B 93 5 id=83
B 94 5 id=83
B 95 5 id=83
B 92 4 id=83
B 93 4 id=83
B 94 3 id=83
B 92 3 id=83
B 91 3 id=83
B 95 3 id=83
B 82 3 id=83
B 84 3 id=83
B 88 3 id=83
B 89 3 id=83
B 91 4 id=83
B 91 2 id=83
B 86 2 id=83
B 96 4 id=83
B 99 4 id=83
B 100 4 id=83
B 99 3 id=83
B 98 3 id=83
B 100 3 id=83
B 101 3 id=83
B 101 4 id=83
B 102 4 id=83
B 103 4 id=83
B 104 4 id=83
B 105 4 id=83
B 106 4 id=83
B 106 3 id=83
B 107 3 id=83
B 108 3 id=83
B 103 3 id=83
B 102 3 id=83
B 107 4 id=83
B 108 4 id=83
B 109 4 id=83
B 110 4 id=83
B 111 4 id=83
B 112 4 id=83
B 112 3 id=83
B 111 3 id=83
B 110 3 id=83
B 109 3 id=83
B 102 2 id=83
B 103 2 id=83
B 105 2 id=83
B 107 2 id=83
B 111 2 id=83
B 112 2 id=83
B 113 2 id=83
B 113 3 id=83
B 102 1 id=83
B 108 1 id=83
B 112 1 id=83
B 113 4 id=83
B 114 4 id=83
B 115 4 id=83
B 116 4 id=83
B 117 4 id=83
B 118 4 id=83
B 119 3 id=83
B 118 3 id=83
B 117 3 id=83
B 116 3 id=83
B 114 2 id=83
B 117 2 id=83
B 122 4 id=83
B 122 3 id=83
B 123 3 id=83
B 123 4 id=83
B 124 4 id=83
B 124 3 id=83
B 125 4 id=83
B 126 4 id=83
B 126 3 id=83
B 127 4 id=83
B 127 3 id=83
B 121 4 id=83
B 123 2 id=83
B 124 2 id=83
B 128 4 id=83
B 129 4 id=83
B 130 4 id=83
B 131 3 id=83
B 130 3 id=83
B 130 2 id=83
B 128 1 id=83
B 134 3 id=83
B 135 3 id=83
B 134 2 id=83
B 133 3 id=83
B 135 2 id=83
B 136 1 id=83
B 137 3 id=83
B 138 3 id=83
B 139 3 id=83
B 138 2 id=83
B 140 3 id=83
B 141 3 id=83
B 141 2 id=83
B 142 2 id=83
B 142 3 id=83
B 143 2 id=83
B 143 1 id=83
B 142 1 id=83
B 139 1 id=83
B 139 2 id=83
B 141 0 id=83
B 145 3 id=83
B 146 3 id=83
B 147 3 id=83
B 147 2 id=83
B 146 2 id=83
B 145 2 id=83
B 148 3 id=83
B 148 2 id=83
B 149 3 id=83
B 150 3 id=83
B 150 2 id=83
B 147 1 id=83
B 149 0 id=83
B 151 3 id=83
B 151 2 id=83
B 152 2 id=83
B 152 3 id=83
B 153 3 id=83
O 154 5 orb=pink id=141 col=13017343 z=2
B 152 1 id=83
B 157 4 id=83
B 158 4 id=83
B 158 3 id=83
B 159 3 id=83
B 159 4 id=83
B 160 4 id=83
B 160 3 id=83
B 161 4 id=83
B 157 2 id=83
B 161 2 id=83
B 163 3 id=83
B 164 4 id=83
B 164 3 id=83
B 165 4 id=83
B 165 3 id=83
B 164 2 id=83
B 166 3 id=83
B 158 2 id=83
B 155 2 id=83
B 166 4 id=83
B 167 3 id=83
B 169 3 id=83
B 170 3 id=83
B 170 2 id=83
B 171 3 id=83
B 171 2 id=83
B 172 3 id=83
B 173 3 id=83
B 175 2 id=83
B 175 1 id=83
B 176 2 id=83
B 176 1 id=83
B 170 1 id=83
B 169 0 id=83
B 166 1 id=83
B 167 1 id=83
B 173 1 id=83
B 174 1 id=83
B 177 1 id=83
B 178 1 id=83
B 179 1 id=83
B 178 0 id=83
B 179 0 id=83
B 177 0 id=83
B 176 0 id=83
B 182 0 id=83
B 183 0 id=83
B 184 0 id=83
S 180 0 id=8
S 181 0 id=8
S 185 0 id=8
S 186 0 id=8
S 190 0 id=8
S 154 2 rot=270 id=8
S 156 2 rot=90 id=8
S 155 1 rot=180 id=8
S 155 3 id=8
S 146 1 rot=180 id=8
S 151 1 rot=180 id=8
S 138 1 rot=180 id=8
S 134 1 rot=180 id=8
S 126 2 rot=180 id=8
S 129 3 rot=180 id=8
S 123 1 rot=180 id=8
S 120 3 rot=90 id=8
S 117 1 rot=180 id=8
S 114 1 rot=180 id=8
S 105 1 rot=180 id=8
S 99 2 rot=180 id=8
S 97 3 rot=270 id=8
S 92 2 rot=180 id=8
S 88 2 rot=180 id=8
S 81 4 rot=180 id=8
S 76 2 rot=180 id=8
S 74 5 rot=270 id=8
S 70 2 rot=180 id=8
S 67 5 rot=180 id=8
S 62 3 rot=180 id=8
S 56 2 rot=180 id=8
S 49 4 id=8
S 48 5 rot=180 id=8
S 51 4 rot=180 id=8
S 37 6 rot=180 id=8
S 43 5 rot=180 id=8
S 27 6 rot=180 id=8
S 25 7 rot=90 id=8
S 24 8 id=8
S 19 7 rot=-90 id=8
S 13 6 rot=-180 id=8
S 7 6 rot=-180 id=8
S 2 6 rot=-180 id=8
S 3 12 rot=-180 id=8
B 16 12 id=83
B 17 12 id=83
B 18 12 id=83
B 15 14 id=83
B 16 13 id=83
B 20 13 id=83
B 20 14 id=83
B 34 12 id=83
B 33 12 id=83
B 32 12 id=83
B 35 11 id=83
B 37 12 id=83
B 36 13 id=83
B 34 13 id=83
B 28 13 id=83
S 33 11 rot=180 id=8
S 20 12 rot=180 id=8
S 56 11 rot=180 id=8
B 56 12 id=83
B 57 11 id=83
B 58 11 id=83
B 59 11 id=83
B 59 12 id=83
B 57 13 id=83
B 60 11 id=83
S 59 10 rot=180 id=8
B 54 13 id=83
B 63 10 id=83
B 45 5 id=83
S 63 9 rot=180 id=8
B 63 11 id=83
B 62 11 id=83
B 85 9 id=83
B 86 9 id=83
B 86 10 id=83
B 85 11 id=83
B 84 11 id=83
B 83 11 id=83
B 88 11 id=83
B 89 10 id=83
B 87 11 id=83
B 90 11 rot=90 id=83
S 89 9 rot=180 id=8
B 119 9 id=83
B 120 10 id=83
B 119 10 id=83
B 128 9 id=83
B 125 9 id=83
B 124 10 id=83
B 122 10 id=83
B 126 9 id=83
B 127 9 id=83
B 117 10 id=83
B 115 10 id=83
B 112 11 id=83
B 114 10 id=83
B 113 10 id=83
B 116 11 id=83
B 116 12 id=83
B 117 12 id=83
B 117 13 id=83
B 117 11 id=83
B 118 11 id=83
B 119 11 id=83
B 124 11 id=83
B 123 11 id=83
S 114 9 rot=180 id=8
S 125 8 rot=180 id=8
B 144 8 id=83
B 145 9 id=83
B 145 10 id=83
B 144 10 id=83
B 146 9 id=83
B 147 9 id=83
B 148 9 id=83
B 151 11 id=83
B 151 10 id=83
B 150 11 id=83
B 150 10 id=83
B 149 11 id=83
B 148 11 id=83
B 147 11 id=83
B 152 10 id=83
B 156 12 id=83
B 157 11 id=83
B 157 12 id=83
B 157 13 id=83
B 157 14 id=83
B 158 14 id=83
B 158 13 id=83
B 159 13 id=83
B 162 11 id=83
B 163 11 id=83
B 163 10 id=83
B 164 11 id=83
B 165 11 id=83
B 166 11 id=83
B 161 9 id=83
S 161 8 rot=180 id=8
S 157 10 rot=180 id=8
S 150 9 rot=180 id=8
S 146 8 rot=180 id=8
B 142 8 id=83
W 1541.767 47.083 1.467 2.833 id=1705 z=5
R 1556 48 to=wave id=660 z=2
B 1561 44 id=83
B 1560 43 id=83
B 1559 43 id=83
B 1559 44 id=83
B 1560 44 id=83
B 1558 43 id=83
B 1558 42 id=83
B 1560 41 id=83
B 1561 42 id=83
B 1559 41 id=83
B 1561 43 id=83
B 1562 42 id=83
B 1563 42 id=83
B 1559 52 id=83
B 1558 52 id=83
B 1557 52 id=83
B 1560 51 id=83
B 1559 51 id=83
B 1560 53 id=83
B 1561 51 id=83
B 1560 52 id=83
B 1561 52 id=83
B 1561 50 id=83
B 1560 50 id=83
B 1558 51 id=83
B 1559 53 id=83
B 1561 53 id=83
B 1562 51 id=83
B 1562 52 id=83
S 1561 45 id=8
S 1560 45 id=8
S 1559 45 id=8
S 1561 49 rot=180 id=8
S 1560 49 rot=180 id=8
S 1564 42 rot=90 id=8
S 1556 52 rot=-90 id=8
S 1557 51 rot=-90 id=8
S 1558 53 rot=-90 id=8
S 1559 54 id=8
S 1560 54 id=8
S 1561 54 id=8
S 1562 53 id=8
S 1558 50 rot=180 id=8
S 1559 50 rot=180 id=8
S 1562 50 rot=180 id=8
B 1570 46 id=83
B 1568 45 id=83
B 1569 47 id=83
B 1568 46 id=83
B 1570 47 id=83
B 1571 47 id=83
B 1571 46 id=83
W 1568.033 43.667 2.933 5.667 id=1705 z=5
B 1578 50 id=83
B 1579 50 id=83
B 1578 51 id=83
B 1578 52 id=83
B 1576 52 id=83
B 1577 52 id=83
B 1577 51 id=83
B 1586 41 id=83
W 1576.224 48.035 2.552 4.93 id=1705 z=5
W 1561.407 41.389 2.185 4.222 id=1705 z=5
W 1564.701 43.956 1.599 3.088 id=1705 z=5
W 1562.422 50.418 2.156 4.165 id=1705 z=5
W 1573.422 51.418 2.156 4.165 id=1705 z=5
W 1572.422 43.418 2.156 4.165 id=1705 z=5
W 1566.422 40.418 2.156 4.165 id=1705 z=5
W 1570.422 40.418 2.156 4.165 id=1705 z=5
W 1574.033 38.667 2.933 5.667 id=1705 z=5
Z 1578 45 mini=1 id=101 z=2
W 1580.547 49.658 1.907 3.683 id=1705 z=5
W 1585.327 50.233 2.347 4.533 id=1705 z=5
W 1580.033 38.667 2.933 5.667 id=1705 z=5
W 1586.033 38.667 2.933 5.667 id=1705 z=5
W 1589.605 40.772 1.789 3.457 id=1705 z=5
B 1586 42 id=83
B 1585 42 id=83
B 1586 43 id=83
B 1584 43 id=83
B 1585 43 id=83
B 1584 42 id=83
B 1585 41 id=83
B 1586 44 id=83
B 1584 52 id=83
B 1585 52 id=83
B 1585 51 id=83
B 1591 52 id=83
B 1592 51 id=83
B 1593 52 id=83
B 1592 52 id=83
W 1590.767 50.083 1.467 2.833 id=1705 z=5
W 1583.605 41.772 1.789 3.457 id=1705 z=5
W 1588.987 51.508 1.027 1.983 id=1705 z=5
W 1583.987 50.508 1.027 1.983 id=1705 z=5
W 1594.107 38.808 2.787 5.383 id=1705 z=5
B 1594 42 id=83
B 1593 43 id=83
B 1594 43 id=83
W 1592.767 41.083 1.467 2.833 id=1705 z=5
W 1593.4 50.375 2.2 4.25 id=1705 z=5
R 1598 47 to=ship id=13 z=2
T 1599 47 tpy=-5.667 id=747 z=2
W 1596.767 49.083 1.467 2.833 id=1705 z=5
B 1567 54 id=83
B 1566 54 id=83
B 1566 53 id=83
B 1565 53 id=83
B 1565 54 id=83
S 1566 52 rot=180 id=8
S 1567 53 rot=180 id=8
W 1520.033 46.667 2.933 5.667 id=1705 z=5
W 1512.033 36.667 2.933 5.667 id=1705 z=5
W 1528.033 36.667 2.933 5.667 id=1705 z=5
W 1600.4 37.521 2.2 4.25 id=1705 z=5
W 1604.033 37.813 2.933 5.667 id=1705 z=5
W 1608.503 39.719 1.995 3.853 id=1705 z=5
W 1601.539 44.79 1.921 3.712 id=1705 z=5
W 1600.033 47.813 2.933 5.667 id=1705 z=5
W 1607.033 48.813 2.933 5.667 id=1705 z=5
W 1604.133 45.938 0.733 1.417 id=1705 z=5
W 1604.686 47.074 1.628 3.145 id=1705 z=5
W 1606.847 42.385 1.305 2.522 id=1705 z=5
W 1602.133 40.938 0.733 1.417 id=1705 z=5
W 1609.503 42.573 1.995 3.853 id=1705 z=5
R 263 10 to=ball id=47 z=2
E 1348 28 art=3823 id=3823 z=3
E 1347 28 art=3823 id=3823 z=3
E 1348 29 art=3823 id=3823 z=3
E 1348 27 art=3823 id=3823 z=3
E 1349 28 art=3823 id=3823 z=3
W 1613.033 43.667 2.933 5.667 id=1705 z=5
W 1612.033 38.667 2.933 5.667 id=1705 z=5
W 1611.089 45.707 0.821 1.587 id=1705 z=5
W 1605.089 49.707 0.821 1.587 id=1705 z=5
W 1611.862 51.268 1.276 2.465 id=1705 z=5
R 1614 50 to=cube id=12 z=2
O 1620 46 orb=yellow id=36 z=2
B 1627 47 id=83
B 1626 47 id=83
B 1625 47 id=83
B 1625 46 id=83
B 1626 46 id=83
B 1623 46 id=83
B 1624 46 id=83
B 1624 45 id=83
B 1621 44 id=83
B 1619 44 id=83
B 1619 45 id=83
B 1620 44 id=83
B 1618 45 id=83
B 1618 44 id=83
B 1617 45 id=83
B 1616 45 id=83
B 1616 46 id=83
B 1615 46 id=83
S 1617 46 id=8
S 1618 46 id=8
S 1620 45 id=8
S 1621 45 id=8
S 1619 45.95 1 0.5 id=39
S 1624 47 id=8
S 1623 47 id=8
O 1632 50 orb=green id=1022 z=2
B 1635 49 id=83
B 1636 49 id=83
D 1636 48.8 1 0.2 pad=blue rot=180 id=67 z=2
B 1639 44 id=83
B 1638 44 id=83
B 1640 44 id=83
B 1641 44 id=83
B 1639 43 id=83
B 1637 43 id=83
B 1636 43 id=83
B 1638 43 id=83
B 1636 50 id=83
B 1637 49 id=83
B 1636 51 id=83
B 1638 50 id=83
B 1637 51 id=83
B 1637 50 id=83
B 1640 51 id=83
B 1640 43 id=83
B 1641 43 id=83
B 1641 42 id=83
B 1649 47 id=83
B 1648 47 id=83
B 1648 46 id=83
B 1649 46 id=83
B 1650 46 id=83
B 1650 45 id=83
B 1647 46 id=83
B 1642 43 id=83
O 1643 47 orb=pink id=141 col=13017343 z=2
R 1653 50 to=ship id=13 z=2
T 1654 50 tpy=-5.667 id=747 z=2
W 1654.9 41.021 2.2 4.25 id=1705 z=5
W 1658.533 40.313 2.933 5.667 id=1705 z=5
W 1663.003 45.219 1.995 3.853 id=1705 z=5
W 1656.039 48.29 1.921 3.712 id=1705 z=5
W 1654.533 51.313 2.933 5.667 id=1705 z=5
W 1659.533 50.313 2.933 5.667 id=1705 z=5
W 1658.633 49.438 0.733 1.417 id=1705 z=5
W 1663.186 53.574 1.628 3.145 id=1705 z=5
W 1665.347 47.885 1.305 2.522 id=1705 z=5
W 1657.633 44.438 0.733 1.417 id=1705 z=5
W 1663.003 42.073 1.995 3.853 id=1705 z=5
W 1667.533 47.166 2.933 5.667 id=1705 z=5
W 1666.533 42.166 2.933 5.667 id=1705 z=5
W 1660.589 45.206 0.821 1.587 id=1705 z=5
W 1663.589 52.206 0.821 1.587 id=1705 z=5
W 1665.362 53.767 1.276 2.465 id=1705 z=5
R 1668 54 to=spider id=1331 z=2
B 1673 51 id=83
B 1672 52 id=83
B 1673 52 id=83
B 1674 52 id=83
B 1674 51 id=83
B 1676 51 id=83
B 1675 51 id=83
B 1672 50 id=83
B 1675 52 id=83
E 1674 53 rot=-90 art=3812 id=3812 z=3
B 1674 56 id=83
B 1675 56 id=83
B 1674 57 id=83
B 1673 57 id=83
B 1676 56 id=83
B 1677 57 id=83
B 1678 57 id=83
B 1678 56 id=83
B 1679 56 id=83
B 1677 56 id=83
E 1678 55 rot=90 art=3812 id=3812 z=3
B 1678 58 id=83
B 1680 58 id=83
B 1678 52 id=83
B 1679 52 id=83
B 1679 51 id=83
B 1680 51 id=83
B 1680 52 id=83
B 1681 52 id=83
B 1681 51 id=83
B 1682 51 id=83
B 1682 52 id=83
B 1683 51 id=83
E 1681 53 rot=-90 art=3812 id=3812 z=3
B 1681 57 id=83
B 1681 58 id=83
B 1681 56 id=83
B 1682 56 id=83
B 1683 56 id=83
B 1682 57 id=83
B 1684 56 id=83
B 1686 56 id=83
B 1687 56 id=83
B 1688 56 id=83
B 1685 56 id=83
B 1685 57 id=83
B 1686 57 id=83
B 1688 57 id=83
B 1689 56 id=83
E 1688 55 rot=90 art=3812 id=3812 z=3
B 1685 58 id=83
B 1689 58 id=83
B 1683 58 id=83
B 1688 52 id=83
B 1687 51 id=83
B 1688 51 id=83
B 1684 53 id=83
B 1676 53 id=83
B 1689 52 id=83
B 1689 51 id=83
B 1690 52 id=83
B 1691 52 id=83
B 1692 52 id=83
B 1693 52 id=83
B 1695 52 id=83
B 1696 52 id=83
B 1695 51 id=83
B 1694 52 id=83
B 1696 51 id=83
E 1696 53 rot=-90 art=3812 id=3812 z=3
B 1688 50 id=83
B 1694 50 id=83
B 1696 50 id=83
B 1691 50 id=83
B 1689 50 id=83
B 1686 49 id=83
B 1690 51 id=83
B 1697 51 id=83
B 1697 52 id=83
B 1698 50 id=83
B 1699 52 id=83
B 1696 56 id=83
B 1696 57 id=83
B 1697 57 id=83
B 1697 56 id=83
B 1698 56 id=83
B 1699 57 id=83
B 1700 56 id=83
B 1701 56 id=83
B 1702 57 id=83
B 1702 56 id=83
B 1701 52 id=83
B 1702 51 id=83
B 1701 51 id=83
B 1701 50 id=83
B 1700 50 id=83
B 1702 52 id=83
B 1703 52 id=83
B 1703 51 id=83
B 1704 51 id=83
E 1701 55 rot=90 art=3812 id=3812 z=3
B 1699 56 id=83
B 1695 57 id=83
B 1697 58 id=83
B 1703 57 id=83
W 1691.033 55.667 2.933 5.667 id=1705 z=5
W 1684.349 49.276 2.303 4.448 id=1705 z=5
W 1676.627 49.814 1.745 3.372 id=1705 z=5
W 1698.767 50.083 1.467 2.833 id=1705 z=5
W 1678.767 56.083 1.467 2.833 id=1705 z=5
W 1666.767 56.083 1.467 2.833 id=1705 z=5
W 1670.033 55.667 2.933 5.667 id=1705 z=5
B 1647 47 id=83
B 1646 46 id=83
W 1703.239 55.063 2.523 4.873 id=1705 z=5
W 1707.73 54.013 1.54 2.975 id=1705 z=5
T 1708 52 tpy=-4.667 id=747 z=2
R 1707 52 to=ship id=13 z=2
W 1704.767 49.083 1.467 2.833 id=1705 z=5
W 1705.913 54.367 1.173 2.267 id=1705 z=5
W 1709.047 48.867 1.173 2.267 id=1705 z=5
W 1708.9 43.583 1.467 2.833 id=1705 z=5
W 1712.167 42.167 2.933 5.667 id=1705 z=5
W 1710.167 50.167 2.933 5.667 id=1705 z=5
W 1714.548 52.903 2.171 4.193 id=1705 z=5
W 1717.423 55.663 2.42 4.675 id=1705 z=5
W 1718.167 42.167 2.933 5.667 id=1705 z=5
W 1715.592 45.988 2.083 4.023 id=1705 z=5
W 1719.167 47.167 2.933 5.667 id=1705 z=5
W 1714.267 52.292 0.733 1.417 id=1705 z=5
W 1710.167 55.167 2.933 5.667 id=1705 z=5
B 1695 56 id=83
B 1694 56 id=83
B 1687 52 id=83
R 1721 54 to=ufo id=111 z=2
W 1721.767 57.083 1.467 2.833 id=1705 z=5
W 1723.767 60.083 1.467 2.833 id=1705 z=5
W 1723.767 49.083 1.467 2.833 id=1705 z=5
B 1727 59 id=83
B 1728 59 id=83
B 1726 60 id=83
B 1726 59 id=83
B 1727 60 id=83
B 1728 60 id=83
B 1726 62 id=83
B 1728 61 id=83
B 1726 61 id=83
B 1727 62 id=83
B 1727 61 id=83
B 1725 59 id=83
B 1729 60 id=83
B 1730 60 id=83
B 1730 61 id=83
B 1729 62 id=83
B 1730 58 id=83
B 1728 52 id=83
B 1727 52 id=83
B 1726 51 id=83
B 1729 51 id=83
B 1728 51 id=83
B 1727 51 id=83
B 1730 52 id=83
B 1729 50 id=83
B 1728 50 id=83
B 1727 50 id=83
B 1726 49 id=83
B 1728 49 id=83
B 1726 50 id=83
B 1725 49 id=83
B 1727 49 id=83
B 1725 50 id=83
B 1731 50 id=83
S 1726 58 rot=180 id=8
S 1725 58 rot=180 id=8
S 1727 58 rot=180 id=8
S 1728 58 rot=180 id=8
S 1731 58 rot=90 id=8
S 1731 52 rot=90 id=8
S 1732 50 rot=90 id=8
Z 1595 47 mini=0 id=99 z=2
S 1726 52 id=8
S 1727 53 id=8
S 1728 53 id=8
S 1730 53 id=8
W 1732.583 49.729 1.833 3.542 id=1705 z=5
G 1730 55 gd=-1 id=11 z=2
W 1734.033 58.667 2.933 5.667 id=1705 z=5
W 1735.327 55.233 2.347 4.533 id=1705 z=5
W 1738.767 54.083 1.467 2.833 id=1705 z=5
W 1735.767 48.083 1.467 2.833 id=1705 z=5
W 1738.767 47.083 1.467 2.833 id=1705 z=5
G 1740 51 gd=1 id=10 z=2
W 1741.202 42.993 2.596 5.015 id=1705 z=5
W 1745.415 48.403 2.171 4.193 id=1705 z=5
W 1742.767 47.083 1.467 2.833 id=1705 z=5
B 1741 54 id=83
B 1742 55 id=83
B 1741 55 id=83
B 1742 54 id=83
B 1743 55 id=83
B 1740 55 id=83
B 1740 56 id=83
B 1742 57 id=83
B 1737 48 id=83
B 1738 49 id=83
B 1738 47 id=83
B 1737 49 id=83
B 1738 48 id=83
B 1737 47 id=83
B 1736 47 id=83
B 1735 48 id=83
B 1736 48 id=83
B 1739 47 id=83
W 1748.767 50.083 1.467 2.833 id=1705 z=5
W 1743.767 55.083 1.467 2.833 id=1705 z=5
W 1746.033 55.667 2.933 5.667 id=1705 z=5
W 1754.767 54.083 1.467 2.833 id=1705 z=5
W 1753.033 45.667 2.933 5.667 id=1705 z=5
W 1758.239 45.063 2.523 4.873 id=1705 z=5
W 1758.033 54.667 2.933 5.667 id=1705 z=5
W 1762.033 45.667 2.933 5.667 id=1705 z=5
W 1762.767 56.083 1.467 2.833 id=1705 z=5
B 1752 56 id=83
B 1751 56 id=83
B 1751 57 id=83
B 1750 57 id=83
B 1758 49 id=83
B 1757 49 id=83
B 1758 48 id=83
B 1757 48 id=83
B 1756 48 id=83
B 1757 46 id=83
B 1753 58 id=83
W 1748.767 47.083 1.467 2.833 id=1705 z=5
W 1732.767 57.083 1.467 2.833 id=1705 z=5
W 1740.95 47.438 1.1 2.125 id=1705 z=5
W 1745.415 44.403 2.171 4.193 id=1705 z=5
B 1765 56 id=83
B 1765 57 id=83
B 1766 56 id=83
B 1766 57 id=83
B 1767 56 id=83
B 1764 57 id=83
B 1764 56 id=83
B 1768 58 id=83
B 1765 58 id=83
W 1750.913 49.367 1.173 2.267 id=1705 z=5
W 1756.869 53.282 1.261 2.437 id=1705 z=5
W 1761.869 54.282 1.261 2.437 id=1705 z=5
W 1761.869 58.282 1.261 2.437 id=1705 z=5
W 1755.869 56.282 1.261 2.437 id=1705 z=5
B 1765 50 id=83
B 1765 49 id=83
B 1765 48 id=83
B 1764 48 id=83
B 1764 49 id=83
B 1766 50 id=83
B 1766 49 id=83
B 1766 48 id=83
B 1767 48 id=83
B 1765 47 id=83
B 1766 47 id=83
B 1768 46 id=83
B 1768 50 id=83
S 1765 51 id=8
S 1766 51 id=8
S 1768 51 id=8
S 1764 55 rot=180 id=8
S 1765 55 rot=180 id=8
S 1766 55 rot=180 id=8
S 1767 55 rot=180 id=8
V 1768 53 spd=0 id=200 z=2
V 1786 53 spd=2 id=202 z=2
W 1770.033 45.667 2.933 5.667 id=1705 z=5
W 1775.033 45.667 2.933 5.667 id=1705 z=5
W 1779.033 47.667 2.933 5.667 id=1705 z=5
W 1769.033 54.667 2.933 5.667 id=1705 z=5
W 1775.642 56.843 1.716 3.315 id=1705 z=5
W 1777.855 56.253 1.291 2.493 id=1705 z=5
W 1773.671 54.899 1.657 3.202 id=1705 z=5
W 1773.038 57.608 0.924 1.785 id=1705 z=5
W 1780.459 56.488 2.083 4.023 id=1705 z=5
B 1783 51 id=83
B 1784 51 id=83
B 1785 51 id=83
B 1786 51 id=83
B 1787 51 id=83
B 1788 51 id=83
B 1789 51 id=83
B 1788 50 id=83
B 1786 50 id=83
B 1787 50 id=83
B 1785 50 id=83
B 1785 49 id=83
B 1784 49 id=83
B 1784 50 id=83
B 1783 48 id=83
B 1790 49 id=83
R 1785 53 to=cube id=12 z=2
B 1785 56 id=83
B 1786 56 id=83
B 1784 57 id=83
B 1785 57 id=83
B 1784 58 id=83
B 1786 57 id=83
B 1787 56 id=83
B 1788 56 id=83
B 1783 58 id=83
B 1783 59 id=83
B 1783 57 id=83
B 1782 59 id=83
B 1782 58 id=83
B 1785 59 id=83
B 1786 58 id=83
B 1788 58 id=83
B 1787 60 id=83
C 1784 53 id=2063
S 1757 49.95 1 0.5 id=39
S 1758 49.95 1 0.5 id=39
B 1790 51 id=83
B 1791 51 id=83
B 1791 50 id=83
B 1792 51 id=83
B 1793 49 id=83
O 1796 54 orb=yellow id=36 z=2
O 1800 55 orb=yellow id=36 z=2
D 1807 58 1 0.2 pad=blue id=67 z=2
D 1809 61.8 1 0.2 pad=blue rot=180 id=67 z=2
O 1805 56 orb=pink id=141 col=13017343 z=2
B 1811 55 id=83
B 1812 55 id=83
B 1810 54 id=83
B 1810 55 id=83
B 1811 54 id=83
B 1813 55 id=83
B 1813 54 id=83
B 1809 54 id=83
B 1814 52 id=83
B 1814 55 id=83
B 1811 53 id=83
O 1818 56 orb=yellow id=36 z=2
B 1807 57 id=83
B 1809 62 id=83
B 1808 62 id=83
B 1807 56 id=83
B 1810 56 id=83
B 1810 62 id=83
B 1809 63 id=83
B 1808 63 id=83
B 1806 63 id=83
B 1807 63 id=83
B 1805 61 id=83
B 1804 61 id=83
D 1824 56 1 0.2 pad=blue id=67 z=2
D 1825 58.8 1 0.2 pad=blue rot=180 id=67 z=2
D 1826 57 1 0.2 pad=blue id=67 z=2
B 1824 55 id=83
B 1825 55 id=83
B 1826 55 id=83
B 1826 56 id=83
B 1827 56 id=83
B 1828 54 id=83
B 1824 54 id=83
B 1823 54 id=83
B 1826 53 id=83
B 1825 59 id=83
B 1824 59 id=83
B 1824 60 id=83
B 1826 61 id=83
B 1830 64 id=83
B 1829 64 id=83
B 1831 64 id=83
B 1830 65 id=83
B 1828 64 id=83
B 1827 64 id=83
B 1826 63 id=83
B 1829 65 id=83
B 1832 64 id=83
B 1833 64 id=83
B 1832 65 id=83
B 1834 66 id=83
O 1837 64 orb=yellow id=36 z=2
S 1827 63 rot=180 id=8
S 1828 63 rot=180 id=8
S 1827 61 rot=90 id=8
S 1823 60 rot=-90 id=8
S 1815 55 rot=90 id=8
S 1822 54 rot=-90 id=8
S 1828 56 rot=90 id=8
S 1808 57 rot=90 id=8
S 1805 60 rot=180 id=8
S 1804 60 rot=180 id=8
S 1811 62 rot=90 id=8
S 1808 54 rot=-90 id=8
G 1839 61 gd=1 id=10 z=2
D 1841 59 1 0.2 pad=blue id=67 z=2
D 1843 65.8 1 0.2 pad=blue rot=180 id=67 z=2
D 1846 62 1 0.2 pad=blue id=67 z=2
B 1841 58 id=83
B 1840 58 id=83
B 1841 57 id=83
B 1840 57 id=83
B 1839 57 id=83
B 1843 67 id=83
B 1841 66 id=83
B 1843 66 id=83
B 1842 66 id=83
B 1844 66 id=83
B 1844 67 id=83
B 1846 61 id=83
B 1845 60 id=83
B 1846 60 id=83
B 1843 57 id=83
B 1842 57 id=83
B 1848 66 id=83
B 1847 66 id=83
B 1849 66 id=83
B 1849 67 id=83
B 1848 67 id=83
B 1850 66 id=83
B 1846 68 id=83
G 1851 64 gd=1 id=10 z=2
B 1854 59 id=83
B 1853 59 id=83
B 1855 59 id=83
B 1853 58 id=83
B 1854 58 id=83
B 1852 58 id=83
O 1860 60 orb=yellow id=36 z=2
D 1866 60 1 0.2 pad=blue id=67 z=2
D 1867 62.8 1 0.2 pad=blue rot=180 id=67 z=2
B 1870 57 id=83
B 1869 57 id=83
B 1869 56 id=83
B 1868 56 id=83
B 1871 55 id=83
O 1873 59 orb=yellow id=36 z=2
D 1883 61.8 1 0.2 pad=blue rot=180 id=67 z=2
D 1882 60 1 0.2 pad=blue id=67 z=2
O 1878 60 orb=pink id=141 col=13017343 z=2
B 1883 62 id=83
B 1883 63 id=83
B 1884 62 id=83
B 1882 59 id=83
B 1881 59 id=83
B 1882 58 id=83
B 1880 58 id=83
B 1884 64 id=83
B 1867 63 id=83
B 1868 63 id=83
B 1869 63 id=83
B 1869 62 id=83
B 1870 63 id=83
B 1870 62 id=83
B 1871 63 id=83
B 1870 64 id=83
B 1872 65 id=83
B 1867 64 id=83
B 1866 64 id=83
B 1866 59 id=83
B 1865 58 id=83
B 1866 58 id=83
B 1867 57 id=83
B 1866 57 id=83
B 1867 56 id=83
B 1866 56 id=83
B 1867 58 id=83
B 1864 56 id=83
B 1864 57 id=83
B 1885 57 id=83
B 1886 57 id=83
B 1884 57 id=83
B 1885 56 id=83
B 1887 57 id=83
B 1888 57 id=83
B 1887 56 id=83
D 1888 58 1 0.2 pad=blue id=67 z=2
D 1889 59.8 1 0.2 pad=blue rot=180 id=67 z=2
B 1889 55 id=83
B 1889 60 id=83
B 1888 61 id=83
B 1889 61 id=83
B 1890 61 id=83
B 1890 60 id=83
B 1889 62 id=83
B 1887 63 id=83
B 1891 56 id=83
B 1892 56 id=83
B 1890 56 id=83
B 1890 55 id=83
B 1892 55 id=83
B 1893 56 id=83
B 1894 56 id=83
B 1895 55 id=83
B 1896 56 id=83
B 1895 56 id=83
B 1892 54 id=83
B 1897 54 id=83
B 1893 55 id=83
B 1893 54 id=83
O 1898 58 orb=yellow id=36 z=2
B 1915 57 id=83
B 1914 57 id=83
B 1913 56 id=83
B 1914 56 id=83
B 1891 54 id=83
A 1901 60 ar=green id=1704 z=2
A 1920 59 ar=green id=1704 z=2
R 1935 59 to=ship id=13 z=2
E 1912 60 art=3818 id=3818 z=3
B 1913 57 id=83
B 1912 56 id=83
W 1932.767 61.083 1.467 2.833 id=1705 z=5
W 1925.767 61.083 1.467 2.833 id=1705 z=5
W 1928.767 62.083 1.467 2.833 id=1705 z=5
W 1932.4 53.375 2.2 4.25 id=1705 z=5
W 1925.767 55.083 1.467 2.833 id=1705 z=5
W 1929.767 55.083 1.467 2.833 id=1705 z=5
B 1928 56 id=83
B 1927 57 id=83
B 1926 57 id=83
B 1928 57 id=83
B 1926 55 id=83
B 1927 56 id=83
B 1927 55 id=83
B 1928 55 id=83
B 1929 56 id=83
B 1929 55 id=83
B 1931 63 id=83
B 1930 62 id=83
B 1930 63 id=83
B 1931 62 id=83
B 1929 62 id=83
S 1929 61 rot=180 id=8
S 1930 61 rot=180 id=8
S 1931 61 rot=180 id=8
W 1921.033 52.667 2.933 5.667 id=1705 z=5
W 1921.033 61.667 2.933 5.667 id=1705 z=5
W 1924.133 61.792 0.733 1.417 id=1705 z=5
W 1903.033 53.667 2.933 5.667 id=1705 z=5
W 1911.803 56.154 1.393 2.692 id=1705 z=5
W 1906.033 62.667 2.933 5.667 id=1705 z=5
W 1904.097 62.721 0.807 1.558 id=1705 z=5
W 1913.097 62.721 0.807 1.558 id=1705 z=5
W 1914.803 61.154 1.393 2.692 id=1705 z=5
B 1918 62 id=83
B 1917 62 id=83
B 1919 62 id=83
B 1918 63 id=83
B 1917 63 id=83
B 1918 64 id=83
B 1917 65 id=83
B 1917 64 id=83
S 1917 61.55 1 0.5 rot=180 id=39
S 1918 61.55 1 0.5 rot=180 id=39
S 1919 61.55 1 0.5 rot=180 id=39
B 1916 63 id=83
B 1916 64 id=83
B 1908 56 id=83
B 1907 57 id=83
B 1908 57 id=83
B 1906 57 id=83
B 1906 56 id=83
S 1906 58 id=8
S 1907 58 id=8
S 1908 58 id=8
B 1909 56 id=83
B 1905 56 id=83
B 1904 58 id=83
B 1908 55 id=83
B 1910 55 id=83
W 1901.569 63.701 1.863 3.598 id=1705 z=5
W 1910.459 62.488 2.083 4.023 id=1705 z=5
W 1937.033 51.667 2.933 5.667 id=1705 z=5
W 1938.583 60.729 1.833 3.542 id=1705 z=5
W 1942.033 53.667 2.933 5.667 id=1705 z=5
B 1935 62 id=83
B 1936 62 id=83
B 1936 63 id=83
B 1937 62 id=83
B 1935 63 id=83
B 1937 64 id=83
B 1942 63 id=83
B 1943 64 id=83
B 1942 65 id=83
B 1943 63 id=83
B 1944 64 id=83
B 1947 57 id=83
B 1948 56 id=83
B 1947 56 id=83
B 1947 55 id=83
B 1948 55 id=83
B 1946 55 id=83
B 1946 56 id=83
B 1945 56 id=83
B 1945 55 id=83
B 1946 57 id=83
B 1946 54 id=83
B 1947 54 id=83
B 1946 53 id=83
B 1947 53 id=83
B 1948 54 id=83
B 1948 53 id=83
B 1949 53 id=83
B 1949 54 id=83
B 1950 56 id=83
B 1950 57 id=83
B 1944 53 id=83
W 1945.767 63.083 1.467 2.833 id=1705 z=5
W 1955.033 59.667 2.933 5.667 id=1705 z=5
W 1951.033 51.667 2.933 5.667 id=1705 z=5
W 1951.737 62.027 1.525 2.947 id=1705 z=5
B 1949 63 id=83
B 1950 63 id=83
B 1948 64 id=83
B 1948 63 id=83
B 1949 64 id=83
B 1949 65 id=83
B 1950 64 id=83
B 1947 66 id=83
W 1958.001 54.537 0.997 1.927 id=1705 z=5
W 1959.767 61.083 1.467 2.833 id=1705 z=5
W 1960.033 51.667 2.933 5.667 id=1705 z=5
B 1963 55 id=83
B 1964 55 id=83
B 1963 56 id=83
B 1964 56 id=83
B 1963 57 id=83
B 1964 57 id=83
B 1963 54 id=83
B 1964 54 id=83
B 1963 53 id=83
B 1962 54 id=83
B 1965 55 id=83
B 1966 53 id=83
B 1961 56 id=83
B 1963 61 id=83
B 1962 62 id=83
B 1963 63 id=83
B 1964 63 id=83
B 1964 62 id=83
B 1963 62 id=83
B 1966 61 id=83
B 1966 62 id=83
B 1966 64 id=83
B 1964 64 id=83
B 1965 63 id=83
B 1964 61 id=83
S 1967 61 rot=90 id=8
S 1965 56 rot=90 id=8
S 1965 57 rot=90 id=8
W 1972.033 56.667 2.933 5.667 id=1705 z=5
W 1968.767 59.083 1.467 2.833 id=1705 z=5
W 1968.767 52.083 1.467 2.833 id=1705 z=5
W 1955.371 51.318 2.259 4.363 id=1705 z=5
W 1976.033 59.667 2.933 5.667 id=1705 z=5
W 1971.033 61.667 2.933 5.667 id=1705 z=5
D 1870 57.967 1 0.2 pad=pink id=140 z=2
G 1972 55 gd=-1 id=11 z=2
W 1978.576 52.715 1.848 3.57 id=1705 z=5
W 1981.444 54.46 2.112 4.08 id=1705 z=5
W 1936.767 52.083 1.467 2.833 id=1705 z=5
S 1946 58 id=8
S 1947 58 id=8
S 1950 58 id=8
S 1948 62 rot=180 id=8
S 1949 62 rot=180 id=8
S 1950 62 rot=180 id=8
S 1943 62 rot=180 id=8
S 1942 62 rot=180 id=8
S 1935 61 rot=180 id=8
S 1936 61 rot=180 id=8
S 1937 61 rot=180 id=8
S 1948 57 id=8
S 1949 57 rot=-90 id=8
S 1951 57 rot=90 id=8
S 1962 61 rot=180 id=8
S 1966 55 rot=90 id=8
W 1980.767 62.083 1.467 2.833 id=1705 z=5
W 1986.033 52.667 2.933 5.667 id=1705 z=5
W 1990.495 62.559 2.009 3.882 id=1705 z=5
B 1987 62 id=83
B 1987 63 id=83
B 1985 63 id=83
B 1986 63 id=83
B 1986 62 id=83
B 1986 64 id=83
B 1988 63 id=83
B 1989 63 id=83
B 1990 64 id=83
B 1984 57 id=83
B 1985 57 id=83
B 1984 58 id=83
B 1984 56 id=83
B 1983 56 id=83
B 1983 57 id=83
B 1983 55 id=83
B 1982 55 id=83
B 1991 56 id=83
B 1992 55 id=83
B 1991 55 id=83
B 1992 56 id=83
B 1990 56 id=83
B 1990 55 id=83
B 1989 58 id=83
B 1991 57 id=83
B 1991 58 id=83
B 1990 58 id=83
B 1988 56 id=83
W 1984.231 62.049 2.537 4.902 id=1705 z=5
S 1988 62 rot=180 id=8
S 1989 62 rot=180 id=8
W 1995.363 61.304 2.273 4.392 id=1705 z=5
G 1995 59 gd=1 id=10 z=2
W 1991.503 53.573 1.995 3.853 id=1705 z=5
W 2000.767 63.083 1.467 2.833 id=1705 z=5
B 2000 57 id=83
B 1999 56 id=83
B 2001 56 id=83
B 2000 56 id=83
B 1999 55 id=83
B 1998 56 id=83
B 2001 54 id=83
B 2002 54 id=83
W 2004.033 51.667 2.933 5.667 id=1705 z=5
W 2006.224 62.035 2.552 4.93 id=1705 z=5
B 2004 63 id=83
B 2002 63 id=83
B 2003 63 id=83
B 2003 62 id=83
B 2002 64 id=83
B 2004 65 id=83
B 2005 65 id=83
W 1998.664 60.885 1.672 3.23 id=1705 z=5
W 1992.862 61.268 1.276 2.465 id=1705 z=5
W 1995.033 51.667 2.933 5.667 id=1705 z=5
W 2000.481 53.531 2.039 3.938 id=1705 z=5
R 2013 59 to=wave id=660 z=2
W 2008.664 53.885 1.672 3.23 id=1705 z=5
W 2009.767 61.083 1.467 2.833 id=1705 z=5
W 2010.928 55.395 1.144 2.21 id=1705 z=5
S 2002 62 rot=180 id=8
S 2004 62 rot=180 id=8
S 2003 61 rot=180 id=8
B 2012 62 id=83
B 2013 62 id=83
B 2014 62 id=83
B 2013 63 id=83
B 2012 63 id=83
B 2013 64 id=83
B 2014 63 id=83
B 2011 64 id=83
B 2013 56 id=83
B 2012 55 id=83
B 2014 56 id=83
B 2012 56 id=83
B 2013 55 id=83
B 2011 55 id=83
B 2014 54 id=83
B 2015 54 id=83
W 2018.033 59.667 2.933 5.667 id=1705 z=5
W 2017.363 52.304 2.273 4.392 id=1705 z=5
W 2026.517 52.602 1.965 3.797 id=1705 z=5
W 2022.525 60.616 1.951 3.768 id=1705 z=5
W 2029.033 61.667 2.933 5.667 id=1705 z=5
W 2030.517 52.602 1.965 3.797 id=1705 z=5
W 2033.767 56.083 1.467 2.833 id=1705 z=5
W 2035.429 62.432 2.141 4.137 id=1705 z=5
W 2037.451 54.474 2.097 4.052 id=1705 z=5
W 2044.407 59.389 2.185 4.222 id=1705 z=5
W 2040.033 51.667 2.933 5.667 id=1705 z=5
W 2047.767 57.083 1.467 2.833 id=1705 z=5
W 2044.767 53.083 1.467 2.833 id=1705 z=5
W 2022.767 52.083 1.467 2.833 id=1705 z=5
B 2020 53 id=83
B 2019 54 id=83
B 2019 53 id=83
B 2020 54 id=83
B 2021 53 id=83
B 2027 53 id=83
B 2027 54 id=83
B 2026 54 id=83
B 2028 53 id=83
B 2028 54 id=83
B 2029 54 id=83
B 2024 53 id=83
B 2020 60 id=83
B 2021 60 id=83
B 2020 62 id=83
B 2020 61 id=83
B 2022 62 id=83
B 2022 61 id=83
B 2030 63 id=83
B 2032 64 id=83
B 2030 65 id=83
B 2031 63 id=83
B 2032 63 id=83
B 2031 64 id=83
B 2033 65 id=83
B 2036 55 id=83
B 2035 55 id=83
B 2035 56 id=83
B 2034 56 id=83
B 2034 57 id=83
B 2036 56 id=83
B 2037 56 id=83
B 2038 56 id=83
B 2038 55 id=83
B 2037 55 id=83
B 2034 55 id=83
B 2034 54 id=83
B 2033 54 id=83
B 2037 54 id=83
B 2037 53 id=83
B 2038 53 id=83
B 2040 54 id=83
B 2046 60 id=83
B 2047 61 id=83
B 2046 61 id=83
B 2047 59 id=83
B 2047 60 id=83
B 2048 59 id=83
B 2049 58 id=83
B 2048 58 id=83
B 2048 60 id=83
B 2050 60 id=83
B 2050 61 id=83
B 2045 61 id=83
B 2045 62 id=83
B 2047 63 id=83
B 2048 63 id=83
B 2048 61 id=83
B 2047 62 id=83
B 2045 60 id=83
S 2016 54 rot=90 id=8
S 2025 54 rot=-90 id=8
S 2030 62 rot=-180 id=8
S 2031 62 rot=-180 id=8
S 2032 62 rot=-180 id=8
S 2020 59 rot=-180 id=8
S 2021 59 rot=-180 id=8
S 2015 62 rot=-270 id=8
S 2015 63 rot=-270 id=8
W 2025.532 59.63 1.936 3.74 id=1705 z=5
W 2040.033 60.667 2.933 5.667 id=1705 z=5
W 2053.767 55.083 1.467 2.833 id=1705 z=5
W 2051.033 50.667 2.933 5.667 id=1705 z=5
W 2056.033 50.667 2.933 5.667 id=1705 z=5
W 2050.767 60.083 1.467 2.833 id=1705 z=5
B 2048 53 id=83
B 2049 53 id=83
B 2046 53 id=83
B 2047 53 id=83
B 2048 52 id=83
B 2047 52 id=83
B 2049 54 id=83
B 2050 54 id=83
B 2050 53 id=83
W 2052.385 61.347 2.229 4.307 id=1705 z=5
R 2055 60 to=cube id=12 z=2
B 2056 57 id=83
B 2056 58 id=83
B 2057 56 id=83
B 2057 55 id=83
B 2058 55 id=83
B 2058 56 id=83
B 2057 57 id=83
B 2057 58 id=83
B 2058 57 id=83
B 2059 57 id=83
B 2058 58 id=83
B 2059 58 id=83
B 2055 57 id=83
B 2055 55 id=83
B 2060 57 id=83
B 2059 56 id=83
V 2057 60 spd=0 id=200 z=2
D 2059 59 1 0.2 pad=blue id=67 z=2
D 2060 64.8 1 0.2 pad=blue rot=180 id=67 z=2
B 2060 65 id=83
B 2059 65 id=83
B 2058 65 id=83
B 2060 66 id=83
B 2061 66 id=83
B 2061 65 id=83
B 2057 67 id=83
B 2058 67 id=83
B 2062 66 id=83
B 2063 55 id=83
B 2064 55 id=83
B 2064 54 id=83
B 2063 54 id=83
B 2065 55 id=83
B 2062 55 id=83
B 2066 55 id=83
B 2067 54 id=83
B 2067 55 id=83
B 2068 55 id=83
B 2068 54 id=83
B 2069 55 id=83
B 2070 55 id=83
B 2071 55 id=83
B 2071 54 id=83
B 2072 55 id=83
B 2072 54 id=83
B 2073 55 id=83
B 2067 53 id=83
B 2069 53 id=83
B 2072 53 id=83
B 2073 53 id=83
B 2064 53 id=83
B 2061 53 id=83
B 2062 52 id=83
B 2061 52 id=83
B 2075 56 id=83
B 2076 56 id=83
B 2076 55 id=83
B 2077 55 id=83
B 2077 56 id=83
B 2078 55 id=83
B 2078 56 id=83
B 2079 55 id=83
B 2079 56 id=83
B 2081 56 id=83
B 2080 55 id=83
B 2080 56 id=83
B 2077 54 id=83
B 2076 54 id=83
B 2080 54 id=83
G 2085 55 gd=-1 rot=90 id=11 z=2
B 2088 60 id=83
B 2089 61 id=83
B 2088 61 id=83
B 2090 60 id=83
B 2082 62 id=83
B 2083 62 id=83
B 2083 61 id=83
B 2082 61 id=83
B 2080 62 id=83
B 2081 62 id=83
B 2080 61 id=83
B 2079 61 id=83
B 2081 61 id=83
B 2085 63 id=83
B 2077 62 id=83
B 2076 63 id=83
B 2081 63 id=83
B 2078 61 id=83
B 2078 62 id=83
B 2077 63 id=83
B 2075 62 id=83
B 2084 61 id=83
B 2079 64 id=83
B 2078 64 id=83
B 2071 61 id=83
B 2070 61 id=83
B 2070 60 id=83
B 2068 60 id=83
B 2069 60 id=83
B 2067 60 id=83
B 2066 60 id=83
B 2065 61 id=83
B 2064 62 id=83
B 2066 62 id=83
B 2066 61 id=83
B 2067 61 id=83
B 2069 62 id=83
B 2070 62 id=83
B 2072 63 id=83
B 2072 60 id=83
S 2074 55 rot=90 id=8
S 2073 60 rot=90 id=8
S 2074 62 rot=-90 id=8
S 2072 61 rot=90 id=8
S 2073 63 rot=90 id=8
S 2077 61 rot=-180 id=8
S 2078 60 rot=-180 id=8
S 2079 60 rot=-180 id=8
S 2067 59 rot=-180 id=8
S 2069 59 rot=-180 id=8
S 2064 52 rot=-180 id=8
S 2067 52 rot=-180 id=8
S 2078 54 rot=-180 id=8
S 2086 63 rot=-270 id=8
S 2087 61 rot=-90 id=8
S 2087 60 rot=-90 id=8
S 2085 61 rot=90 id=8
S 2082 56 rot=90 id=8
S 2084 60 rot=180 id=8
B 2091 60 id=83
B 2093 60 id=83
D 2090 59.8 1 0.2 pad=blue rot=180 id=67 z=2
D 2091 55 1 0.2 pad=blue id=67 z=2
B 2091 54 id=83
B 2090 54 id=83
B 2092 54 id=83
B 2090 53 id=83
B 2088 54 id=83
B 2089 54 id=83
B 2091 53 id=83
B 2093 52 id=83
S 2087 54 rot=-90 id=8
S 2093 54 rot=90 id=8
S 2094 52 rot=90 id=8
B 2092 62 id=83
B 2094 60 id=83
B 2094 61 id=83
B 2095 61 id=83
B 2095 60 id=83
B 2096 60 id=83
B 2097 60 id=83
B 2096 61 id=83
B 2098 61 id=83
B 2097 61 id=83
B 2097 62 id=83
B 2099 63 id=83
B 2096 54 id=83
B 2097 54 id=83
B 2096 53 id=83
B 2098 53 id=83
B 2098 54 id=83
B 2099 54 id=83
B 2100 53 id=83
B 2095 54 id=83
S 2094 54 rot=-90 id=8
S 2095 53 rot=-90 id=8
S 2092 61 rot=-180 id=8
B 2101 59 id=83
B 2102 59 id=83
B 2101 60 id=83
B 2101 53 id=83
B 2106 59 id=83
B 2107 59 id=83
B 2108 59 id=83
B 2100 59 id=83
B 2102 60 id=83
B 2103 59 id=83
B 2103 61 id=83
D 2106 58.8 1 0.2 pad=blue rot=180 id=67 z=2
B 2104 52 id=83
B 2104 53 id=83
B 2103 52 id=83
B 2105 52 id=83
B 2106 52 id=83
B 2107 52 id=83
B 2106 53 id=83
B 2107 53 id=83
B 2108 52 id=83
D 2107 54 1 0.2 pad=blue id=67 z=2
D 2109 57.8 1 0.2 pad=blue rot=180 id=67 z=2
B 2109 58 id=83
B 2108 58 id=83
B 2109 52 id=83
B 2105 51 id=83
B 2109 51 id=83
B 2109 53 id=83
B 2111 53 id=83
B 2110 53 id=83
S 2099 59 rot=-90 id=8
S 2105 59 rot=-90 id=8
S 2104 59 rot=90 id=8
S 2102 52 rot=-90 id=8
S 2099 61 rot=-270 id=8
B 2112 53 id=83
B 2111 52 id=83
B 2113 53 id=83
B 2114 53 id=83
B 2116 52 id=83
B 2116 53 id=83
B 2115 53 id=83
B 2117 52 id=83
B 2117 51 id=83
B 2112 51 id=83
B 2112 52 id=83
B 2115 52 id=83
B 2114 52 id=83
B 2114 51 id=83
B 2113 52 id=83
B 2117 53 id=83
B 2119 53 id=83
B 2120 53 id=83
B 2121 53 id=83
B 2118 53 id=83
B 2120 52 id=83
B 2119 52 id=83
B 2118 52 id=83
B 2119 51 id=83
B 2120 51 id=83
B 2114 58 id=83
B 2116 58 id=83
B 2117 58 id=83
B 2119 58 id=83
B 2120 58 id=83
B 2117 60 id=83
B 2118 59 id=83
B 2116 59 id=83
B 2114 59 id=83
B 2117 59 id=83
B 2115 59 id=83
B 2115 58 id=83
B 2121 60 id=83
B 2122 60 id=83
B 2112 60 id=83
B 2123 52 id=83
B 2123 51 id=83
B 2124 52 id=83
B 2124 53 id=83
B 2125 53 id=83
B 2127 52 id=83
B 2125 52 id=83
B 2126 53 id=83
B 2128 53 id=83
B 2127 53 id=83
B 2128 52 id=83
B 2128 51 id=83
B 2129 53 id=83
B 2129 52 id=83
B 2129 51 id=83
B 2130 53 id=83
B 2126 58 id=83
B 2127 58 id=83
B 2124 58 id=83
B 2125 59 id=83
B 2125 58 id=83
B 2126 59 id=83
B 2127 59 id=83
B 2129 58 id=83
B 2128 58 id=83
B 2128 59 id=83
B 2130 58 id=83
B 2132 59 id=83
B 2131 60 id=83
B 2126 60 id=83
B 2125 61 id=83
B 2124 61 id=83
B 2133 59 id=83
B 2134 60 id=83
B 2133 61 id=83
B 2134 59 id=83
B 2134 61 id=83
B 2133 60 id=83
B 2135 59 id=83
B 2136 60 id=83
B 2135 60 id=83
B 2137 61 id=83
B 2137 60 id=83
B 2138 60 id=83
B 2137 59 id=83
B 2136 59 id=83
B 2138 59 id=83
B 2131 61 id=83
B 2139 59 id=83
B 2140 59 id=83
B 2141 60 id=83
B 2140 60 id=83
B 2141 59 id=83
B 2140 61 id=83
B 2142 60 id=83
B 2144 60 id=83
B 2143 60 id=83
B 2143 61 id=83
B 2144 61 id=83
B 2144 59 id=83
B 2142 59 id=83
B 2143 59 id=83
B 2135 54 id=83
B 2136 54 id=83
B 2137 54 id=83
B 2138 54 id=83
B 2139 54 id=83
B 2142 54 id=83
B 2143 54 id=83
B 2140 54 id=83
B 2139 53 id=83
B 2138 53 id=83
B 2137 53 id=83
B 2135 51 id=83
B 2135 52 id=83
B 2142 53 id=83
B 2142 52 id=83
B 2139 52 id=83
S 2134 54 rot=-90 id=8
S 2134 52 rot=-90 id=8
S 2134 51 rot=-90 id=8
S 2131 53 rot=90 id=8
S 2133 51 id=8
B 2133 50 id=83
B 2132 50 id=83
S 2132 51 id=8
S 2131 59 rot=180 id=8
S 2122 59 rot=180 id=8
S 2121 59 rot=180 id=8
S 2122 53 rot=90 id=8
S 2123 53 rot=270 id=8
S 2123 58 rot=270 id=8
S 2113 58 rot=270 id=8
S 2116 57 rot=180 id=8
S 2097 55 id=8
S 2100 54 id=8
S 2104 54 id=8
S 2125 57 rot=180 id=8
S 2128 57 rot=180 id=8
S 2137 55 id=8
S 2139 55 id=8
S 2143 55 id=8
D 2145 58.8 1 0.2 pad=blue rot=180 id=67 z=2
D 2146 55 1 0.2 pad=blue id=67 z=2
D 2147 57.8 1 0.2 pad=blue rot=180 id=67 z=2
D 2148 54 1 0.2 pad=blue id=67 z=2
D 2150 59.8 1 0.2 pad=blue rot=180 id=67 z=2
D 2151 56 1 0.2 pad=blue id=67 z=2
D 2152 58.8 1 0.2 pad=blue rot=180 id=67 z=2
D 2153 55 1 0.2 pad=blue id=67 z=2
D 2156 63.8 1 0.2 pad=blue rot=180 id=67 z=2
D 2157 60 1 0.2 pad=blue id=67 z=2
D 2158 62.8 1 0.2 pad=blue rot=180 id=67 z=2
D 2159 59 1 0.2 pad=blue id=67 z=2
D 2162 68.8 1 0.2 pad=blue rot=-180 id=67 z=2
D 2163 65 1 0.2 pad=blue id=67 z=2
D 2164 67.8 1 0.2 pad=blue rot=180 id=67 z=2
D 2165 64 1 0.2 pad=blue id=67 z=2
B 2146 54 id=83
B 2145 54 id=83
B 2145 53 id=83
B 2144 52 id=83
B 2147 53 id=83
B 2148 53 id=83
B 2145 59 id=83
B 2147 58 id=83
B 2146 59 id=83
B 2146 61 id=83
B 2147 61 id=83
B 2147 60 id=83
B 2150 60 id=83
B 2149 61 id=83
B 2151 60 id=83
B 2152 59 id=83
B 2152 60 id=83
B 2151 55 id=83
B 2150 54 id=83
B 2153 54 id=83
B 2152 54 id=83
B 2153 53 id=83
B 2151 53 id=83
B 2151 54 id=83
B 2146 53 id=83
B 2147 52 id=83
B 2157 58 id=83
B 2157 59 id=83
B 2158 58 id=83
B 2159 58 id=83
B 2156 58 id=83
B 2156 64 id=83
B 2155 64 id=83
B 2155 65 id=83
B 2158 64 id=83
B 2158 63 id=83
B 2157 64 id=83
B 2158 65 id=83
B 2157 57 id=83
S 2154 54 rot=90 id=8
S 2156 57 rot=-90 id=8
S 2157 56 rot=-180 id=8
S 2149 54 rot=-90 id=8
S 2148 60 rot=-270 id=8
S 2153 60 rot=-270 id=8
S 2141 54 rot=-270 id=8
S 2144 53 id=8
S 2160 58 rot=90 id=8
S 2159 64 rot=90 id=8
S 2154 64 rot=270 id=8
B 2161 69 id=83
B 2162 69 id=83
B 2164 68 id=83
B 2163 69 id=83
B 2164 69 id=83
B 2163 64 id=83
B 2165 63 id=83
B 2163 63 id=83
B 2164 63 id=83
B 2162 63 id=83
B 2162 62 id=83
B 2164 62 id=83
B 2166 61 id=83
B 2165 70 id=83
B 2167 70 id=83
B 2168 70 id=83
B 2167 71 id=83
B 2168 71 id=83
B 2166 71 id=83
B 2169 70 id=83
B 2170 70 id=83
B 2171 70 id=83
B 2170 71 id=83
B 2171 72 id=83
B 2172 70 id=83
B 2173 70 id=83
B 2173 71 id=83
B 2172 71 id=83
B 2171 71 id=83
B 2174 71 id=83
B 2174 70 id=83
B 2175 70 id=83
B 2175 71 id=83
B 2173 72 id=83
B 2175 73 id=83
B 2176 73 id=83
B 2169 64 id=83
B 2171 64 id=83
B 2170 65 id=83
B 2172 65 id=83
B 2173 65 id=83
B 2171 65 id=83
B 2174 64 id=83
B 2176 64 id=83
B 2175 65 id=83
B 2172 63 id=83
B 2173 63 id=83
B 2175 62 id=83
S 2170 66 id=8
S 2175 66 id=8
B 2176 70 id=83
B 2177 70 id=83
B 2177 71 id=83
B 2178 71 id=83
B 2178 70 id=83
B 2179 70 id=83
B 2180 70 id=83
B 2179 71 id=83
B 2181 71 id=83
B 2182 70 id=83
B 2179 73 id=83
B 2180 71 id=83
B 2183 72 id=83
A 2179 69 rot=180 ar=purple tp=1 id=3004 z=2
B 2179 65 id=83
B 2178 65 id=83
B 2179 64 id=83
B 2180 65 id=83
B 2180 64 id=83
B 2181 65 id=83
B 2182 64 id=83
B 2182 65 id=83
S 2180 69 rot=180 id=8
S 2182 69 rot=180 id=8
S 2183 70 rot=90 id=8
B 2183 65 id=83
B 2183 64 id=83
B 2184 65 id=83
B 2184 64 id=83
B 2185 65 id=83
B 2187 64 id=83
B 2186 65 id=83
B 2187 65 id=83
B 2188 65 id=83
B 2188 64 id=83
B 2189 65 id=83
B 2191 65 id=83
B 2189 64 id=83
B 2190 65 id=83
B 2192 65 id=83
B 2191 64 id=83
B 2182 63 id=83
B 2187 62 id=83
B 2187 63 id=83
B 2188 63 id=83
B 2181 62 id=83
B 2185 63 id=83
B 2190 62 id=83
B 2195 66 id=83
B 2196 65 id=83
B 2194 66 id=83
B 2195 65 id=83
B 2198 67 id=83
B 2199 67 id=83
B 2199 66 id=83
B 2198 65 id=83
B 2188 70 id=83
B 2190 71 id=83
B 2189 72 id=83
B 2192 72 id=83
B 2191 71 id=83
B 2191 72 id=83
B 2193 72 id=83
B 2194 73 id=83
B 2195 73 id=83
B 2196 73 id=83
B 2195 72 id=83
B 2193 73 id=83
B 2194 72 id=83
B 2193 74 id=83
B 2190 74 id=83
B 2191 74 id=83
B 2197 73 id=83
B 2197 74 id=83
B 2198 74 id=83
B 2199 74 id=83
B 2199 73 id=83
B 2195 75 id=83
B 2198 73 id=83
B 2196 75 id=83
B 2201 74 id=83
B 2201 73 id=83
B 2200 74 id=83
B 2203 74 id=83
B 2202 75 id=83
A 2132 55 ar=purple tp=1 id=3004 z=2
B 2201 67 id=83
B 2201 66 id=83
B 2202 67 id=83
B 2202 66 id=83
B 2203 67 id=83
B 2202 73 id=83
B 2203 73 id=83
D 2201 68 1 0.2 pad=blue id=67 z=2
D 2203 72.8 1 0.2 pad=purple rot=180 tp=1 id=3005 z=2
B 2204 67 id=83
B 2205 66 id=83
B 2205 67 id=83
B 2206 66 id=83
B 2203 64 id=83
B 2206 65 id=83
B 2206 67 id=83
B 2207 67 id=83
B 2207 66 id=83
B 2208 67 id=83
B 2209 66 id=83
B 2209 67 id=83
B 2209 64 id=83
B 2211 67 id=83
B 2212 67 id=83
B 2210 67 id=83
B 2210 66 id=83
B 2212 66 id=83
B 2213 66 id=83
B 2213 67 id=83
B 2215 67 id=83
B 2215 66 id=83
B 2214 66 id=83
B 2214 67 id=83
B 2216 67 id=83
B 2209 65 id=83
B 2211 64 id=83
B 2213 64 id=83
B 2212 64 id=83
B 2213 65 id=83
B 2217 65 id=83
B 2208 72 id=83
B 2210 71 id=83
B 2209 72 id=83
B 2210 72 id=83
B 2211 71 id=83
B 2212 72 id=83
B 2213 71 id=83
B 2211 72 id=83
B 2210 73 id=83
B 2206 73 id=83
B 2214 73 id=83
S 2188 69 rot=180 id=8
S 2191 70 rot=180 id=8
S 2195 71 rot=180 id=8
S 2197 72 rot=180 id=8
S 2200 73 rot=180 id=8
S 2206 72 rot=180 id=8
S 2197 65 rot=90 id=8
S 2193 65 rot=90 id=8
S 2201 65 rot=180 id=8
S 2200 66 rot=270 id=8
S 2183 63 rot=180 id=8
S 2177 64 rot=90 id=8
S 2179 63 rot=180 id=8
S 2206 64 rot=180 id=8
S 2208 71 rot=180 id=8
S 2214 71 rot=90 id=8
S 2204 73 rot=90 id=8
S 2205 73 rot=270 id=8
S 2207 72 rot=270 id=8
B 2218 67 id=83
B 2219 67 id=83
B 2219 66 id=83
B 2220 67 id=83
B 2220 66 id=83
B 2222 67 id=83
B 2221 67 id=83
B 2221 66 id=83
B 2223 66 id=83
D 2218 68 1 0.2 pad=blue id=67 z=2
D 2219 71.8 1 0.2 pad=blue rot=180 id=67 z=2
D 2221 68 1 0.2 pad=blue id=67 z=2
D 2224 72.8 1 0.2 pad=blue rot=180 id=67 z=2
B 2219 72 id=83
B 2220 72 id=83
B 2221 72 id=83
B 2222 73 id=83
B 2224 73 id=83
B 2223 73 id=83
B 2221 73 id=83
B 2219 74 id=83
B 2218 74 id=83
B 2222 74 id=83
B 2223 74 id=83
B 2223 67 id=83
B 2224 66 id=83
B 2224 67 id=83
B 2225 66 id=83
B 2225 67 id=83
B 2218 72 id=83
B 2217 74 id=83
S 2217 72 rot=-90 id=8
S 2222 75 id=8
S 2221 65 rot=180 id=8
S 2223 65 rot=180 id=8
S 2217 64 rot=180 id=8
S 2225 73 rot=90 id=8
B 2226 67 id=83
B 2227 67 id=83
A 2227 68 ar=purple tp=1 id=3004 z=2
B 2228 65 id=83
B 2227 73 id=83
B 2228 73 id=83
B 2227 74 id=83
B 2228 74 id=83
B 2229 73 id=83
B 2226 74 id=83
B 2230 73 id=83
B 2229 74 id=83
B 2231 73 id=83
B 2232 73 id=83
B 2230 74 id=83
B 2231 74 id=83
B 2233 74 id=83
B 2233 73 id=83
B 2234 73 id=83
B 2235 74 id=83
B 2235 73 id=83
B 2236 74 id=83
B 2236 73 id=83
B 2237 73 id=83
B 2238 74 id=83
B 2237 74 id=83
B 2238 73 id=83
B 2239 73 id=83
B 2230 69 id=83
B 2232 68 id=83
B 2232 69 id=83
B 2234 69 id=83
B 2236 68 id=83
B 2235 69 id=83
B 2237 69 id=83
B 2239 69 id=83
B 2239 68 id=83
B 2240 69 id=83
B 2234 68 id=83
B 2235 68 id=83
B 2233 67 id=83
S 2231 68 rot=-90 id=8
S 2237 68 rot=-180 id=8
S 2239 67 rot=-180 id=8
S 2240 73 rot=-270 id=8
B 2229 75 id=83
B 2236 75 id=83
B 2237 75 id=83
S 2229 69 rot=-90 id=8
S 2230 70 id=8
S 2229 65 rot=90 id=8
S 2228 67 rot=90 id=8
S 2238 69 rot=-90 id=8
S 2237 70 id=8
B 2242 73 id=83
B 2243 73 id=83
B 2244 73 id=83
B 2245 73 id=83
B 2246 73 id=83
B 2248 73 id=83
B 2247 73 id=83
B 2249 73 id=83
B 2250 73 id=83
B 2245 68 id=83
B 2243 68 id=83
B 2244 68 id=83
B 2246 68 id=83
B 2247 68 id=83
B 2248 67 id=83
B 2247 67 id=83
B 2246 67 id=83
B 2243 66 id=83
B 2242 66 id=83
B 2241 66 id=83
B 2249 69 id=83
B 2244 74 id=83
B 2244 75 id=83
B 2241 75 id=83
B 2247 74 id=83
B 2249 74 id=83
B 2246 74 id=83
B 2247 75 id=83
B 2248 75 id=83
B 2248 74 id=83
B 2251 76 id=83
B 2251 75 id=83
G 2251 71 gd=1 id=10 z=2
H 2251 69 fm=corner id=469
H 2251.002 68 0.05 1 rot=-90 fm=edge id=468
H 2251.002 67 0.05 1 rot=-90 fm=edge id=468
H 2251.002 66 0.05 1 rot=-90 fm=edge id=468
H 2251.002 65 0.05 1 rot=-90 fm=edge id=468
H 2251.002 64 0.05 1 rot=-90 fm=edge id=468
H 2251.002 63 0.05 1 rot=-90 fm=edge id=468
H 2252 69.95 1 0.05 fm=edge id=468
H 2253 69.95 1 0.05 fm=edge id=468
H 2254 69.95 1 0.05 fm=edge id=468
H 2255 69.95 1 0.05 fm=edge id=468
H 2256 69.95 1 0.05 fm=edge id=468
H 2257 69.95 1 0.05 fm=edge id=468
H 2258 69.95 1 0.05 fm=edge id=468
H 2260 69.95 1 0.05 fm=edge id=468
H 2261 69.95 1 0.05 fm=edge id=468
H 2262 69.95 1 0.05 fm=edge id=468
H 2259 69.95 1 0.05 fm=edge id=468
R 2258 71 to=spider id=1331 z=2
H 2263 69 rot=90 fm=corner id=469
H 2263.948 68 0.05 1 rot=90 fm=edge id=468
H 2263.948 67 0.05 1 rot=90 fm=edge id=468
H 2263.948 66 0.05 1 rot=90 fm=edge id=468
H 2263.948 65 0.05 1 rot=90 fm=edge id=468
H 2263.948 64 0.05 1 rot=90 fm=edge id=468
H 2263.948 63 0.05 1 rot=90 fm=edge id=468
H 2262 74 rot=-90 fm=corner id=469
H 2264 74 1 0.05 rot=180 fm=edge id=468
H 2265 74 1 0.05 rot=180 fm=edge id=468
H 2262.002 75 0.05 1 rot=270 fm=edge id=468
H 2262.002 76 0.05 1 rot=270 fm=edge id=468
H 2262.002 77 0.05 1 rot=270 fm=edge id=468
H 2262.002 78 0.05 1 rot=270 fm=edge id=468
H 2262.002 79 0.05 1 rot=270 fm=edge id=468
C 2056 60 id=2063
E 2256 71 art=3848 id=3848 z=3
H 2263 74 1 0.05 rot=180 fm=edge id=468
H 2266 74 rot=-180 fm=corner id=469
H 2266.948 75 0.05 1 rot=90 fm=edge id=468
H 2266.948 76 0.05 1 rot=90 fm=edge id=468
H 2266.948 77 0.05 1 rot=90 fm=edge id=468
H 2266.948 79 0.05 1 rot=90 fm=edge id=468
H 2266.948 78 0.05 1 rot=90 fm=edge id=468
H 2265 69 fm=corner id=469
H 2265.002 67 0.05 1 rot=-90 fm=edge id=468
H 2265.002 68 0.05 1 rot=-90 fm=edge id=468
H 2265.002 66 0.05 1 rot=-90 fm=edge id=468
H 2265.002 65 0.05 1 rot=-90 fm=edge id=468
H 2265.002 64 0.05 1 rot=-90 fm=edge id=468
H 2265.002 63 0.05 1 rot=-90 fm=edge id=468
H 2267 69.95 1 0.05 fm=edge id=468
H 2268 69.95 1 0.05 fm=edge id=468
H 2266 69.95 1 0.05 fm=edge id=468
H 2269 74 rot=-90 fm=corner id=469
H 2270 74 1 0.05 rot=180 fm=edge id=468
H 2269.002 75 0.05 1 rot=-90 fm=edge id=468
H 2269.002 76 0.05 1 rot=-90 fm=edge id=468
H 2269.002 77 0.05 1 rot=-90 fm=edge id=468
H 2269.002 78 0.05 1 rot=-90 fm=edge id=468
H 2269.002 79 0.05 1 rot=-90 fm=edge id=468
H 2271 74 1 0.05 rot=-180 fm=edge id=468
H 2269 69 rot=90 fm=corner id=469
H 2269.948 68 0.05 1 rot=90 fm=edge id=468
H 2269.948 66 0.05 1 rot=90 fm=edge id=468
H 2269.948 64 0.05 1 rot=90 fm=edge id=468
H 2269.948 67 0.05 1 rot=90 fm=edge id=468
H 2269.948 65 0.05 1 rot=90 fm=edge id=468
H 2269.948 63 0.05 1 rot=90 fm=edge id=468
H 2271 69 fm=corner id=469
H 2271.002 68 0.05 1 rot=-90 fm=edge id=468
H 2271.002 67 0.05 1 rot=-90 fm=edge id=468
H 2271.002 66 0.05 1 rot=-90 fm=edge id=468
H 2271.002 65 0.05 1 rot=-90 fm=edge id=468
H 2271.002 64 0.05 1 rot=-90 fm=edge id=468
H 2271.002 63 0.05 1 rot=-90 fm=edge id=468
H 2272 69.95 1 0.05 fm=edge id=468
H 2273 69.95 1 0.05 fm=edge id=468
H 2274 69.95 1 0.05 fm=edge id=468
H 2272 74 1 0.05 rot=180 fm=edge id=468
H 2273 74 1 0.05 rot=180 fm=edge id=468
H 2275 74 rot=-180 fm=corner id=469
H 2275.948 75 0.05 1 rot=-270 fm=edge id=468
H 2275.948 76 0.05 1 rot=-270 fm=edge id=468
H 2275.948 77 0.05 1 rot=-270 fm=edge id=468
H 2275.948 78 0.05 1 rot=-270 fm=edge id=468
H 2275.948 79 0.05 1 rot=-270 fm=edge id=468
S 2273.75 70.144 1 0.063 id=392
S 2272.25 73.794 1 0.063 rot=180 id=392
H 2274 74 1 0.05 rot=180 fm=edge id=468
H 2275 69.95 1 0.05 fm=edge id=468
H 2276 69.95 1 0.05 fm=edge id=468
H 2277 69.95 1 0.05 fm=edge id=468
H 2278 69.95 1 0.05 fm=edge id=468
H 2279 69.95 1 0.05 fm=edge id=468
H 2280 69.95 1 0.05 fm=edge id=468
H 2281 69.95 1 0.05 fm=edge id=468
H 2282 69.95 1 0.05 fm=edge id=468
H 2283 69.95 1 0.05 fm=edge id=468
H 2284 69.95 1 0.05 fm=edge id=468
H 2285 69.95 1 0.05 fm=edge id=468
H 2286 69 rot=90 fm=corner id=469
H 2286.948 67 0.05 1 rot=90 fm=edge id=468
H 2286.948 68 0.05 1 rot=90 fm=edge id=468
H 2286.948 65 0.05 1 rot=90 fm=edge id=468
H 2286.948 66 0.05 1 rot=90 fm=edge id=468
H 2286.948 64 0.05 1 rot=90 fm=edge id=468
H 2286.948 63 0.05 1 rot=90 fm=edge id=468
H 2286 74 rot=-90 fm=corner id=469
H 2286.002 75 0.05 1 rot=270 fm=edge id=468
H 2286.002 76 0.05 1 rot=270 fm=edge id=468
H 2286.002 78 0.05 1 rot=270 fm=edge id=468
H 2286.002 79 0.05 1 rot=270 fm=edge id=468
H 2286.002 77 0.05 1 rot=270 fm=edge id=468
H 2287 74 1 0.05 rot=180 fm=edge id=468
H 2288 74 1 0.05 rot=180 fm=edge id=468
H 2289 74 rot=180 fm=corner id=469
H 2289.948 75 0.05 1 rot=-270 fm=edge id=468
H 2289.948 76 0.05 1 rot=-270 fm=edge id=468
H 2289.948 77 0.05 1 rot=-270 fm=edge id=468
H 2289.948 78 0.05 1 rot=-270 fm=edge id=468
H 2289.948 79 0.05 1 rot=-270 fm=edge id=468
H 2289 69 fm=corner id=469
H 2289.002 68 0.05 1 rot=-90 fm=edge id=468
H 2289.002 67 0.05 1 rot=-90 fm=edge id=468
H 2289.002 66 0.05 1 rot=-90 fm=edge id=468
H 2289.002 65 0.05 1 rot=-90 fm=edge id=468
H 2289.002 64 0.05 1 rot=-90 fm=edge id=468
H 2289.002 63 0.05 1 rot=-90 fm=edge id=468
H 2290 69.95 1 0.05 fm=edge id=468
H 2291 69.95 1 0.05 fm=edge id=468
H 2292 69 rot=90 fm=corner id=469
H 2292.948 67 0.05 1 rot=90 fm=edge id=468
H 2292.948 68 0.05 1 rot=90 fm=edge id=468
H 2292.948 66 0.05 1 rot=90 fm=edge id=468
H 2292.948 65 0.05 1 rot=90 fm=edge id=468
H 2292.948 64 0.05 1 rot=90 fm=edge id=468
H 2292.948 63 0.05 1 rot=90 fm=edge id=468
H 2292 74 rot=-90 fm=corner id=469
H 2292.002 75 0.05 1 rot=-90 fm=edge id=468
H 2292.002 76 0.05 1 rot=-90 fm=edge id=468
H 2292.002 77 0.05 1 rot=-90 fm=edge id=468
H 2292.002 78 0.05 1 rot=-90 fm=edge id=468
H 2292.002 79 0.05 1 rot=-90 fm=edge id=468
H 2293 74 1 0.05 rot=180 fm=edge id=468
H 2294 74 1 0.05 rot=180 fm=edge id=468
H 2295 69 fm=corner id=469
H 2295.002 68 0.05 1 rot=-90 fm=edge id=468
H 2295.002 67 0.05 1 rot=-90 fm=edge id=468
H 2295.002 65 0.05 1 rot=-90 fm=edge id=468
H 2295.002 66 0.05 1 rot=-90 fm=edge id=468
H 2295.002 64 0.05 1 rot=-90 fm=edge id=468
H 2295.002 63 0.05 1 rot=-90 fm=edge id=468
H 2296 69.95 1 0.05 fm=edge id=468
H 2297 69.95 1 0.05 fm=edge id=468
H 2298 69.95 1 0.05 fm=edge id=468
H 2298 74 rot=180 fm=corner id=469
H 2297 74 1 0.05 rot=180 fm=edge id=468
H 2295 74 1 0.05 rot=180 fm=edge id=468
H 2296 74 1 0.05 rot=180 fm=edge id=468
H 2298.948 75 0.05 1 rot=90 fm=edge id=468
H 2298.948 77 0.05 1 rot=90 fm=edge id=468
H 2298.948 79 0.05 1 rot=90 fm=edge id=468
H 2298.948 78 0.05 1 rot=90 fm=edge id=468
H 2298.948 76 0.05 1 rot=90 fm=edge id=468
S 2295.75 73.794 1 0.063 rot=180 id=392
S 2297.25 70.144 1 0.063 id=392
H 2299 69.95 1 0.05 fm=edge id=468
H 2300 69.95 1 0.05 fm=edge id=468
H 2301 69.95 1 0.05 fm=edge id=468
H 2302 69.95 1 0.05 fm=edge id=468
H 2303 69.95 1 0.05 fm=edge id=468
H 2304 69.95 1 0.05 fm=edge id=468
H 2305 69.95 1 0.05 fm=edge id=468
H 2306 69.95 1 0.05 fm=edge id=468
H 2307 69.95 1 0.05 fm=edge id=468
H 2308 69.95 1 0.05 fm=edge id=468
H 2309 69.95 1 0.05 fm=edge id=468
H 2309 73 rot=-90 fm=corner id=469
H 2310 73 1 0.05 rot=180 fm=edge id=468
H 2309.002 76 0.05 1 rot=-90 fm=edge id=468
H 2309.002 75 0.05 1 rot=-90 fm=edge id=468
H 2309.002 74 0.05 1 rot=-90 fm=edge id=468
H 2309.002 77 0.05 1 rot=-90 fm=edge id=468
H 2310 69.95 1 0.05 fm=edge id=468
H 2311 69.95 1 0.05 fm=edge id=468
H 2312 69.95 1 0.05 fm=edge id=468
S 2309.75 70.144 1 0.063 id=392
H 2313 69.95 1 0.05 fm=edge id=468
H 2314 69.95 1 0.05 fm=edge id=468
H 2315 69.95 1 0.05 fm=edge id=468
H 2316 69.95 1 0.05 fm=edge id=468
H 2317 69.95 1 0.05 fm=edge id=468
H 2315 73 1 0.05 rot=180 fm=edge id=468
H 2314 73 rot=-90 fm=corner id=469
H 2316 73 rot=180 fm=corner id=469
H 2316.948 74 0.05 1 rot=90 fm=edge id=468
H 2316.948 75 0.05 1 rot=90 fm=edge id=468
H 2316.948 76 0.05 1 rot=90 fm=edge id=468
H 2316.948 77 0.05 1 rot=90 fm=edge id=468
H 2314.002 77 0.05 1 rot=-90 fm=edge id=468
H 2314.002 76 0.05 1 rot=-90 fm=edge id=468
H 2314.002 75 0.05 1 rot=-90 fm=edge id=468
H 2314.002 74 0.05 1 rot=-90 fm=edge id=468
S 2314.75 70.144 1 0.063 id=392
H 2311 73 rot=180 fm=corner id=469
H 2311.948 74 0.05 1 rot=90 fm=edge id=468
H 2311.948 75 0.05 1 rot=90 fm=edge id=468
H 2311.948 76 0.05 1 rot=90 fm=edge id=468
H 2311.948 77 0.05 1 rot=90 fm=edge id=468
H 2318 69.95 1 0.05 fm=edge id=468
H 2323 73 1 0.05 rot=180 fm=edge id=468
H 2319 73 rot=-90 fm=corner id=469
H 2322 73 1 0.05 rot=180 fm=edge id=468
H 2321 73 1 0.05 rot=180 fm=edge id=468
H 2320 73 1 0.05 rot=180 fm=edge id=468
H 2319.002 74 0.05 1 rot=270 fm=edge id=468
H 2319.002 75 0.05 1 rot=270 fm=edge id=468
H 2319.002 76 0.05 1 rot=270 fm=edge id=468
H 2319.002 77 0.05 1 rot=270 fm=edge id=468
H 2319 69 rot=90 fm=corner id=469
H 2319.948 67 0.05 1 rot=90 fm=edge id=468
H 2319.948 68 0.05 1 rot=90 fm=edge id=468
H 2319.948 65 0.05 1 rot=90 fm=edge id=468
H 2319.948 66 0.05 1 rot=90 fm=edge id=468
H 2319.948 64 0.05 1 rot=90 fm=edge id=468
H 2319.948 63 0.05 1 rot=90 fm=edge id=468
H 2324 73 1 0.05 rot=180 fm=edge id=468
H 2325 73 1 0.05 rot=180 fm=edge id=468
H 2326 73 1 0.05 rot=180 fm=edge id=468
H 2327 73 1 0.05 rot=180 fm=edge id=468
H 2329 73 1 0.05 rot=180 fm=edge id=468
H 2330 73 1 0.05 rot=180 fm=edge id=468
H 2331 73 1 0.05 rot=180 fm=edge id=468
H 2328 73 1 0.05 rot=180 fm=edge id=468
H 2322 69 fm=corner id=469
H 2323 69.95 1 0.05 fm=edge id=468
H 2324 69 rot=90 fm=corner id=469
H 2322.002 68 0.05 1 rot=-90 fm=edge id=468
H 2322.002 67 0.05 1 rot=-90 fm=edge id=468
H 2322.002 65 0.05 1 rot=-90 fm=edge id=468
H 2322.002 66 0.05 1 rot=-90 fm=edge id=468
H 2322.002 64 0.05 1 rot=-90 fm=edge id=468
H 2322.002 63 0.05 1 rot=-90 fm=edge id=468
H 2324.948 68 0.05 1 rot=90 fm=edge id=468
H 2324.948 67 0.05 1 rot=90 fm=edge id=468
H 2324.948 66 0.05 1 rot=90 fm=edge id=468
H 2324.948 65 0.05 1 rot=90 fm=edge id=468
H 2324.948 64 0.05 1 rot=90 fm=edge id=468
H 2324.948 63 0.05 1 rot=90 fm=edge id=468
S 2322.75 72.794 1 0.063 rot=180 id=392
H 2326 69 fm=corner id=469
H 2327 69.95 1 0.05 fm=edge id=468
H 2328 69 rot=90 fm=corner id=469
H 2326.002 68 0.05 1 rot=-90 fm=edge id=468
H 2326.002 67 0.05 1 rot=-90 fm=edge id=468
H 2326.002 66 0.05 1 rot=-90 fm=edge id=468
H 2326.002 64 0.05 1 rot=-90 fm=edge id=468
H 2326.002 63 0.05 1 rot=-90 fm=edge id=468
H 2326.002 65 0.05 1 rot=-90 fm=edge id=468
H 2328.948 68 0.05 1 rot=90 fm=edge id=468
H 2328.948 67 0.05 1 rot=90 fm=edge id=468
H 2328.948 66 0.05 1 rot=90 fm=edge id=468
H 2328.948 65 0.05 1 rot=90 fm=edge id=468
H 2328.948 64 0.05 1 rot=90 fm=edge id=468
H 2328.948 63 0.05 1 rot=90 fm=edge id=468
S 2326.75 72.794 1 0.063 rot=180 id=392
H 2333 73 rot=-180 fm=corner id=469
H 2332 73 1 0.05 rot=180 fm=edge id=468
H 2333.948 74 0.05 1 rot=90 fm=edge id=468
H 2333.948 75 0.05 1 rot=90 fm=edge id=468
H 2333.948 76 0.05 1 rot=90 fm=edge id=468
H 2333.948 77 0.05 1 rot=90 fm=edge id=468
H 2333 69 fm=corner id=469
H 2333.002 67 0.05 1 rot=-90 fm=edge id=468
H 2333.002 68 0.05 1 rot=-90 fm=edge id=468
H 2333.002 66 0.05 1 rot=-90 fm=edge id=468
H 2333.002 65 0.05 1 rot=-90 fm=edge id=468
H 2333.002 64 0.05 1 rot=-90 fm=edge id=468
H 2333.002 63 0.05 1 rot=-90 fm=edge id=468
H 2334 69.95 1 0.05 fm=edge id=468
H 2335 69.95 1 0.05 fm=edge id=468
H 2337 69.95 1 0.05 fm=edge id=468
H 2338 69.95 1 0.05 fm=edge id=468
H 2339 69.95 1 0.05 fm=edge id=468
H 2336 69.95 1 0.05 fm=edge id=468
H 2340 69.95 1 0.05 fm=edge id=468
H 2341 69.95 1 0.05 fm=edge id=468
H 2342 69.95 1 0.05 fm=edge id=468
H 2343 69 rot=90 fm=corner id=469
H 2343.948 68 0.05 1 rot=90 fm=edge id=468
H 2343.948 67 0.05 1 rot=90 fm=edge id=468
H 2343.948 66 0.05 1 rot=90 fm=edge id=468
H 2343.948 65 0.05 1 rot=90 fm=edge id=468
H 2343.948 64 0.05 1 rot=90 fm=edge id=468
H 2343.948 63 0.05 1 rot=90 fm=edge id=468
H 2343 73 rot=-90 fm=corner id=469
H 2343.002 74 0.05 1 rot=-90 fm=edge id=468
H 2343.002 75 0.05 1 rot=-90 fm=edge id=468
H 2343.002 76 0.05 1 rot=-90 fm=edge id=468
H 2343.002 77 0.05 1 rot=-90 fm=edge id=468
H 2344 73 1 0.05 rot=-180 fm=edge id=468
H 2345 73 1 0.05 rot=-180 fm=edge id=468
H 2346 73 rot=180 fm=corner id=469
H 2345 69 fm=corner id=469
H 2345.002 68 0.05 1 rot=-90 fm=edge id=468
H 2345.002 67 0.05 1 rot=-90 fm=edge id=468
H 2345.002 66 0.05 1 rot=-90 fm=edge id=468
H 2345.002 65 0.05 1 rot=-90 fm=edge id=468
H 2345.002 64 0.05 1 rot=-90 fm=edge id=468
H 2345.002 63 0.05 1 rot=-90 fm=edge id=468
H 2346 69.95 1 0.05 fm=edge id=468
H 2347 69.95 1 0.05 fm=edge id=468
H 2348 69.95 1 0.05 fm=edge id=468
H 2349 69.95 1 0.05 fm=edge id=468
H 2350 69.95 1 0.05 fm=edge id=468
H 2351 69.95 1 0.05 fm=edge id=468
H 2353 69.95 1 0.05 fm=edge id=468
H 2352 69.95 1 0.05 fm=edge id=468
H 2346.948 74 0.05 1 rot=90 fm=edge id=468
H 2346.948 75 0.05 1 rot=90 fm=edge id=468
H 2346.948 76 0.05 1 rot=90 fm=edge id=468
H 2346.948 77 0.05 1 rot=90 fm=edge id=468
H 2354 73 rot=-90 fm=corner id=469
H 2354.002 74 0.05 1 rot=-90 fm=edge id=468
H 2354.002 75 0.05 1 rot=-90 fm=edge id=468
H 2354.002 76 0.05 1 rot=-90 fm=edge id=468
H 2354.002 77 0.05 1 rot=-90 fm=edge id=468
H 2355 73 1 0.05 rot=-180 fm=edge id=468
H 2356 73 1 0.05 rot=-180 fm=edge id=468
H 2357 73 rot=180 fm=corner id=469
H 2357.948 74 0.05 1 rot=90 fm=edge id=468
H 2357.948 75 0.05 1 rot=90 fm=edge id=468
H 2357.948 77 0.05 1 rot=90 fm=edge id=468
H 2357.948 76 0.05 1 rot=90 fm=edge id=468
H 2354 69 rot=90 fm=corner id=469
H 2354.948 68 0.05 1 rot=90 fm=edge id=468
H 2354.948 67 0.05 1 rot=90 fm=edge id=468
H 2354.948 66 0.05 1 rot=90 fm=edge id=468
H 2354.948 65 0.05 1 rot=90 fm=edge id=468
H 2354.948 64 0.05 1 rot=90 fm=edge id=468
H 2354.948 63 0.05 1 rot=90 fm=edge id=468
H 2357 69 fm=corner id=469
H 2357.002 68 0.05 1 rot=-90 fm=edge id=468
H 2357.002 67 0.05 1 rot=-90 fm=edge id=468
H 2357.002 66 0.05 1 rot=-90 fm=edge id=468
H 2357.002 65 0.05 1 rot=-90 fm=edge id=468
H 2357.002 63 0.05 1 rot=-90 fm=edge id=468
H 2357.002 64 0.05 1 rot=-90 fm=edge id=468
H 2358 69.95 1 0.05 fm=edge id=468
H 2359 69.95 1 0.05 fm=edge id=468
H 2360 69 rot=90 fm=corner id=469
H 2360.948 68 0.05 1 rot=90 fm=edge id=468
H 2360.948 67 0.05 1 rot=90 fm=edge id=468
H 2360.948 65 0.05 1 rot=90 fm=edge id=468
H 2360.948 66 0.05 1 rot=90 fm=edge id=468
H 2360.948 64 0.05 1 rot=90 fm=edge id=468
H 2360.948 63 0.05 1 rot=90 fm=edge id=468
H 2360 73 rot=-90 fm=corner id=469
H 2360.002 74 0.05 1 rot=270 fm=edge id=468
H 2360.002 75 0.05 1 rot=270 fm=edge id=468
H 2360.002 76 0.05 1 rot=270 fm=edge id=468
H 2360.002 77 0.05 1 rot=270 fm=edge id=468
H 2361 73 1 0.05 rot=180 fm=edge id=468
H 2362 73 1 0.05 rot=180 fm=edge id=468
H 2363 73 rot=180 fm=corner id=469
H 2363.948 74 0.05 1 rot=-270 fm=edge id=468
H 2363.948 75 0.05 1 rot=-270 fm=edge id=468
H 2363.948 76 0.05 1 rot=-270 fm=edge id=468
H 2363.948 77 0.05 1 rot=-270 fm=edge id=468
H 2363 69 fm=corner id=469
H 2363.002 68 0.05 1 rot=-90 fm=edge id=468
H 2363.002 67 0.05 1 rot=-90 fm=edge id=468
H 2363.002 65 0.05 1 rot=-90 fm=edge id=468
H 2363.002 64 0.05 1 rot=-90 fm=edge id=468
H 2363.002 66 0.05 1 rot=-90 fm=edge id=468
H 2363.002 63 0.05 1 rot=-90 fm=edge id=468
H 2364 69.95 1 0.05 fm=edge id=468
H 2365 69.95 1 0.05 fm=edge id=468
H 2366 69.95 1 0.05 fm=edge id=468
H 2367 69.95 1 0.05 fm=edge id=468
H 2368 69.95 1 0.05 fm=edge id=468
H 2369 69.95 1 0.05 fm=edge id=468
H 2365 73 rot=-90 fm=corner id=469
H 2369 73 rot=180 fm=corner id=469
H 2368 73 1 0.05 rot=180 fm=edge id=468
H 2367 73 1 0.05 rot=180 fm=edge id=468
H 2366 73 1 0.05 rot=180 fm=edge id=468
H 2365.002 74 0.05 1 rot=270 fm=edge id=468
H 2365.002 75 0.05 1 rot=270 fm=edge id=468
H 2365.002 76 0.05 1 rot=270 fm=edge id=468
H 2365.002 77 0.05 1 rot=270 fm=edge id=468
H 2369.948 76 0.05 1 rot=90 fm=edge id=468
H 2369.948 77 0.05 1 rot=90 fm=edge id=468
H 2369.948 75 0.05 1 rot=90 fm=edge id=468
H 2369.948 74 0.05 1 rot=90 fm=edge id=468
S 2366.25 72.794 1 0.063 rot=180 id=392
S 2367.75 70.144 1 0.063 id=392
H 2370 69.95 1 0.05 fm=edge id=468
H 2371 69.95 1 0.05 fm=edge id=468
H 2372 69.95 1 0.05 fm=edge id=468
H 2373 69.95 1 0.05 fm=edge id=468
H 2375 69.95 1 0.05 fm=edge id=468
H 2377 69.95 1 0.05 fm=edge id=468
H 2378 69.95 1 0.05 fm=edge id=468
H 2374 69.95 1 0.05 fm=edge id=468
H 2379 69.95 1 0.05 fm=edge id=468
H 2376 69.95 1 0.05 fm=edge id=468
H 2380 69.95 1 0.05 fm=edge id=468
H 2381 69 rot=90 fm=corner id=469
H 2381.948 68 0.05 1 rot=90 fm=edge id=468
H 2381.948 67 0.05 1 rot=90 fm=edge id=468
H 2381.948 66 0.05 1 rot=90 fm=edge id=468
H 2381.948 65 0.05 1 rot=90 fm=edge id=468
H 2381.948 64 0.05 1 rot=90 fm=edge id=468
H 2381.948 63 0.05 1 rot=90 fm=edge id=468
H 2381 73 rot=-90 fm=corner id=469
H 2381.002 74 0.05 1 rot=-90 fm=edge id=468
H 2381.002 75 0.05 1 rot=-90 fm=edge id=468
H 2381.002 76 0.05 1 rot=-90 fm=edge id=468
H 2381.002 77 0.05 1 rot=-90 fm=edge id=468
H 2382 73 1 0.05 rot=-180 fm=edge id=468
H 2383 73 1 0.05 rot=-180 fm=edge id=468
H 2384 73 rot=180 fm=corner id=469
H 2384.948 74 0.05 1 rot=90 fm=edge id=468
H 2384.948 75 0.05 1 rot=90 fm=edge id=468
H 2384.948 76 0.05 1 rot=90 fm=edge id=468
H 2384.948 77 0.05 1 rot=90 fm=edge id=468
H 2384 69 fm=corner id=469
H 2384.002 68 0.05 1 rot=-90 fm=edge id=468
H 2384.002 67 0.05 1 rot=-90 fm=edge id=468
H 2385 69.95 1 0.05 fm=edge id=468
H 2386 69.95 1 0.05 fm=edge id=468
H 2387 69 rot=90 fm=corner id=469
H 2387.948 68 0.05 1 rot=90 fm=edge id=468
H 2387.948 66 0.05 1 rot=90 fm=edge id=468
H 2387.948 67 0.05 1 rot=90 fm=edge id=468
H 2387.948 65 0.05 1 rot=90 fm=edge id=468
H 2387.948 64 0.05 1 rot=90 fm=edge id=468
H 2387.948 63 0.05 1 rot=90 fm=edge id=468
H 2384.002 64 0.05 1 rot=270 fm=edge id=468
H 2384.002 65 0.05 1 rot=270 fm=edge id=468
H 2384.002 63 0.05 1 rot=270 fm=edge id=468
H 2384.002 66 0.05 1 rot=270 fm=edge id=468
H 2386 73 rot=-90 fm=corner id=469
H 2386.002 74 0.05 1 rot=-90 fm=edge id=468
H 2386.002 75 0.05 1 rot=-90 fm=edge id=468
H 2386.002 76 0.05 1 rot=-90 fm=edge id=468
H 2386.002 77 0.05 1 rot=-90 fm=edge id=468
H 2387 73 1 0.05 rot=180 fm=edge id=468
H 2389 73 1 0.05 rot=180 fm=edge id=468
H 2388 73 1 0.05 rot=180 fm=edge id=468
H 2391 73 1 0.05 rot=180 fm=edge id=468
H 2390 73 1 0.05 rot=180 fm=edge id=468
H 2392 73 1 0.05 rot=180 fm=edge id=468
H 2393 73 rot=180 fm=corner id=469
H 2393.948 74 0.05 1 rot=90 fm=edge id=468
H 2393.948 76 0.05 1 rot=90 fm=edge id=468
H 2393.948 75 0.05 1 rot=90 fm=edge id=468
H 2393.948 77 0.05 1 rot=90 fm=edge id=468
H 2389 69 fm=corner id=469
H 2389.002 68 0.05 1 rot=-90 fm=edge id=468
H 2389.002 67 0.05 1 rot=-90 fm=edge id=468
H 2389.002 66 0.05 1 rot=-90 fm=edge id=468
H 2389.002 65 0.05 1 rot=-90 fm=edge id=468
H 2389.002 64 0.05 1 rot=-90 fm=edge id=468
H 2389.002 63 0.05 1 rot=-90 fm=edge id=468
H 2390 69.95 1 0.05 fm=edge id=468
H 2391 69.95 1 0.05 fm=edge id=468
H 2392 69.95 1 0.05 fm=edge id=468
H 2393 69.95 1 0.05 fm=edge id=468
H 2394 69.95 1 0.05 fm=edge id=468
S 2390.25 70.144 1 0.063 id=392
S 2391.75 72.794 1 0.063 rot=180 id=392
H 2395 69.95 1 0.05 fm=edge id=468
H 2396 69.95 1 0.05 fm=edge id=468
H 2397 69.95 1 0.05 fm=edge id=468
H 2398 69.95 1 0.05 fm=edge id=468
H 2399 69.95 1 0.05 fm=edge id=468
H 2400 69.95 1 0.05 fm=edge id=468
H 2401 69.95 1 0.05 fm=edge id=468
H 2402 69.95 1 0.05 fm=edge id=468
H 2403 69.95 1 0.05 fm=edge id=468
H 2404 69.95 1 0.05 fm=edge id=468
H 2405 69.95 1 0.05 fm=edge id=468
H 2406 69.95 1 0.05 fm=edge id=468
H 2407 69.95 1 0.05 fm=edge id=468
H 2404 73 rot=-90 fm=corner id=469
H 2405 73 1 0.05 rot=180 fm=edge id=468
H 2406 73 rot=180 fm=corner id=469
H 2404.002 74 0.05 1 rot=-90 fm=edge id=468
H 2404.002 75 0.05 1 rot=-90 fm=edge id=468
H 2404.002 76 0.05 1 rot=-90 fm=edge id=468
H 2404.002 77 0.05 1 rot=-90 fm=edge id=468
H 2406.948 77 0.05 1 rot=90 fm=edge id=468
H 2406.948 76 0.05 1 rot=90 fm=edge id=468
H 2406.948 75 0.05 1 rot=90 fm=edge id=468
H 2406.948 74 0.05 1 rot=90 fm=edge id=468
H 2408 69.95 1 0.05 fm=edge id=468
H 2409 69.95 1 0.05 fm=edge id=468
H 2410 69.95 1 0.05 fm=edge id=468
H 2412 69.95 1 0.05 fm=edge id=468
H 2411 69.95 1 0.05 fm=edge id=468
H 2409 73 1 0.05 rot=180 fm=edge id=468
H 2408 73 rot=-90 fm=corner id=469
H 2410 73 rot=180 fm=corner id=469
H 2408.002 74 0.05 1 rot=-90 fm=edge id=468
H 2408.002 75 0.05 1 rot=-90 fm=edge id=468
H 2408.002 76 0.05 1 rot=-90 fm=edge id=468
H 2408.002 77 0.05 1 rot=-90 fm=edge id=468
H 2410.948 77 0.05 1 rot=90 fm=edge id=468
H 2410.948 75 0.05 1 rot=90 fm=edge id=468
H 2410.948 76 0.05 1 rot=90 fm=edge id=468
H 2410.948 74 0.05 1 rot=90 fm=edge id=468
S 2404.75 70.144 1 0.063 id=392
S 2409.25 70.144 1 0.063 id=392
H 2413 69 rot=90 fm=corner id=469
H 2413.948 68 0.05 1 rot=90 fm=edge id=468
H 2413.948 67 0.05 1 rot=90 fm=edge id=468
H 2413.948 66 0.05 1 rot=90 fm=edge id=468
H 2413.948 65 0.05 1 rot=90 fm=edge id=468
H 2413.948 64 0.05 1 rot=90 fm=edge id=468
H 2413.948 63 0.05 1 rot=90 fm=edge id=468
H 2413 73 rot=-90 fm=corner id=469
H 2413.002 74 0.05 1 rot=-90 fm=edge id=468
H 2413.002 75 0.05 1 rot=-90 fm=edge id=468
H 2413.002 76 0.05 1 rot=-90 fm=edge id=468
H 2413.002 77 0.05 1 rot=-90 fm=edge id=468
H 2414 73 1 0.05 rot=-180 fm=edge id=468
H 2415 73 1 0.05 rot=-180 fm=edge id=468
H 2416 73 1 0.05 rot=-180 fm=edge id=468
H 2417 73 1 0.05 rot=-180 fm=edge id=468
H 2418 73 1 0.05 rot=-180 fm=edge id=468
H 2419 73 1 0.05 rot=-180 fm=edge id=468
H 2416 69 fm=corner id=469
H 2418 69 rot=90 fm=corner id=469
H 2417 69.95 1 0.05 fm=edge id=468
H 2416.002 68 0.05 1 rot=-90 fm=edge id=468
H 2416.002 67 0.05 1 rot=-90 fm=edge id=468
H 2416.002 66 0.05 1 rot=-90 fm=edge id=468
H 2416.002 65 0.05 1 rot=-90 fm=edge id=468
H 2416.002 64 0.05 1 rot=-90 fm=edge id=468
H 2416.002 63 0.05 1 rot=-90 fm=edge id=468
H 2418.948 68 0.05 1 rot=90 fm=edge id=468
H 2418.948 67 0.05 1 rot=90 fm=edge id=468
H 2418.948 66 0.05 1 rot=90 fm=edge id=468
H 2418.948 65 0.05 1 rot=90 fm=edge id=468
H 2418.948 64 0.05 1 rot=90 fm=edge id=468
H 2418.948 63 0.05 1 rot=90 fm=edge id=468
H 2420 73 1 0.05 rot=180 fm=edge id=468
H 2421 73 1 0.05 rot=180 fm=edge id=468
H 2422 73 1 0.05 rot=180 fm=edge id=468
H 2420 69 fm=corner id=469
H 2421 69.95 1 0.05 fm=edge id=468
H 2422 69 rot=90 fm=corner id=469
H 2420.002 68 0.05 1 rot=-90 fm=edge id=468
H 2420.002 67 0.05 1 rot=-90 fm=edge id=468
H 2420.002 65 0.05 1 rot=-90 fm=edge id=468
H 2420.002 64 0.05 1 rot=-90 fm=edge id=468
H 2420.002 66 0.05 1 rot=-90 fm=edge id=468
H 2420.002 63 0.05 1 rot=270 fm=edge id=468
H 2422.948 68 0.05 1 rot=90 fm=edge id=468
H 2422.948 67 0.05 1 rot=90 fm=edge id=468
H 2422.948 66 0.05 1 rot=90 fm=edge id=468
H 2422.948 65 0.05 1 rot=90 fm=edge id=468
H 2422.948 64 0.05 1 rot=90 fm=edge id=468
H 2422.948 63 0.05 1 rot=90 fm=edge id=468
H 2423 73 1 0.05 rot=180 fm=edge id=468
H 2424 73 1 0.05 rot=180 fm=edge id=468
H 2425 73 1 0.05 rot=180 fm=edge id=468
H 2426 73 1 0.05 rot=180 fm=edge id=468
H 2427 73 1 0.05 rot=180 fm=edge id=468
H 2428 73 rot=180 fm=corner id=469
H 2428.948 74 0.05 1 rot=90 fm=edge id=468
H 2428.948 75 0.05 1 rot=90 fm=edge id=468
H 2428.948 76 0.05 1 rot=90 fm=edge id=468
H 2428.948 77 0.05 1 rot=90 fm=edge id=468
H 2425 69 fm=corner id=469
H 2426 69.95 1 0.05 fm=edge id=468
H 2427 69.95 1 0.05 fm=edge id=468
H 2428 69.95 1 0.05 fm=edge id=468
H 2429 69.95 1 0.05 fm=edge id=468
H 2430 69.95 1 0.05 fm=edge id=468
S 2425.75 72.794 1 0.063 rot=180 id=392
S 2427.25 70.144 1 0.063 id=392
H 2425.002 68 0.05 1 rot=-90 fm=edge id=468
H 2425.002 67 0.05 1 rot=-90 fm=edge id=468
H 2425.002 66 0.05 1 rot=-90 fm=edge id=468
H 2425.002 65 0.05 1 rot=-90 fm=edge id=468
H 2425.002 64 0.05 1 rot=-90 fm=edge id=468
H 2425.002 63 0.05 1 rot=-90 fm=edge id=468
H 2431 69.95 1 0.05 fm=edge id=468
H 2432 69.95 1 0.05 fm=edge id=468
H 2433 69.95 1 0.05 fm=edge id=468
H 2434 69.95 1 0.05 fm=edge id=468
H 2435 69.95 1 0.05 fm=edge id=468
H 2436 69.95 1 0.05 fm=edge id=468
H 2437 69 rot=90 fm=corner id=469
H 2440 69 fm=corner id=469
H 2437.948 68 0.05 1 rot=90 fm=edge id=468
H 2437.948 67 0.05 1 rot=90 fm=edge id=468
H 2437.948 66 0.05 1 rot=90 fm=edge id=468
H 2437.948 65 0.05 1 rot=90 fm=edge id=468
H 2437.948 64 0.05 1 rot=90 fm=edge id=468
H 2437.948 63 0.05 1 rot=90 fm=edge id=468
H 2440.002 68 0.05 1 rot=-90 fm=edge id=468
H 2440.002 67 0.05 1 rot=-90 fm=edge id=468
H 2440.002 66 0.05 1 rot=-90 fm=edge id=468
H 2440.002 65 0.05 1 rot=-90 fm=edge id=468
H 2440.002 64 0.05 1 rot=-90 fm=edge id=468
H 2440.002 63 0.05 1 rot=-90 fm=edge id=468
H 2437 73 rot=-90 fm=corner id=469
H 2438 73 1 0.05 rot=180 fm=edge id=468
H 2439 73 1 0.05 rot=180 fm=edge id=468
H 2440 73 rot=180 fm=corner id=469
H 2437.002 74 0.05 1 rot=-90 fm=edge id=468
H 2437.002 75 0.05 1 rot=-90 fm=edge id=468
H 2437.002 76 0.05 1 rot=-90 fm=edge id=468
H 2437.002 77 0.05 1 rot=-90 fm=edge id=468
H 2440.948 77 0.05 1 rot=90 fm=edge id=468
H 2440.948 76 0.05 1 rot=90 fm=edge id=468
H 2440.948 75 0.05 1 rot=90 fm=edge id=468
H 2440.948 74 0.05 1 rot=90 fm=edge id=468
H 2441 69.95 1 0.05 fm=edge id=468
H 2443 69.95 1 0.05 fm=edge id=468
H 2442 69.95 1 0.05 fm=edge id=468
H 2444 69.95 1 0.05 fm=edge id=468
H 2445 69.95 1 0.05 fm=edge id=468
H 2446 69.95 1 0.05 fm=edge id=468
H 2447 69.95 1 0.05 fm=edge id=468
H 2448 69.95 1 0.05 fm=edge id=468
H 2449 69.95 1 0.05 fm=edge id=468
H 2450 69.95 1 0.05 fm=edge id=468
H 2451 69.95 1 0.05 fm=edge id=468
H 2452 69 rot=90 fm=corner id=469
H 2451 73 rot=-90 fm=corner id=469
H 2451.002 74 0.05 1 rot=-90 fm=edge id=468
H 2451.002 76 0.05 1 rot=-90 fm=edge id=468
H 2451.002 75 0.05 1 rot=-90 fm=edge id=468
H 2451.002 77 0.05 1 rot=-90 fm=edge id=468
H 2452.948 68 0.05 1 rot=90 fm=edge id=468
H 2452.948 67 0.05 1 rot=90 fm=edge id=468
H 2452.948 66 0.05 1 rot=90 fm=edge id=468
H 2452.948 65 0.05 1 rot=90 fm=edge id=468
H 2452.948 64 0.05 1 rot=90 fm=edge id=468
H 2452.948 63 0.05 1 rot=90 fm=edge id=468
H 2452 73 1 0.05 rot=180 fm=edge id=468
H 2453 73 1 0.05 rot=180 fm=edge id=468
H 2454 73 1 0.05 rot=180 fm=edge id=468
H 2455 73 rot=180 fm=corner id=469
H 2455.948 74 0.05 1 rot=-270 fm=edge id=468
H 2455.948 75 0.05 1 rot=-270 fm=edge id=468
H 2455.948 77 0.05 1 rot=-270 fm=edge id=468
H 2455.948 76 0.05 1 rot=-270 fm=edge id=468
H 2454 69 fm=corner id=469
H 2454.002 68 0.05 1 rot=-90 fm=edge id=468
H 2454.002 66 0.05 1 rot=-90 fm=edge id=468
H 2454.002 67 0.05 1 rot=-90 fm=edge id=468
H 2454.002 65 0.05 1 rot=-90 fm=edge id=468
H 2454.002 64 0.05 1 rot=-90 fm=edge id=468
H 2454.002 63 0.05 1 rot=-90 fm=edge id=468
H 2455 69.95 1 0.05 fm=edge id=468
H 2456 69.95 1 0.05 fm=edge id=468
H 2457 69.95 1 0.05 fm=edge id=468
H 2458 69 rot=90 fm=corner id=469
H 2458.948 68 0.05 1 rot=90 fm=edge id=468
H 2458.948 67 0.05 1 rot=90 fm=edge id=468
H 2458.948 66 0.05 1 rot=90 fm=edge id=468
H 2458.948 65 0.05 1 rot=90 fm=edge id=468
H 2458.948 64 0.05 1 rot=90 fm=edge id=468
H 2458.948 63 0.05 1 rot=90 fm=edge id=468
H 2457 73 rot=-90 fm=corner id=469
H 2457.002 74 0.05 1 rot=-90 fm=edge id=468
H 2457.002 75 0.05 1 rot=-90 fm=edge id=468
H 2457.002 76 0.05 1 rot=-90 fm=edge id=468
H 2457.002 77 0.05 1 rot=-90 fm=edge id=468
H 2458 73 1 0.05 rot=-180 fm=edge id=468
H 2459 73 1 0.05 rot=-180 fm=edge id=468
H 2460 73 1 0.05 rot=-180 fm=edge id=468
H 2461 73 rot=180 fm=corner id=469
H 2461.948 74 0.05 1 rot=90 fm=edge id=468
H 2461.948 75 0.05 1 rot=90 fm=edge id=468
H 2461.948 76 0.05 1 rot=90 fm=edge id=468
H 2461.948 77 0.05 1 rot=90 fm=edge id=468
H 2460 69 fm=corner id=469
H 2460.002 68 0.05 1 rot=-90 fm=edge id=468
H 2460.002 67 0.05 1 rot=-90 fm=edge id=468
H 2460.002 66 0.05 1 rot=-90 fm=edge id=468
H 2460.002 64 0.05 1 rot=-90 fm=edge id=468
H 2460.002 63 0.05 1 rot=-90 fm=edge id=468
H 2460.002 65 0.05 1 rot=-90 fm=edge id=468
H 2461 69.95 1 0.05 fm=edge id=468
H 2462 69.95 1 0.05 fm=edge id=468
H 2464 69 rot=90 fm=corner id=469
H 2463 69.95 1 0.05 fm=edge id=468
H 2464.948 68 0.05 1 rot=90 fm=edge id=468
H 2464.948 67 0.05 1 rot=90 fm=edge id=468
H 2464.948 66 0.05 1 rot=90 fm=edge id=468
H 2464.948 64 0.05 1 rot=90 fm=edge id=468
H 2464.948 65 0.05 1 rot=90 fm=edge id=468
H 2464.948 63 0.05 1 rot=90 fm=edge id=468
H 2463 73 rot=-90 fm=corner id=469
H 2463.002 74 0.05 1 rot=-90 fm=edge id=468
H 2463.002 76 0.05 1 rot=-90 fm=edge id=468
H 2463.002 75 0.05 1 rot=-90 fm=edge id=468
H 2463.002 77 0.05 1 rot=-90 fm=edge id=468
H 2464 73 1 0.05 rot=-180 fm=edge id=468
H 2465 73 1 0.05 rot=-180 fm=edge id=468
H 2466 73 1 0.05 rot=-180 fm=edge id=468
H 2467 73 rot=180 fm=corner id=469
H 2466 69 fm=corner id=469
H 2467 69.95 1 0.05 fm=edge id=468
H 2466.002 68 0.05 1 rot=-90 fm=edge id=468
H 2466.002 67 0.05 1 rot=-90 fm=edge id=468
H 2466.002 66 0.05 1 rot=-90 fm=edge id=468
H 2466.002 65 0.05 1 rot=-90 fm=edge id=468
H 2466.002 64 0.05 1 rot=-90 fm=edge id=468
H 2466.002 63 0.05 1 rot=-90 fm=edge id=468
H 2468 69.95 1 0.05 fm=edge id=468
H 2467.948 74 0.05 1 rot=90 fm=edge id=468
H 2467.948 75 0.05 1 rot=90 fm=edge id=468
H 2467.948 76 0.05 1 rot=90 fm=edge id=468
H 2467.948 77 0.05 1 rot=90 fm=edge id=468
H 2469 69.95 1 0.05 fm=edge id=468
H 2470 69.95 1 0.05 fm=edge id=468
H 2471 69.95 1 0.05 fm=edge id=468
H 2472 69.95 1 0.05 fm=edge id=468
H 2473 69.95 1 0.05 fm=edge id=468
H 2474 69.95 1 0.05 fm=edge id=468
H 2475 69.95 1 0.05 fm=edge id=468
H 2476 69.95 1 0.05 fm=edge id=468
H 2477 69.95 1 0.05 fm=edge id=468
R 2472 71 to=cube id=12 z=2
V 2473 71 spd=2 id=202 z=2
V 2473 71 spd=2 id=202 z=2
H 2478 69 rot=90 fm=corner id=469
H 2478.948 68 0.05 1 rot=90 fm=edge id=468
H 2478.948 67 0.05 1 rot=90 fm=edge id=468
H 2478.948 66 0.05 1 rot=90 fm=edge id=468
H 2478.948 65 0.05 1 rot=90 fm=edge id=468
H 2478.948 64 0.05 1 rot=90 fm=edge id=468
H 2478.948 63 0.05 1 rot=90 fm=edge id=468
O 2484 69 orb=yellow id=36 z=2
B 2488 69 id=83
B 2489 69 id=83
B 2489 68 id=83
B 2488 68 id=83
B 2487 68 id=83
B 2490 69 id=83
B 2490 68 id=83
B 2491 68 id=83
O 2495 70 orb=yellow id=36 z=2
B 2502 69 id=83
B 2503 69 id=83
B 2502 68 id=83
B 2501 68 id=83
B 2501 67 id=83
B 2503 68 id=83
B 2502 67 id=83
B 2504 68 id=83
B 2504 69 id=83
B 2505 68 id=83
B 2504 67 id=83
B 2503 67 id=83
B 2505 67 id=83
B 2505 69 id=83
B 2506 69 id=83
B 2506 70 id=83
B 2507 70 id=83
B 2507 69 id=83
B 2508 70 id=83
B 2505 70 id=83
B 2504 70 id=83
B 2507 68 id=83
B 2506 68 id=83
B 2509 68 id=83
B 2509 67 id=83
B 2509 66 id=83
B 2508 66 id=83
B 2507 66 id=83
B 2487 67 id=83
B 2488 67 id=83
B 2490 66 id=83
B 2491 66 id=83
B 2492 66 id=83
A 2513 72 ar=purple tp=1 id=3004 z=2
B 2513 78 id=83
B 2511 78 id=83
B 2512 79 id=83
B 2514 79 id=83
B 2514 78 id=83
B 2515 78 id=83
B 2512 78 id=83
B 2516 78 id=83
B 2517 78 id=83
B 2516 79 id=83
B 2517 79 id=83
B 2518 78 id=83
B 2518 79 id=83
B 2519 78 id=83
B 2519 79 id=83
B 2520 78 id=83
B 2510 80 id=83
B 2516 81 id=83
B 2515 81 id=83
B 2521 80 id=83
E 2490 70 rot=-90 art=3812 id=3812 z=3
E 2502 70 rot=-90 art=3812 id=3812 z=3
E 2508 71 rot=-90 art=3812 id=3812 z=3
E 2519 77 rot=90 art=3812 id=3812 z=3
A 2527 81 rot=180 ar=purple tp=1 id=3004 z=2
B 2527 72 id=83
B 2527 71 id=83
B 2526 71 id=83
B 2529 71 id=83
B 2528 71 id=83
B 2528 70 id=83
B 2529 70 id=83
B 2528 72 id=83
B 2529 72 id=83
B 2530 72 id=83
B 2530 71 id=83
B 2526 72 id=83
B 2525 71 id=83
B 2531 72 id=83
B 2531 71 id=83
B 2532 72 id=83
B 2532 71 id=83
B 2533 71 id=83
B 2533 69 id=83
B 2532 69 id=83
B 2531 69 id=83
B 2534 69 id=83
E 2532 73 rot=-90 art=3812 id=3812 z=3
B 2535 73 id=83
B 2536 73 id=83
B 2535 74 id=83
B 2536 74 id=83
B 2534 74 id=83
B 2537 74 id=83
B 2537 73 id=83
B 2538 74 id=83
B 2539 74 id=83
B 2538 73 id=83
B 2532 70 id=83
B 2531 70 id=83
W 2534.767 70.083 1.467 2.833 id=1705 z=5
W 2522.767 80.083 1.467 2.833 id=1705 z=5
W 2525.767 83.083 1.467 2.833 id=1705 z=5
W 2529.767 81.083 1.467 2.833 id=1705 z=5
B 2527 84 id=83
B 2528 84 id=83
B 2529 83 id=83
B 2528 83 id=83
B 2529 84 id=83
B 2530 83 id=83
B 2531 82 id=83
B 2531 83 id=83
B 2530 84 id=83
B 2525 84 id=83
B 2524 84 id=83
B 2523 83 id=83
B 2522 82 id=83
B 2523 82 id=83
B 2524 83 id=83
B 2523 84 id=83
B 2525 85 id=83
W 2511.767 67.083 1.467 2.833 id=1705 z=5
W 2514.767 68.083 1.467 2.833 id=1705 z=5
B 2515 68 id=83
B 2515 67 id=83
B 2514 67 id=83
B 2512 67 id=83
B 2513 68 id=83
B 2513 67 id=83
B 2514 68 id=83
W 2484.767 64.083 1.467 2.833 id=1705 z=5
W 2479.767 65.083 1.467 2.833 id=1705 z=5
W 2481.767 63.083 1.467 2.833 id=1705 z=5
E 2539 75 rot=-90 art=3812 id=3812 z=3
A 2545 73 ar=purple tp=1 id=3004 z=2
W 2540.767 72.083 1.467 2.833 id=1705 z=5
W 2543.767 70.083 1.467 2.833 id=1705 z=5
B 2542 72 id=83
B 2541 72 id=83
B 2542 71 id=83
B 2543 71 id=83
B 2543 70 id=83
B 2544 70 id=83
B 2542 70 id=83
B 2540 71 id=83
B 2540 70 id=83
B 2548 72 id=83
B 2548 71 id=83
B 2547 71 id=83
W 2546.767 71.083 1.467 2.833 id=1705 z=5
B 2545 79 id=83
B 2546 79 id=83
B 2544 80 id=83
B 2544 79 id=83
B 2545 81 id=83
B 2545 80 id=83
B 2547 79 id=83
B 2546 80 id=83
B 2548 79 id=83
B 2549 79 id=83
B 2548 80 id=83
B 2547 80 id=83
B 2551 81 id=83
B 2543 80 id=83
B 2555 79 id=83
B 2554 79 id=83
B 2556 79 id=83
B 2559 77 id=83
B 2560 77 id=83
B 2563 75 id=83
B 2564 75 id=83
B 2563 78 id=83
B 2563 79 id=83
B 2562 79 id=83
B 2561 79 id=83
B 2560 79 id=83
B 2559 79 id=83
B 2559 80 id=83
B 2558 80 id=83
B 2556 80 id=83
B 2555 80 id=83
B 2554 80 id=83
B 2557 80 id=83
B 2553 80 id=83
B 2560 80 id=83
B 2559 81 id=83
B 2558 81 id=83
B 2557 81 id=83
B 2557 82 id=83
B 2556 81 id=83
B 2554 82 id=83
B 2555 83 id=83
B 2554 83 id=83
B 2562 81 id=83
B 2563 81 id=83
B 2565 79 id=83
B 2560 78 id=83
B 2559 78 id=83
B 2563 77 id=83
B 2563 76 id=83
B 2564 77 id=83
B 2564 76 id=83
B 2564 78 id=83
B 2564 79 id=83
B 2566 77 id=83
B 2566 76 id=83
B 2562 78 id=83
G 2566 72 gd=1 id=10 z=2
B 2568 69 id=83
B 2567 69 id=83
B 2569 69 id=83
E 2559 76 rot=90 art=3812 id=3812 z=3
E 2563 74 rot=90 art=3812 id=3812 z=3
E 2555 78 rot=90 art=3812 id=3812 z=3
E 2568 70 rot=270 art=3812 id=3812 z=3
B 2572 71 id=83
B 2573 71 id=83
B 2576 73 id=83
B 2577 73 id=83
B 2577 72 id=83
B 2576 72 id=83
B 2576 71 id=83
B 2577 71 id=83
B 2577 70 id=83
B 2576 70 id=83
B 2577 69 id=83
B 2576 69 id=83
B 2575 69 id=83
B 2574 69 id=83
B 2573 69 id=83
B 2573 70 id=83
B 2572 70 id=83
B 2572 69 id=83
B 2570 69 id=83
B 2571 69 id=83
B 2570 68 id=83
B 2572 68 id=83
B 2571 68 id=83
B 2569 67 id=83
B 2567 67 id=83
B 2569 68 id=83
B 2573 67 id=83
B 2573 68 id=83
B 2576 67 id=83
B 2575 67 id=83
B 2580 75 id=83
B 2581 75 id=83
B 2580 74 id=83
B 2581 74 id=83
B 2580 73 id=83
B 2581 73 id=83
B 2581 72 id=83
B 2580 72 id=83
B 2580 71 id=83
B 2581 71 id=83
B 2581 70 id=83
B 2580 69 id=83
B 2581 69 id=83
B 2580 70 id=83
B 2579 69 id=83
B 2578 69 id=83
B 2585 75 id=83
B 2586 75 id=83
B 2588 75 id=83
B 2589 75 id=83
B 2587 75 id=83
B 2590 75 id=83
B 2593 75 id=83
B 2591 75 id=83
B 2592 75 id=83
B 2585 79 id=83
B 2586 79 id=83
B 2587 79 id=83
B 2588 79 id=83
B 2589 79 id=83
B 2591 79 id=83
B 2593 79 id=83
B 2590 79 id=83
B 2592 79 id=83
B 2587 80 id=83
B 2588 80 id=83
B 2589 80 id=83
B 2591 80 id=83
B 2592 80 id=83
B 2590 80 id=83
B 2593 80 id=83
B 2594 79 id=83
B 2590 81 id=83
B 2589 81 id=83
B 2591 81 id=83
B 2592 81 id=83
B 2594 80 id=83
B 2595 79 id=83
B 2585 81 id=83
B 2584 81 id=83
B 2594 74 id=83
B 2594 75 id=83
B 2595 75 id=83
B 2596 74 id=83
B 2597 74 id=83
B 2596 75 id=83
B 2590 73 id=83
B 2590 74 id=83
B 2589 73 id=83
B 2588 73 id=83
B 2587 73 id=83
B 2587 74 id=83
B 2586 74 id=83
B 2589 74 id=83
B 2588 74 id=83
B 2592 73 id=83
B 2593 73 id=83
B 2593 74 id=83
B 2596 72 id=83
B 2595 72 id=83
B 2584 73 id=83
B 2594 82 id=83
V 2603 77 spd=4 id=1334 z=2
A 2601 77 ar=green id=1704 z=2
C 2587 77 id=2063
E 2598 78 art=3823 id=3823 z=3
E 2599 78 art=3823 id=3823 z=3
E 2599 77 art=3823 id=3823 z=3
E 2598 77 art=3823 id=3823 z=3
E 2597 77 art=3823 id=3823 z=3
E 2597 78 art=3823 id=3823 z=3
E 2597 76 art=3823 id=3823 z=3
E 2598 76 art=3823 id=3823 z=3
E 2599 76 art=3823 id=3823 z=3
B 2631 76 id=83
B 2630 76 id=83
S 2629 76 id=8
S 2628 76 id=8
S 2627 76 id=8
S 2626 76 id=8
S 2625 76 id=8
S 2624 76 id=8
S 2623 75 id=8
S 2621 75 id=8
S 2620 75 id=8
S 2622 75 id=8
S 2619 75 id=8
S 2618 75 id=8
S 2617 75 id=8
S 2616 75 id=8
S 2615 74 id=8
S 2614 74 id=8
S 2613 74 id=8
S 2612 74 id=8
S 2611 74 id=8
S 2610 74 id=8
S 2609 74 id=8
S 2608 74 id=8
S 2607 74 id=8
S 2606 74 id=8
S 2605 74 id=8
S 2604 74 id=8
S 2603 74 id=8
S 2602 74 id=8
B 2599 73 id=83
B 2600 73 id=83
B 2601 73 id=83
B 2602 73 id=83
S 2601 74 id=8
S 2600 74 id=8
S 2599 74 id=8
B 2603 73 id=83
B 2605 73 id=83
B 2607 73 id=83
B 2609 73 id=83
B 2610 73 id=83
B 2606 73 id=83
B 2604 73 id=83
B 2608 73 id=83
B 2612 73 id=83
B 2613 73 id=83
B 2611 73 id=83
B 2615 73 id=83
B 2614 73 id=83
B 2616 74 id=83
B 2617 74 id=83
B 2618 74 id=83
B 2619 74 id=83
B 2620 74 id=83
B 2621 74 id=83
B 2623 74 id=83
B 2624 75 id=83
B 2622 74 id=83
B 2625 75 id=83
B 2626 75 id=83
B 2628 75 id=83
B 2627 75 id=83
B 2629 75 id=83
B 2624 74 id=83
B 2625 74 id=83
B 2626 74 id=83
B 2628 74 id=83
B 2629 74 id=83
B 2627 74 id=83
B 2629 73 id=83
B 2628 73 id=83
B 2627 73 id=83
B 2626 73 id=83
B 2625 73 id=83
B 2624 73 id=83
B 2623 73 id=83
B 2622 73 id=83
B 2621 73 id=83
B 2620 73 id=83
B 2619 73 id=83
B 2618 73 id=83
B 2617 73 id=83
B 2616 73 id=83
B 2630 75 id=83
B 2631 75 id=83
B 2631 74 id=83
B 2630 74 id=83
B 2630 73 id=83
B 2631 73 id=83
B 2631 78.5 rot=-180 fy=1 id=83
B 2630 78.5 rot=-180 fy=1 id=83
S 2629 78.5 rot=-180 fy=1 id=8
S 2628 78.5 rot=-180 fy=1 id=8
S 2627 78.5 rot=-180 fy=1 id=8
S 2626 78.5 rot=-180 fy=1 id=8
S 2625 78.5 rot=-180 fy=1 id=8
S 2624 78.5 rot=-180 fy=1 id=8
S 2623 79.5 rot=-180 fy=1 id=8
S 2621 79.5 rot=-180 fy=1 id=8
S 2620 79.5 rot=-180 fy=1 id=8
S 2622 79.5 rot=-180 fy=1 id=8
S 2619 79.5 rot=-180 fy=1 id=8
S 2618 79.5 rot=-180 fy=1 id=8
S 2617 79.5 rot=-180 fy=1 id=8
S 2616 79.5 rot=-180 fy=1 id=8
S 2615 80.5 rot=-180 fy=1 id=8
S 2614 80.5 rot=-180 fy=1 id=8
S 2613 80.5 rot=-180 fy=1 id=8
S 2612 80.5 rot=-180 fy=1 id=8
S 2611 80.5 rot=-180 fy=1 id=8
S 2610 80.5 rot=-180 fy=1 id=8
S 2609 80.5 rot=-180 fy=1 id=8
S 2608 80.5 rot=-180 fy=1 id=8
S 2607 80.5 rot=-180 fy=1 id=8
S 2606 80.5 rot=-180 fy=1 id=8
S 2605 80.5 rot=-180 fy=1 id=8
S 2604 80.5 rot=-180 fy=1 id=8
S 2603 80.5 rot=-180 fy=1 id=8
S 2602 80.5 rot=-180 fy=1 id=8
B 2599 81.5 rot=-180 fy=1 id=83
B 2600 81.5 rot=-180 fy=1 id=83
B 2601 81.5 rot=-180 fy=1 id=83
B 2602 81.5 rot=-180 fy=1 id=83
S 2601 80.5 rot=-180 fy=1 id=8
S 2600 80.5 rot=-180 fy=1 id=8
S 2599 80.5 rot=-180 fy=1 id=8
B 2603 81.5 rot=-180 fy=1 id=83
B 2605 81.5 rot=-180 fy=1 id=83
B 2607 81.5 rot=-180 fy=1 id=83
B 2609 81.5 rot=-180 fy=1 id=83
B 2610 81.5 rot=-180 fy=1 id=83
B 2606 81.5 rot=-180 fy=1 id=83
B 2604 81.5 rot=-180 fy=1 id=83
B 2608 81.5 rot=-180 fy=1 id=83
B 2612 81.5 rot=-180 fy=1 id=83
B 2613 81.5 rot=-180 fy=1 id=83
B 2611 81.5 rot=-180 fy=1 id=83
B 2615 81.5 rot=-180 fy=1 id=83
B 2614 81.5 rot=-180 fy=1 id=83
B 2616 80.5 rot=-180 fy=1 id=83
B 2617 80.5 rot=-180 fy=1 id=83
B 2618 80.5 rot=-180 fy=1 id=83
B 2619 80.5 rot=-180 fy=1 id=83
B 2620 80.5 rot=-180 fy=1 id=83
B 2621 80.5 rot=-180 fy=1 id=83
B 2623 80.5 rot=-180 fy=1 id=83
B 2624 79.5 rot=-180 fy=1 id=83
B 2622 80.5 rot=-180 fy=1 id=83
B 2625 79.5 rot=-180 fy=1 id=83
B 2626 79.5 rot=-180 fy=1 id=83
B 2628 79.5 rot=-180 fy=1 id=83
B 2627 79.5 rot=-180 fy=1 id=83
B 2629 79.5 rot=-180 fy=1 id=83
B 2624 80.5 rot=-180 fy=1 id=83
B 2625 80.5 rot=-180 fy=1 id=83
B 2626 80.5 rot=-180 fy=1 id=83
B 2628 80.5 rot=-180 fy=1 id=83
B 2629 80.5 rot=-180 fy=1 id=83
B 2627 80.5 rot=-180 fy=1 id=83
B 2629 81.5 rot=-180 fy=1 id=83
B 2628 81.5 rot=-180 fy=1 id=83
B 2627 81.5 rot=-180 fy=1 id=83
B 2626 81.5 rot=-180 fy=1 id=83
B 2625 81.5 rot=-180 fy=1 id=83
B 2624 81.5 rot=-180 fy=1 id=83
B 2623 81.5 rot=-180 fy=1 id=83
B 2622 81.5 rot=-180 fy=1 id=83
B 2621 81.5 rot=-180 fy=1 id=83
B 2620 81.5 rot=-180 fy=1 id=83
B 2619 81.5 rot=-180 fy=1 id=83
B 2618 81.5 rot=-180 fy=1 id=83
B 2617 81.5 rot=-180 fy=1 id=83
B 2616 81.5 rot=-180 fy=1 id=83
B 2630 79.5 rot=-180 fy=1 id=83
B 2631 79.5 rot=-180 fy=1 id=83
B 2631 80.5 rot=-180 fy=1 id=83
B 2630 80.5 rot=-180 fy=1 id=83
B 2630 81.5 rot=-180 fy=1 id=83
B 2631 81.5 rot=-180 fy=1 id=83
O 2647 84 orb=yellow id=36 z=2
E 2641 87 art=3818 id=3818 z=3
O 2651 86 orb=yellow id=36 z=2
O 2655 88 orb=green id=1022 z=2
O 2659 86 orb=yellow id=36 z=2
O 2663 84 orb=yellow id=36 z=2
O 2667 82 orb=green id=1022 z=2
O 2671 84 orb=yellow id=36 z=2
O 2675 86 orb=yellow id=36 z=2
O 2679 88 orb=green id=1022 z=2
O 2683 86 orb=yellow id=36 z=2
A 2687 84 ar=green id=1704 z=2
O 2704 86 orb=yellow id=36 z=2
O 2700 84 orb=green id=1022 z=2
O 2708 88 orb=yellow id=36 z=2
O 2712 90 orb=green id=1022 z=2
O 2716 88 orb=yellow id=36 z=2
O 2720 86 orb=yellow id=36 z=2
O 2724 84 orb=green id=1022 z=2
O 2728 86 orb=yellow id=36 z=2
O 2732 88 orb=yellow id=36 z=2
O 2736 90 orb=green id=1022 z=2
O 2740 88 orb=yellow id=36 z=2
A 2744 86 ar=green id=1704 z=2
O 2761 88 orb=yellow id=36 z=2
O 2757 86 orb=green id=1022 z=2
O 2765 90 orb=yellow id=36 z=2
O 2769 92 orb=green id=1022 z=2
O 2773 90 orb=yellow id=36 z=2
O 2777 88 orb=yellow id=36 z=2
O 2781 86 orb=green id=1022 z=2
O 2785 88 orb=yellow id=36 z=2
O 2789 90 orb=yellow id=36 z=2
O 2793 92 orb=green id=1022 z=2
O 2797 90 orb=yellow id=36 z=2
E 2810.117 97.792 art=3818 id=3818 z=3
O 2867 90 orb=yellow fx=1 id=36 z=2
E 2861 87 fx=1 art=3818 id=3818 z=3
O 2871 88 orb=yellow fx=1 id=36 z=2
O 2875 86 orb=green fx=1 id=1022 z=2
O 2879 88 orb=yellow fx=1 id=36 z=2
O 2883 90 orb=yellow fx=1 id=36 z=2
O 2887 92 orb=green fx=1 id=1022 z=2
O 2891 90 orb=yellow fx=1 id=36 z=2
O 2895 88 orb=yellow fx=1 id=36 z=2
O 2899 86 orb=green fx=1 id=1022 z=2
O 2903 88 orb=yellow fx=1 id=36 z=2
A 2852 97 rot=45 ar=pink id=1751 z=2
A 2907 90 ar=green id=1704 z=2
O 2924 92 orb=yellow id=36 z=2
O 2920 90 orb=green id=1022 z=2
O 2928 94 orb=yellow id=36 z=2
O 2932 96 orb=green id=1022 z=2
O 2936 94 orb=yellow id=36 z=2
O 2940 92 orb=yellow id=36 z=2
O 2944 90 orb=green id=1022 z=2
O 2948 92 orb=yellow id=36 z=2
O 2952 94 orb=yellow id=36 z=2
O 2956 96 orb=green id=1022 z=2
O 2975.06 101 orb=yellow id=36 z=2
E 2969.06 104 art=3818 id=3818 z=3
O 2979.06 103 orb=yellow id=36 z=2
O 2983.06 105 orb=green id=1022 z=2
O 2987.06 103 orb=yellow id=36 z=2
O 2991.06 101 orb=yellow id=36 z=2
O 2995.06 99 orb=green id=1022 z=2
O 2999.06 101 orb=yellow id=36 z=2
O 3003.06 103 orb=yellow id=36 z=2
A 2960 94 rot=-45 ar=pink id=1751 z=2
A 2632 77 rot=-45 ar=green id=1704 z=2
A 2801 88 rot=-45 ar=green id=1704 z=2
O 2816 95 orb=yellow id=36 z=2
O 2820 97 orb=yellow id=36 z=2
O 2824 99 orb=green id=1022 z=2
O 2828 97 orb=yellow id=36 z=2
O 2832 95 orb=yellow id=36 z=2
O 2836 93 orb=green id=1022 z=2
O 2840 95 orb=yellow id=36 z=2
O 2844 97 orb=yellow id=36 z=2
O 2848 99 orb=green id=1022 z=2
R 3005 104 to=ship id=13 z=2
V 3006 104 spd=0 id=200 z=2
C 3032 104 id=2063
W 3007.767 107.083 1.467 2.833 id=1705 z=5
W 3007.767 98.083 1.467 2.833 id=1705 z=5
W 3014.767 98.083 1.467 2.833 id=1705 z=5
W 3015.583 107.729 1.833 3.542 id=1705 z=5
W 3020.767 98.083 1.467 2.833 id=1705 z=5
W 3027.767 107.083 1.467 2.833 id=1705 z=5
W 3028.767 98.083 1.467 2.833 id=1705 z=5
B 3015 108 id=83
B 3014 108 id=83
B 3014 109 id=83
B 3015 109 id=83
B 3016 109 id=83
B 3016 108 id=83
B 3015 110 id=83
B 3014 110 id=83
B 3013 110 id=83
B 3017 111 id=83
B 3011 100 id=83
B 3011 101 id=83
B 3012 100 id=83
B 3009 100 id=83
B 3010 100 id=83
B 3010 99 id=83
B 3011 99 id=83
B 3013 98 id=83
B 3024 100 id=83
B 3024 99 id=83
B 3023 99 id=83
B 3023 100 id=83
B 3025 99 id=83
B 3025 100 id=83
B 3026 99 id=83
B 3024 98 id=83
B 3022 97 id=83
B 3026 97 id=83
B 3027 97 id=83
W 3024.033 107.667 2.933 5.667 id=1705 z=5
W 3018.583 109.729 1.833 3.542 id=1705 z=5
W 3020.261 106.106 2.479 4.788 id=1705 z=5
W 3017.261 96.106 2.479 4.788 id=1705 z=5
W 3012.972 99.48 1.056 2.04 id=1705 z=5
W 3026.972 99.48 1.056 2.04 id=1705 z=5
W 3011.033 107.667 2.933 5.667 id=1705 z=5
W 3031.033 107.667 2.933 5.667 id=1705 z=5
W 3032.033 95.667 2.933 5.667 id=1705 z=5
B 3033 102 id=83
B 3034 102 id=83
B 3034 101 id=83
B 3033 101 id=83
B 3035 101 id=83
B 3035 100 id=83
B 3036 101 id=83
B 3037 99 id=83
B 3035 102 id=83
B 3036 102 id=83
B 3037 102 id=83
B 3038 102 id=83
B 3040 102 id=83
R 3034 104 to=cube id=12 z=2
B 3039 102 id=83
B 3041 102 id=83
B 3042 102 id=83
B 3043 102 id=83
B 3045 102 id=83
B 3046 102 id=83
B 3044 102 id=83
B 3038 101 id=83
B 3040 100 id=83
B 3042 101 id=83
B 3043 100 id=83
B 3041 101 id=83
B 3045 101 id=83
B 3045 100 id=83
B 3046 101 id=83
B 3047 102 id=83
B 3048 102 id=83
B 3049 102 id=83
B 3050 102 id=83
B 3049 101 id=83
B 3051 102 id=83
B 3050 101 id=83
B 3052 102 id=83
B 3051 101 id=83
B 3051 100 id=83
B 3040 101 id=83
V 3052 104 spd=3 id=203 z=2
B 3053 102 id=83
B 3054 102 id=83
B 3054 101 id=83
B 3053 99 id=83
B 3056 100 id=83
O 3061 103 orb=yellow id=36 z=2
O 3067 103 orb=yellow id=36 z=2
H 270 9.95 1 0.05 fm=edge id=468
S 270 10 id=8
S 269 10 id=8
S 268 10 id=8
H 273 5.95 1 0.05 fm=edge id=468
H 272.95 6 0.05 1 rot=90 fm=edge id=468
H 272.95 7 0.05 1 rot=90 fm=edge id=468
B 3072 103 id=83
B 3073 103 id=83
B 3074 103 id=83
B 3073 102 id=83
B 3072 102 id=83
B 3073 101 id=83
B 3072 101 id=83
B 3071 102 id=83
B 3070 100 id=83
O 3077 106 orb=green id=1022 z=2
O 3082 105 orb=yellow id=36 z=2
B 3086 103 id=83
B 3087 103 id=83
B 3055 101 id=83
B 3053 98 id=83
B 3087 104 id=83
B 3088 104 id=83
O 3093 102 orb=green id=1022 z=2
B 3085 105 id=83
B 3090 103 id=83
B 3099 100 id=83
B 3098 100 id=83
B 3100 100 id=83
B 3099 99 id=83
B 3100 99 id=83
B 3101 98 id=83
B 3104 101 id=83
B 3105 102 id=83
B 3104 102 id=83
B 3105 101 id=83
B 3103 101 id=83
O 3109 104 orb=yellow id=36 z=2
D 3115 105 1 0.2 pad=blue id=67 z=2
D 3117 107.8 1 0.2 pad=blue rot=180 id=67 z=2
D 3119 103 1 0.2 pad=blue id=67 z=2
D 3122 107.8 1 0.2 pad=blue rot=180 id=67 z=2
D 3125 104 1 0.2 pad=blue id=67 z=2
D 3131 114.8 1 0.2 pad=blue rot=180 id=67 z=2
D 3137 104 1 0.2 pad=blue id=67 z=2
D 3142 112.8 1 0.2 pad=blue rot=180 id=67 z=2
B 3148 104 id=83
B 3147 104 id=83
B 3146 104 id=83
B 3147 103 id=83
B 3148 103 id=83
B 3149 103 id=83
B 3148 102 id=83
B 3150 101 id=83
B 3147 102 id=83
B 3117 108 id=83
B 3118 108 id=83
B 3118 109 id=83
B 3117 109 id=83
B 3119 109 id=83
B 3120 108 id=83
B 3121 109 id=83
B 3122 108 id=83
B 3122 109 id=83
B 3119 110 id=83
B 3120 109 id=83
B 3118 110 id=83
B 3115 111 id=83
B 3121 111 id=83
B 3123 111 id=83
B 3122 111 id=83
B 3118 102 id=83
B 3119 102 id=83
B 3116 102 id=83
B 3115 103 id=83
B 3115 104 id=83
B 3116 103 id=83
B 3117 102 id=83
B 3120 102 id=83
B 3120 101 id=83
B 3122 102 id=83
B 3121 101 id=83
B 3123 102 id=83
B 3125 103 id=83
B 3125 102 id=83
B 3124 102 id=83
B 3117 101 id=83
B 3114 102 id=83
B 3122 101 id=83
B 3123 101 id=83
B 3125 100 id=83
B 3126 100 id=83
B 3118 100 id=83
B 3131 115 id=83
B 3130 115 id=83
B 3130 116 id=83
B 3137 103 id=83
B 3138 103 id=83
B 3138 102 id=83
B 3139 102 id=83
B 3141 113 id=83
B 3143 113 id=83
B 3142 113 id=83
B 3142 114 id=83
B 3143 114 id=83
O 3154 106 orb=yellow id=36 z=2
O 3159 106 orb=yellow id=36 z=2
B 3165 107 id=83
B 3164 107 id=83
B 3165 106 id=83
B 3166 106 id=83
B 3168 105 id=83
B 3166 105 id=83
B 3163 105 id=83
B 3167 106 id=83
B 3170 109 id=83
B 3171 109 id=83
B 3171 108 id=83
B 3172 108 id=83
B 3174 107 id=83
B 3172 107 id=83
B 3174 106 id=83
B 3174 109 id=83
B 3174 108 id=83
B 3173 109 id=83
O 3175 112 orb=yellow id=36 z=2
O 3181 112 orb=green id=1022 z=2
B 3188 113 id=83
B 3187 113 id=83
B 3187 114 id=83
B 3186 114 id=83
B 3186 113 id=83
B 3188 114 id=83
B 3186 115 id=83
B 3187 115 id=83
B 3189 116 id=83
B 3189 115 id=83
B 3189 114 id=83
B 3185 114 id=83
A 3192 111 rot=180 ar=purple tp=1 id=3004 z=2
B 3192 106 id=83
B 3191 106 id=83
B 3193 105 id=83
B 3192 105 id=83
B 3194 106 id=83
B 3193 106 id=83
B 3195 106 id=83
B 3196 105 id=83
B 3198 105 id=83
B 3199 105 id=83
B 3194 104 id=83
B 3196 103 id=83
B 3190 105 id=83
D 3203 106 1 0.2 pad=blue id=67 z=2
D 3208 115.8 1 0.2 pad=blue rot=180 id=67 z=2
D 3214 105 1 0.2 pad=blue id=67 z=2
D 3224 117.8 1 0.2 pad=blue rot=180 id=67 z=2
D 3218 106 1 0.2 pad=blue id=67 z=2
D 3216 107.8 1 0.2 pad=blue rot=180 id=67 z=2
D 3227 113 1 0.2 pad=blue id=67 z=2
D 3230 117.8 1 0.2 pad=blue rot=180 id=67 z=2
B 3203 105 id=83
B 3202 105 id=83
B 3202 104 id=83
B 3201 105 id=83
B 3204 104 id=83
B 3203 104 id=83
B 3200 103 id=83
B 3208 116 id=83
B 3209 116 id=83
B 3208 117 id=83
B 3210 118 id=83
B 3207 118 id=83
B 3207 117 id=83
B 3206 118 id=83
B 3206 117 id=83
B 3208 118 id=83
B 3210 119 id=83
B 3216 108 id=83
B 3215 108 id=83
B 3215 109 id=83
B 3218 105 id=83
B 3218 104 id=83
B 3217 104 id=83
B 3216 104 id=83
B 3215 104 id=83
B 3215 103 id=83
B 3214 104 id=83
B 3217 102 id=83
B 3218 102 id=83
B 3224 118 id=83
B 3223 118 id=83
B 3224 119 id=83
B 3225 119 id=83
B 3222 120 id=83
B 3230 118 id=83
B 3229 119 id=83
B 3231 118 id=83
B 3227 120 id=83
B 3226 120 id=83
B 3227 112 id=83
B 3226 112 id=83
B 3227 111 id=83
V 3234 113 spd=4 id=1334 z=2
R 3233 113 to=ufo id=111 z=2
W 3237.767 115.083 1.467 2.833 id=1705 z=5
W 3242.767 117.083 1.467 2.833 id=1705 z=5
W 3242.767 107.083 1.467 2.833 id=1705 z=5
W 3245.62 111.8 1.76 3.4 id=1705 z=5
G 3246 116 gd=-1 id=11 z=2
W 3245.767 118.083 1.467 2.833 id=1705 z=5
W 3250.033 116.667 2.933 5.667 id=1705 z=5
W 3249.089 107.707 0.821 1.587 id=1705 z=5
B 3238 110 id=83
B 3238 109 id=83
B 3237 110 id=83
B 3237 109 id=83
B 3239 109 id=83
B 3239 108 id=83
B 3238 108 id=83
B 3236 109 id=83
B 3235 110 id=83
B 3240 108 id=83
B 3244 108 id=83
B 3244 107 id=83
B 3243 107 id=83
B 3245 107 id=83
S 3235 111 id=8
S 3241 108 rot=90 id=8
S 3245 108 id=8
W 3246.517 105.602 1.965 3.797 id=1705 z=5
W 3244.089 119.707 0.821 1.587 id=1705 z=5
B 3240 116 id=83
B 3240 117 id=83
B 3241 117 id=83
B 3241 118 id=83
B 3240 118 id=83
B 3239 117 id=83
B 3239 116 id=83
B 3238 119 id=83
S 3241 116 rot=180 id=8
S 3237 119 rot=-90 id=8
G 3252 113 gd=1 id=10 z=2
W 3250.767 108.083 1.467 2.833 id=1705 z=5
W 3256.767 111.083 1.467 2.833 id=1705 z=5
W 3256.869 108.282 1.261 2.437 id=1705 z=5
W 3259.767 113.083 1.467 2.833 id=1705 z=5
W 3259.033 107.667 2.933 5.667 id=1705 z=5
W 3262.767 111.083 1.467 2.833 id=1705 z=5
W 3261.943 113.423 1.115 2.153 id=1705 z=5
T 3264 117 tpy=-7.667 id=747 z=2
B 3255 109 id=83
B 3254 109 id=83
B 3254 110 id=83
B 3255 110 id=83
B 3253 109 id=83
B 3254 108 id=83
B 3252 107 id=83
B 3256 106 id=83
S 3255 111 id=8
S 3254 111 id=8
B 3254 117 id=83
B 3255 117 id=83
B 3254 118 id=83
B 3256 117 id=83
B 3255 118 id=83
B 3254 119 id=83
B 3257 119 id=83
B 3252 117 id=83
B 3253 118 id=83
W 3269.913 108.367 1.173 2.267 id=1705 z=5
W 3265.767 113.083 1.467 2.833 id=1705 z=5
W 3271.767 107.083 1.467 2.833 id=1705 z=5
W 3267.033 114.667 2.933 5.667 id=1705 z=5
W 3271.767 117.083 1.467 2.833 id=1705 z=5
W 3272.053 109.636 0.895 1.728 id=1705 z=5
W 3274.033 107.667 2.933 5.667 id=1705 z=5
W 3271.082 115.693 0.836 1.615 id=1705 z=5
G 3275 114 gd=-1 id=11 z=2
W 3267.913 107.367 1.173 2.267 id=1705 z=5
W 3275.283 116.148 2.435 4.703 id=1705 z=5
W 3279.767 116.083 1.467 2.833 id=1705 z=5
W 3278.075 115.678 0.851 1.643 id=1705 z=5
W 3287.767 112.083 1.467 2.833 id=1705 z=5
W 3283.767 106.083 1.467 2.833 id=1705 z=5
W 3292.767 113.083 1.467 2.833 id=1705 z=5
B 3278 109 id=83
B 3279 110 id=83
B 3278 110 id=83
B 3279 109 id=83
B 3280 109 id=83
B 3280 108 id=83
B 3279 108 id=83
B 3277 110 id=83
B 3277 109 id=83
B 3278 111 id=83
B 3276 107 id=83
B 3275 107 id=83
W 3280.231 107.049 2.537 4.902 id=1705 z=5
W 3284.075 108.678 0.851 1.643 id=1705 z=5
W 3286.378 105.333 2.244 4.335 id=1705 z=5
G 3288 110 gd=1 id=10 z=2
B 3290 113 id=83
B 3291 113 id=83
B 3290 114 id=83
B 3292 114 id=83
B 3291 114 id=83
B 3292 113 id=83
B 3293 115 id=83
B 3292 115 id=83
B 3291 116 id=83
B 3290 116 id=83
W 3285.334 114.248 2.332 4.505 id=1705 z=5
W 3281.075 114.678 0.851 1.643 id=1705 z=5
W 3282.869 115.282 1.261 2.437 id=1705 z=5
W 3283.957 113.452 1.085 2.097 id=1705 z=5
B 3290 106 id=83
B 3291 107 id=83
B 3290 107 id=83
B 3291 106 id=83
B 3292 107 id=83
B 3292 106 id=83
B 3293 108 id=83
B 3291 108 id=83
B 3289 108 id=83
B 3289 107 id=83
W 3292.767 106.083 1.467 2.833 id=1705 z=5
W 3294.033 114.667 2.933 5.667 id=1705 z=5
W 3303.001 112.537 0.997 1.927 id=1705 z=5
W 3299.95 108.438 1.1 2.125 id=1705 z=5
W 3294.444 103.46 2.112 4.08 id=1705 z=5
W 3299.033 116.667 2.933 5.667 id=1705 z=5
W 3298.053 115.636 0.895 1.728 id=1705 z=5
W 3300.033 99.667 2.933 5.667 id=1705 z=5
W 3304.444 102.46 2.112 4.08 id=1705 z=5
W 3307.033 104.667 2.933 5.667 id=1705 z=5
W 3304.033 116.667 2.933 5.667 id=1705 z=5
W 3311.444 115.46 2.112 4.08 id=1705 z=5
W 3313.268 106.12 2.464 4.76 id=1705 z=5
W 3319.033 104.667 2.933 5.667 id=1705 z=5
W 3317.444 114.46 2.112 4.08 id=1705 z=5
W 3323.444 106.46 2.112 4.08 id=1705 z=5
W 3328.092 115.78 2.816 5.44 id=1705 z=5
B 3306 117 id=83
B 3305 117 id=83
B 3305 118 id=83
B 3304 118 id=83
B 3304 117 id=83
B 3303 118 id=83
B 3307 119 id=83
B 3304 119 id=83
B 3302 120 id=83
B 3310 109 id=83
B 3311 109 id=83
B 3311 108 id=83
B 3309 108 id=83
B 3310 108 id=83
B 3312 108 id=83
B 3311 107 id=83
B 3310 107 id=83
B 3313 106 id=83
B 3312 109 id=83
B 3313 109 id=83
B 3323 115 id=83
B 3322 116 id=83
B 3322 115 id=83
B 3321 116 id=83
B 3323 116 id=83
B 3324 117 id=83
B 3324 116 id=83
B 3321 118 id=83
B 3320 118 id=83
B 3319 118 id=83
S 3309 109 id=8
S 3310 110 id=8
S 3311 110 id=8
S 3312 110 id=8
S 3313 110 id=8
S 3322 114 rot=180 id=8
S 3323 114 rot=180 id=8
S 3324 115 rot=180 id=8
S 3321 115 rot=180 id=8
W 3308.767 117.083 1.467 2.833 id=1705 z=5
W 3305.009 106.551 0.983 1.898 id=1705 z=5
W 3297.884 104.31 1.232 2.38 id=1705 z=5
W 3296.554 100.673 1.892 3.655 id=1705 z=5
B 3315 116 id=83
B 3316 116 id=83
B 3314 116 id=83
B 3315 117 id=83
B 3314 117 id=83
B 3314 118 id=83
B 3316 118 id=83
B 3313 117 id=83
S 3314 115 rot=180 id=8
S 3315 115 rot=180 id=8
S 3316 115 rot=180 id=8
W 3316.972 108.48 1.056 2.04 id=1705 z=5
W 3324.708 115.97 1.584 3.06 id=1705 z=5
W 3326.84 114.225 1.32 2.55 id=1705 z=5
B 3327 108 id=83
B 3328 108 id=83
B 3328 107 id=83
B 3327 109 id=83
B 3327 107 id=83
B 3326 109 id=83
B 3325 107 id=83
B 3326 108 id=83
S 3327 110 id=8
S 3326 110 id=8
S 3328 109 id=8
W 3334.481 115.531 2.039 3.938 id=1705 z=5
W 3327.488 105.545 2.024 3.91 id=1705 z=5
W 3334.033 104.667 2.933 5.667 id=1705 z=5
W 3338.525 104.616 1.951 3.768 id=1705 z=5
W 3340.767 107.083 1.467 2.833 id=1705 z=5
B 3337 117 id=83
B 3338 117 id=83
B 3338 116 id=83
B 3336 117 id=83
B 3336 118 id=83
B 3337 118 id=83
B 3339 119 id=83
S 3336 116 rot=180 id=8
S 3337 116 rot=180 id=8
S 3338 115 rot=180 id=8
W 3331.723 114.998 1.555 3.003 id=1705 z=5
W 3330.605 103.772 1.789 3.457 id=1705 z=5
W 3330.605 106.772 1.789 3.457 id=1705 z=5
W 3337.957 107.452 1.085 2.097 id=1705 z=5
W 3338.605 115.772 1.789 3.457 id=1705 z=5
W 3345.033 114.667 2.933 5.667 id=1705 z=5
B 3344 108 id=83
B 3345 108 id=83
B 3343 107 id=83
B 3344 107 id=83
B 3345 107 id=83
B 3345 106 id=83
B 3343 106 id=83
B 3346 108 id=83
B 3346 107 id=83
B 3347 108 id=83
B 3347 106 id=83
B 3347 107 id=83
S 3343 108 id=8
S 3344 109 id=8
S 3345 109 id=8
S 3346 109 id=8
S 3347 109 id=8
W 3341.605 114.772 1.789 3.457 id=1705 z=5
R 3348 112 to=wave id=660 z=2
W 3350.767 113.083 1.467 2.833 id=1705 z=5
W 3355.767 107.083 1.467 2.833 id=1705 z=5
W 3359.979 112.494 1.041 2.012 id=1705 z=5
W 3362.561 105.687 1.877 3.627 id=1705 z=5
W 3365.979 110.494 1.041 2.012 id=1705 z=5
W 3370.965 113.466 1.071 2.068 id=1705 z=5
W 3376.767 109.083 1.467 2.833 id=1705 z=5
W 3384.605 106.772 1.789 3.457 id=1705 z=5
W 3389.067 110.664 0.865 1.672 id=1705 z=5
W 3394.987 106.508 1.027 1.983 id=1705 z=5
W 3400.935 106.409 1.129 2.182 id=1705 z=5
W 3403.591 110.743 1.819 3.513 id=1705 z=5
W 3349.767 105.083 1.467 2.833 id=1705 z=5
W 3371.906 106.353 1.188 2.295 id=1705 z=5
W 3354.767 116.083 1.467 2.833 id=1705 z=5
W 3362.576 115.715 1.848 3.57 id=1705 z=5
W 3376.767 115.083 1.467 2.833 id=1705 z=5
W 3391.877 114.296 1.247 2.408 id=1705 z=5
W 3398.503 115.573 1.995 3.853 id=1705 z=5
W 3398.001 110.537 0.997 1.927 id=1705 z=5
W 3385.664 114.885 1.672 3.23 id=1705 z=5
W 3382.133 112.792 0.733 1.417 id=1705 z=5
V 3404 108 spd=0 id=200 z=2
V 3404 115 spd=0 id=200 z=2
R 3424 112 to=cube id=12 z=2
B 3424 110 id=83
B 3423 110 id=83
B 3422 109 id=83
B 3421 108 id=83
B 3420 107 id=83
B 3424 114 id=83
B 3423 114 id=83
B 3422 115 id=83
B 3421 116 id=83
B 3420 117 id=83
B 3421 117 id=83
B 3422 117 id=83
B 3423 116 id=83
B 3422 116 id=83
B 3423 117 id=83
B 3424 117 id=83
B 3424 116 id=83
B 3423 115 id=83
B 3424 115 id=83
B 3424 109 id=83
B 3423 109 id=83
B 3424 108 id=83
B 3423 108 id=83
B 3422 108 id=83
B 3424 107 id=83
B 3423 107 id=83
B 3422 107 id=83
B 3421 107 id=83
B 3421 109 id=83
B 3420 108 id=83
B 3419 108 id=83
B 3419 107 id=83
B 3418 107 id=83
B 3418 108 id=83
B 3417 107 id=83
B 3416 107 id=83
B 3415 107 id=83
B 3414 107 id=83
B 3421 115 id=83
B 3420 116 id=83
B 3419 116 id=83
B 3418 116 id=83
B 3419 117 id=83
B 3418 117 id=83
B 3417 117 id=83
B 3416 117 id=83
B 3415 117 id=83
B 3414 117 id=83
B 3420 115 id=83
B 3417 116 id=83
B 3416 116 id=83
B 3413 117 id=83
B 3412 117 id=83
B 3411 117 id=83
B 3420 109 id=83
B 3417 108 id=83
B 3416 108 id=83
B 3413 107 id=83
B 3411 107 id=83
B 3410 107 id=83
B 3412 107 id=83
B 3425 107 id=83
B 3427 107 id=83
B 3426 107 id=83
B 3428 107 id=83
B 3429 107 id=83
B 3430 107 id=83
B 3432 107 id=83
B 3431 107 id=83
B 3433 107 id=83
B 3434 107 id=83
B 3435 107 id=83
B 3436 107 id=83
B 3437 107 id=83
B 3438 107 id=83
B 3439 107 id=83
B 3440 107 id=83
B 3441 107 id=83
B 3442 107 id=83
B 3443 107 id=83
B 3444 107 id=83
B 3445 107 id=83
B 3446 107 id=83
B 3447 107 id=83
B 3448 107 id=83
B 3449 107 id=83
B 3450 107 id=83
B 3451 107 id=83
B 3452 107 id=83
B 3453 107 id=83
B 3454 107 id=83
B 3455 107 id=83
B 3456 107 id=83
B 3457 107 id=83
B 3458 107 id=83
B 3459 107 id=83
B 3460 107 id=83
B 3461 107 id=83
B 3462 107 id=83
B 3463 107 id=83
B 3464 107 id=83
B 3465 107 id=83
B 3466 107 id=83
B 3467 107 id=83
B 3468 107 id=83
B 3469 107 id=83
B 3470 107 id=83
B 3471 107 id=83
B 3472 107 id=83
B 3473 107 id=83
B 3474 107 id=83
B 3475 107 id=83
B 3476 107 id=83
B 3477 107 id=83
B 3478 107 id=83
B 3479 107 id=83
B 3480 107 id=83
B 3481 107 id=83
B 3482 107 id=83
B 3483 107 id=83
B 3484 107 id=83
B 3485 107 id=83
B 3486 107 id=83
B 3487 107 id=83
B 3488 107 id=83
B 3489 107 id=83
B 3490 107 id=83
B 3491 107 id=83
B 3492 107 id=83
B 3493 107 id=83
B 3494 107 id=83
B 3495 107 id=83
B 3496 107 id=83
B 3497 107 id=83
B 3498 107 id=83
B 3499 107 id=83
B 3500 107 id=83
B 3501 107 id=83
B 3502 107 id=83
B 3503 107 id=83
B 3504 107 id=83
B 3505 107 id=83
B 3506 107 id=83
B 3508 107 id=83
B 3509 107 id=83
B 3510 107 id=83
B 3507 107 id=83
B 3511 107 id=83
B 3512 107 id=83
B 3513 107 id=83
B 3515 107 id=83
B 3514 107 id=83
B 3516 107 id=83
B 3517 107 id=83
B 3518 107 id=83
B 3519 107 id=83
B 3520 107 id=83
B 3521 107 id=83
B 3522 107 id=83
B 3523 107 id=83
B 3524 107 id=83
B 3525 107 id=83
B 3526 107 id=83
B 3527 107 id=83
B 3528 107 id=83
B 3529 107 id=83
B 3530 107 id=83
B 3531 107 id=83
B 3532 107 id=83
B 3534 107 id=83
B 3535 107 id=83
B 3533 107 id=83
B 3536 107 id=83
B 3537 107 id=83
B 3538 107 id=83
B 3539 107 id=83
B 3540 107 id=83
B 3541 107 id=83
B 3542 107 id=83
B 3544 107 id=83
B 3543 107 id=83
B 3545 107 id=83
B 3546 107 id=83
B 3548 107 id=83
B 3547 107 id=83
B 3549 107 id=83
B 3550 107 id=83
B 3551 107 id=83
B 3552 107 id=83
B 3553 107 id=83
B 3554 107 id=83
B 3555 107 id=83
B 3556 107 id=83
B 3557 107 id=83
B 3558 107 id=83
B 3559 107 id=83
B 3560 107 id=83
B 3561 107 id=83
B 3562 107 id=83
B 3563 107 id=83
B 3564 107 id=83
B 3565 107 id=83
B 3566 107 id=83
B 3567 107 id=83
B 3568 107 id=83
B 3569 107 id=83
B 3570 107 id=83
B 3571 107 id=83
B 3572 107 id=83
B 3573 107 id=83
B 3574 107 id=83
B 3575 107 id=83
B 3576 107 id=83
B 3577 107 id=83
B 3578 107 id=83
B 3579 107 id=83
B 3580 107 id=83
B 3581 107 id=83
B 3582 107 id=83
B 3583 107 id=83
B 3584 107 id=83
B 3585 107 id=83
B 3586 107 id=83
B 3587 107 id=83
B 3588 107 id=83
B 3589 107 id=83
B 3590 107 id=83
B 3591 107 id=83
B 3592 107 id=83
B 3593 107 id=83
B 3594 107 id=83
B 3595 107 id=83
B 3596 107 id=83
B 3597 107 id=83
B 3598 107 id=83
B 3599 107 id=83
B 3600 107 id=83
B 3602 107 id=83
B 3601 107 id=83
B 3603 107 id=83
E 0 3 art=3638 id=3638 z=8 g=1
E 0 4 art=3638 id=3638 z=8 g=1
E 0 5 art=3638 id=3638 z=8 g=1
E 0 6 art=3638 id=3638 z=8 g=1
E 0 7 art=3638 id=3638 z=8 g=1
E 0 8 art=3638 id=3638 z=8 g=1
E 0 9 art=3638 id=3638 z=8 g=1
E 0 10 art=3638 id=3638 z=8 g=1
E 0 11 art=3638 id=3638 z=8 g=1
E 0 12 art=3638 id=3638 z=8 g=1
E 0 13 art=3638 id=3638 z=8 g=1
E 0 14 art=3638 id=3638 z=8 g=1
E 0 15 art=3638 id=3638 z=8 g=1
E 0 16 art=3638 id=3638 z=8 g=1
E 0 17 art=3638 id=3638 z=8 g=1
E 0 18 art=3638 id=3638 z=8 g=1
E 1 18 art=3638 id=3638 z=8 g=1
E 1 17 art=3638 id=3638 z=8 g=1
E 1 16 art=3638 id=3638 z=8 g=1
E 1 15 art=3638 id=3638 z=8 g=1
E 1 14 art=3638 id=3638 z=8 g=1
E 1 13 art=3638 id=3638 z=8 g=1
E 1 12 art=3638 id=3638 z=8 g=1
E 1 11 art=3638 id=3638 z=8 g=1
E 1 10 art=3638 id=3638 z=8 g=1
E 1 9 art=3638 id=3638 z=8 g=1
E 1 8 art=3638 id=3638 z=8 g=1
E 1 7 art=3638 id=3638 z=8 g=1
E 1 6 art=3638 id=3638 z=8 g=1
E 1 5 art=3638 id=3638 z=8 g=1
E 1 4 art=3638 id=3638 z=8 g=1
E 1 3 art=3638 id=3638 z=8 g=1
E 2.333 3 art=3638 id=3638 z=8 g=1
E 2.333 4 art=3638 id=3638 z=8 g=1
E 2.333 5 art=3638 id=3638 z=8 g=1
E 2.333 6 art=3638 id=3638 z=8 g=1
E 2.333 7 art=3638 id=3638 z=8 g=1
E 2.333 8 art=3638 id=3638 z=8 g=1
E 2.333 9 art=3638 id=3638 z=8 g=1
E 2.333 10 art=3638 id=3638 z=8 g=1
E 2.333 11 art=3638 id=3638 z=8 g=1
E 2.333 12 art=3638 id=3638 z=8 g=1
E 2.333 13 art=3638 id=3638 z=8 g=1
E 2.333 14 art=3638 id=3638 z=8 g=1
E 2.333 15 art=3638 id=3638 z=8 g=1
E 2.333 16 art=3638 id=3638 z=8 g=1
E 2.333 17 art=3638 id=3638 z=8 g=1
E 2.333 18 art=3638 id=3638 z=8 g=1
E 3.333 18 art=3638 id=3638 z=8 g=1
E 3.333 17 art=3638 id=3638 z=8 g=1
E 3.333 16 art=3638 id=3638 z=8 g=1
E 3.333 15 art=3638 id=3638 z=8 g=1
E 3.333 14 art=3638 id=3638 z=8 g=1
E 3.333 13 art=3638 id=3638 z=8 g=1
E 3.333 12 art=3638 id=3638 z=8 g=1
E 3.333 11 art=3638 id=3638 z=8 g=1
E 3.333 10 art=3638 id=3638 z=8 g=1
E 3.333 9 art=3638 id=3638 z=8 g=1
E 3.333 8 art=3638 id=3638 z=8 g=1
E 3.333 7 art=3638 id=3638 z=8 g=1
E 3.333 6 art=3638 id=3638 z=8 g=1
E 3.333 5 art=3638 id=3638 z=8 g=1
E 3.333 4 art=3638 id=3638 z=8 g=1
E 3.333 3 art=3638 id=3638 z=8 g=1
E 4.667 3 art=3638 id=3638 z=8 g=1
E 4.667 4 art=3638 id=3638 z=8 g=1
E 4.667 5 art=3638 id=3638 z=8 g=1
E 4.667 6 art=3638 id=3638 z=8 g=1
E 4.667 7 art=3638 id=3638 z=8 g=1
E 4.667 8 art=3638 id=3638 z=8 g=1
E 4.667 9 art=3638 id=3638 z=8 g=1
E 4.667 10 art=3638 id=3638 z=8 g=1
E 4.667 11 art=3638 id=3638 z=8 g=1
E 4.667 12 art=3638 id=3638 z=8 g=1
E 4.667 13 art=3638 id=3638 z=8 g=1
E 4.667 14 art=3638 id=3638 z=8 g=1
E 4.667 15 art=3638 id=3638 z=8 g=1
E 4.667 16 art=3638 id=3638 z=8 g=1
E 4.667 17 art=3638 id=3638 z=8 g=1
E 4.667 18 art=3638 id=3638 z=8 g=1
E 5.667 18 art=3638 id=3638 z=8 g=1
E 5.667 17 art=3638 id=3638 z=8 g=1
E 5.667 16 art=3638 id=3638 z=8 g=1
E 5.667 15 art=3638 id=3638 z=8 g=1
E 5.667 14 art=3638 id=3638 z=8 g=1
E 5.667 13 art=3638 id=3638 z=8 g=1
E 5.667 12 art=3638 id=3638 z=8 g=1
E 5.667 11 art=3638 id=3638 z=8 g=1
E 5.667 10 art=3638 id=3638 z=8 g=1
E 5.667 9 art=3638 id=3638 z=8 g=1
E 5.667 8 art=3638 id=3638 z=8 g=1
E 5.667 7 art=3638 id=3638 z=8 g=1
E 5.667 6 art=3638 id=3638 z=8 g=1
E 5.667 5 art=3638 id=3638 z=8 g=1
E 5.667 4 art=3638 id=3638 z=8 g=1
E 5.667 3 art=3638 id=3638 z=8 g=1
E 7 3 art=3638 id=3638 z=8 g=1
E 7 4 art=3638 id=3638 z=8 g=1
E 7 5 art=3638 id=3638 z=8 g=1
E 7 6 art=3638 id=3638 z=8 g=1
E 7 7 art=3638 id=3638 z=8 g=1
E 7 8 art=3638 id=3638 z=8 g=1
E 7 9 art=3638 id=3638 z=8 g=1
E 7 10 art=3638 id=3638 z=8 g=1
E 7 11 art=3638 id=3638 z=8 g=1
E 7 12 art=3638 id=3638 z=8 g=1
E 7 13 art=3638 id=3638 z=8 g=1
E 7 14 art=3638 id=3638 z=8 g=1
E 7 15 art=3638 id=3638 z=8 g=1
E 7 16 art=3638 id=3638 z=8 g=1
E 7 17 art=3638 id=3638 z=8 g=1
E 7 18 art=3638 id=3638 z=8 g=1
E 8 18 art=3638 id=3638 z=8 g=1
E 8 17 art=3638 id=3638 z=8 g=1
E 8 16 art=3638 id=3638 z=8 g=1
E 8 15 art=3638 id=3638 z=8 g=1
E 8 14 art=3638 id=3638 z=8 g=1
E 8 13 art=3638 id=3638 z=8 g=1
E 8 12 art=3638 id=3638 z=8 g=1
E 8 11 art=3638 id=3638 z=8 g=1
E 8 10 art=3638 id=3638 z=8 g=1
E 8 9 art=3638 id=3638 z=8 g=1
E 8 8 art=3638 id=3638 z=8 g=1
E 8 7 art=3638 id=3638 z=8 g=1
E 8 6 art=3638 id=3638 z=8 g=1
E 8 5 art=3638 id=3638 z=8 g=1
E 8 4 art=3638 id=3638 z=8 g=1
E 8 3 art=3638 id=3638 z=8 g=1
E 9.333 3 art=3638 id=3638 z=8 g=1
E 9.333 4 art=3638 id=3638 z=8 g=1
E 9.333 5 art=3638 id=3638 z=8 g=1
E 9.333 6 art=3638 id=3638 z=8 g=1
E 9.333 7 art=3638 id=3638 z=8 g=1
E 9.333 8 art=3638 id=3638 z=8 g=1
E 9.333 9 art=3638 id=3638 z=8 g=1
E 9.333 10 art=3638 id=3638 z=8 g=1
E 9.333 11 art=3638 id=3638 z=8 g=1
E 9.333 12 art=3638 id=3638 z=8 g=1
E 9.333 13 art=3638 id=3638 z=8 g=1
E 9.333 14 art=3638 id=3638 z=8 g=1
E 9.333 15 art=3638 id=3638 z=8 g=1
E 9.333 16 art=3638 id=3638 z=8 g=1
E 9.333 17 art=3638 id=3638 z=8 g=1
E 9.333 18 art=3638 id=3638 z=8 g=1
E 10.333 18 art=3638 id=3638 z=8 g=1
E 10.333 17 art=3638 id=3638 z=8 g=1
E 10.333 16 art=3638 id=3638 z=8 g=1
E 10.333 15 art=3638 id=3638 z=8 g=1
E 10.333 14 art=3638 id=3638 z=8 g=1
E 10.333 13 art=3638 id=3638 z=8 g=1
E 10.333 12 art=3638 id=3638 z=8 g=1
E 10.333 11 art=3638 id=3638 z=8 g=1
E 10.333 10 art=3638 id=3638 z=8 g=1
E 10.333 9 art=3638 id=3638 z=8 g=1
E 10.333 8 art=3638 id=3638 z=8 g=1
E 10.333 7 art=3638 id=3638 z=8 g=1
E 10.333 6 art=3638 id=3638 z=8 g=1
E 10.333 5 art=3638 id=3638 z=8 g=1
E 10.333 4 art=3638 id=3638 z=8 g=1
E 10.333 3 art=3638 id=3638 z=8 g=1
E 11.667 3 art=3638 id=3638 z=8 g=1
E 11.667 4 art=3638 id=3638 z=8 g=1
E 11.667 5 art=3638 id=3638 z=8 g=1
E 11.667 6 art=3638 id=3638 z=8 g=1
E 11.667 7 art=3638 id=3638 z=8 g=1
E 11.667 8 art=3638 id=3638 z=8 g=1
E 11.667 9 art=3638 id=3638 z=8 g=1
E 11.667 10 art=3638 id=3638 z=8 g=1
E 11.667 11 art=3638 id=3638 z=8 g=1
E 11.667 12 art=3638 id=3638 z=8 g=1
E 11.667 13 art=3638 id=3638 z=8 g=1
E 11.667 14 art=3638 id=3638 z=8 g=1
E 11.667 15 art=3638 id=3638 z=8 g=1
E 11.667 16 art=3638 id=3638 z=8 g=1
E 11.667 17 art=3638 id=3638 z=8 g=1
E 11.667 18 art=3638 id=3638 z=8 g=1
E 12.667 18 art=3638 id=3638 z=8 g=1
E 12.667 17 art=3638 id=3638 z=8 g=1
E 12.667 16 art=3638 id=3638 z=8 g=1
E 12.667 15 art=3638 id=3638 z=8 g=1
E 12.667 14 art=3638 id=3638 z=8 g=1
E 12.667 13 art=3638 id=3638 z=8 g=1
E 12.667 12 art=3638 id=3638 z=8 g=1
E 12.667 11 art=3638 id=3638 z=8 g=1
E 12.667 10 art=3638 id=3638 z=8 g=1
E 12.667 9 art=3638 id=3638 z=8 g=1
E 12.667 8 art=3638 id=3638 z=8 g=1
E 12.667 7 art=3638 id=3638 z=8 g=1
E 12.667 6 art=3638 id=3638 z=8 g=1
E 12.667 5 art=3638 id=3638 z=8 g=1
E 12.667 4 art=3638 id=3638 z=8 g=1
E 12.667 3 art=3638 id=3638 z=8 g=1
E 14 3 art=3638 id=3638 z=8 g=1
E 14 4 art=3638 id=3638 z=8 g=1
E 14 5 art=3638 id=3638 z=8 g=1
E 14 6 art=3638 id=3638 z=8 g=1
E 14 7 art=3638 id=3638 z=8 g=1
E 14 8 art=3638 id=3638 z=8 g=1
E 14 9 art=3638 id=3638 z=8 g=1
E 14 10 art=3638 id=3638 z=8 g=1
E 14 11 art=3638 id=3638 z=8 g=1
E 14 12 art=3638 id=3638 z=8 g=1
E 14 13 art=3638 id=3638 z=8 g=1
E 14 14 art=3638 id=3638 z=8 g=1
E 14 15 art=3638 id=3638 z=8 g=1
E 14 16 art=3638 id=3638 z=8 g=1
E 14 17 art=3638 id=3638 z=8 g=1
E 14 18 art=3638 id=3638 z=8 g=1
E 15 18 art=3638 id=3638 z=8 g=1
E 15 17 art=3638 id=3638 z=8 g=1
E 15 16 art=3638 id=3638 z=8 g=1
E 15 15 art=3638 id=3638 z=8 g=1
E 15 14 art=3638 id=3638 z=8 g=1
E 15 13 art=3638 id=3638 z=8 g=1
E 15 12 art=3638 id=3638 z=8 g=1
E 15 11 art=3638 id=3638 z=8 g=1
E 15 10 art=3638 id=3638 z=8 g=1
E 15 9 art=3638 id=3638 z=8 g=1
E 15 8 art=3638 id=3638 z=8 g=1
E 15 7 art=3638 id=3638 z=8 g=1
E 15 6 art=3638 id=3638 z=8 g=1
E 15 5 art=3638 id=3638 z=8 g=1
E 15 4 art=3638 id=3638 z=8 g=1
E 15 3 art=3638 id=3638 z=8 g=1
E 16.333 3 art=3638 id=3638 z=8 g=1
E 16.333 4 art=3638 id=3638 z=8 g=1
E 16.333 5 art=3638 id=3638 z=8 g=1
E 16.333 6 art=3638 id=3638 z=8 g=1
E 16.333 7 art=3638 id=3638 z=8 g=1
E 16.333 8 art=3638 id=3638 z=8 g=1
E 16.333 9 art=3638 id=3638 z=8 g=1
E 16.333 10 art=3638 id=3638 z=8 g=1
E 16.333 11 art=3638 id=3638 z=8 g=1
E 16.333 12 art=3638 id=3638 z=8 g=1
E 16.333 13 art=3638 id=3638 z=8 g=1
E 16.333 14 art=3638 id=3638 z=8 g=1
E 16.333 15 art=3638 id=3638 z=8 g=1
E 16.333 16 art=3638 id=3638 z=8 g=1
E 16.333 17 art=3638 id=3638 z=8 g=1
E 16.333 18 art=3638 id=3638 z=8 g=1
E 17.333 18 art=3638 id=3638 z=8 g=1
E 17.333 17 art=3638 id=3638 z=8 g=1
E 17.333 16 art=3638 id=3638 z=8 g=1
E 17.333 15 art=3638 id=3638 z=8 g=1
E 17.333 14 art=3638 id=3638 z=8 g=1
E 17.333 13 art=3638 id=3638 z=8 g=1
E 17.333 12 art=3638 id=3638 z=8 g=1
E 17.333 11 art=3638 id=3638 z=8 g=1
E 17.333 10 art=3638 id=3638 z=8 g=1
E 17.333 9 art=3638 id=3638 z=8 g=1
E 17.333 8 art=3638 id=3638 z=8 g=1
E 17.333 7 art=3638 id=3638 z=8 g=1
E 17.333 6 art=3638 id=3638 z=8 g=1
E 17.333 5 art=3638 id=3638 z=8 g=1
E 17.333 4 art=3638 id=3638 z=8 g=1
E 17.333 3 art=3638 id=3638 z=8 g=1
E 18.667 3 art=3638 id=3638 z=8 g=1
E 18.667 4 art=3638 id=3638 z=8 g=1
E 18.667 5 art=3638 id=3638 z=8 g=1
E 18.667 6 art=3638 id=3638 z=8 g=1
E 18.667 7 art=3638 id=3638 z=8 g=1
E 18.667 8 art=3638 id=3638 z=8 g=1
E 18.667 9 art=3638 id=3638 z=8 g=1
E 18.667 10 art=3638 id=3638 z=8 g=1
E 18.667 11 art=3638 id=3638 z=8 g=1
E 18.667 12 art=3638 id=3638 z=8 g=1
E 18.667 13 art=3638 id=3638 z=8 g=1
E 18.667 14 art=3638 id=3638 z=8 g=1
E 18.667 15 art=3638 id=3638 z=8 g=1
E 18.667 16 art=3638 id=3638 z=8 g=1
E 18.667 17 art=3638 id=3638 z=8 g=1
E 18.667 18 art=3638 id=3638 z=8 g=1
E 19.667 18 art=3638 id=3638 z=8 g=1
E 19.667 17 art=3638 id=3638 z=8 g=1
E 19.667 16 art=3638 id=3638 z=8 g=1
E 19.667 15 art=3638 id=3638 z=8 g=1
E 19.667 14 art=3638 id=3638 z=8 g=1
E 19.667 13 art=3638 id=3638 z=8 g=1
E 19.667 12 art=3638 id=3638 z=8 g=1
E 19.667 11 art=3638 id=3638 z=8 g=1
E 19.667 10 art=3638 id=3638 z=8 g=1
E 19.667 9 art=3638 id=3638 z=8 g=1
E 19.667 8 art=3638 id=3638 z=8 g=1
E 19.667 7 art=3638 id=3638 z=8 g=1
E 19.667 6 art=3638 id=3638 z=8 g=1
E 19.667 5 art=3638 id=3638 z=8 g=1
E 19.667 4 art=3638 id=3638 z=8 g=1
E 19.667 3 art=3638 id=3638 z=8 g=1
E 21 3 art=3638 id=3638 z=8 g=1
E 21 4 art=3638 id=3638 z=8 g=1
E 21 5 art=3638 id=3638 z=8 g=1
E 21 6 art=3638 id=3638 z=8 g=1
E 21 7 art=3638 id=3638 z=8 g=1
E 21 8 art=3638 id=3638 z=8 g=1
E 21 9 art=3638 id=3638 z=8 g=1
E 21 10 art=3638 id=3638 z=8 g=1
E 21 11 art=3638 id=3638 z=8 g=1
E 21 12 art=3638 id=3638 z=8 g=1
E 21 13 art=3638 id=3638 z=8 g=1
E 21 14 art=3638 id=3638 z=8 g=1
E 21 15 art=3638 id=3638 z=8 g=1
E 21 16 art=3638 id=3638 z=8 g=1
E 21 17 art=3638 id=3638 z=8 g=1
E 21 18 art=3638 id=3638 z=8 g=1
E 22 18 art=3638 id=3638 z=8 g=1
E 22 17 art=3638 id=3638 z=8 g=1
E 22 16 art=3638 id=3638 z=8 g=1
E 22 15 art=3638 id=3638 z=8 g=1
E 22 14 art=3638 id=3638 z=8 g=1
E 22 13 art=3638 id=3638 z=8 g=1
E 22 12 art=3638 id=3638 z=8 g=1
E 22 11 art=3638 id=3638 z=8 g=1
E 22 10 art=3638 id=3638 z=8 g=1
E 22 9 art=3638 id=3638 z=8 g=1
E 22 8 art=3638 id=3638 z=8 g=1
E 22 7 art=3638 id=3638 z=8 g=1
E 22 6 art=3638 id=3638 z=8 g=1
E 22 5 art=3638 id=3638 z=8 g=1
E 22 4 art=3638 id=3638 z=8 g=1
E 22 3 art=3638 id=3638 z=8 g=1
E 23.333 3 art=3638 id=3638 z=8 g=1
E 23.333 4 art=3638 id=3638 z=8 g=1
E 23.333 5 art=3638 id=3638 z=8 g=1
E 23.333 6 art=3638 id=3638 z=8 g=1
E 23.333 7 art=3638 id=3638 z=8 g=1
E 23.333 8 art=3638 id=3638 z=8 g=1
E 23.333 9 art=3638 id=3638 z=8 g=1
E 23.333 11 art=3638 id=3638 z=8 g=1
E 23.333 12 art=3638 id=3638 z=8 g=1
E 23.333 13 art=3638 id=3638 z=8 g=1
E 23.333 14 art=3638 id=3638 z=8 g=1
E 23.333 15 art=3638 id=3638 z=8 g=1
E 23.333 16 art=3638 id=3638 z=8 g=1
E 23.333 17 art=3638 id=3638 z=8 g=1
E 23.333 18 art=3638 id=3638 z=8 g=1
E 24.333 18 art=3638 id=3638 z=8 g=1
E 24.333 17 art=3638 id=3638 z=8 g=1
E 24.333 16 art=3638 id=3638 z=8 g=1
E 24.333 15 art=3638 id=3638 z=8 g=1
E 24.333 14 art=3638 id=3638 z=8 g=1
E 24.333 13 art=3638 id=3638 z=8 g=1
E 24.333 12 art=3638 id=3638 z=8 g=1
E 24.333 11 art=3638 id=3638 z=8 g=1
E 24.333 10 art=3638 id=3638 z=8 g=1
E 24.333 9 art=3638 id=3638 z=8 g=1
E 24.333 8 art=3638 id=3638 z=8 g=1
E 24.333 7 art=3638 id=3638 z=8 g=1
E 24.333 6 art=3638 id=3638 z=8 g=1
E 24.333 5 art=3638 id=3638 z=8 g=1
E 24.333 4 art=3638 id=3638 z=8 g=1
E 24.333 3 art=3638 id=3638 z=8 g=1
E 25.667 3 art=3638 id=3638 z=8 g=1
E 25.667 4 art=3638 id=3638 z=8 g=1
E 25.667 5 art=3638 id=3638 z=8 g=1
E 25.667 6 art=3638 id=3638 z=8 g=1
E 25.667 7 art=3638 id=3638 z=8 g=1
E 25.667 8 art=3638 id=3638 z=8 g=1
E 25.667 9 art=3638 id=3638 z=8 g=1
E 25.667 10 art=3638 id=3638 z=8 g=1
E 25.667 11 art=3638 id=3638 z=8 g=1
E 25.667 12 art=3638 id=3638 z=8 g=1
E 25.667 13 art=3638 id=3638 z=8 g=1
E 25.667 14 art=3638 id=3638 z=8 g=1
E 25.667 15 art=3638 id=3638 z=8 g=1
E 25.667 16 art=3638 id=3638 z=8 g=1
E 25.667 17 art=3638 id=3638 z=8 g=1
E 25.667 18 art=3638 id=3638 z=8 g=1
E 26.667 18 art=3638 id=3638 z=8 g=1
E 26.667 17 art=3638 id=3638 z=8 g=1
E 26.667 16 art=3638 id=3638 z=8 g=1
E 26.667 15 art=3638 id=3638 z=8 g=1
E 26.667 14 art=3638 id=3638 z=8 g=1
E 26.667 13 art=3638 id=3638 z=8 g=1
E 26.667 12 art=3638 id=3638 z=8 g=1
E 26.667 11 art=3638 id=3638 z=8 g=1
E 26.667 10 art=3638 id=3638 z=8 g=1
E 26.667 9 art=3638 id=3638 z=8 g=1
E 26.667 8 art=3638 id=3638 z=8 g=1
E 26.667 7 art=3638 id=3638 z=8 g=1
E 26.667 6 art=3638 id=3638 z=8 g=1
E 26.667 5 art=3638 id=3638 z=8 g=1
E 26.667 4 art=3638 id=3638 z=8 g=1
E 26.667 3 art=3638 id=3638 z=8 g=1
E 28 3 art=3638 id=3638 z=8 g=1
E 28 4 art=3638 id=3638 z=8 g=1
E 28 5 art=3638 id=3638 z=8 g=1
E 28 6 art=3638 id=3638 z=8 g=1
E 28 7 art=3638 id=3638 z=8 g=1
E 28 8 art=3638 id=3638 z=8 g=1
E 28 9 art=3638 id=3638 z=8 g=1
E 28 10 art=3638 id=3638 z=8 g=1
E 28 11 art=3638 id=3638 z=8 g=1
E 28 12 art=3638 id=3638 z=8 g=1
E 28 13 art=3638 id=3638 z=8 g=1
E 28 14 art=3638 id=3638 z=8 g=1
E 28 15 art=3638 id=3638 z=8 g=1
E 28 16 art=3638 id=3638 z=8 g=1
E 28 17 art=3638 id=3638 z=8 g=1
E 28 18 art=3638 id=3638 z=8 g=1
E 29 18 art=3638 id=3638 z=8 g=1
E 29 17 art=3638 id=3638 z=8 g=1
E 29 16 art=3638 id=3638 z=8 g=1
E 29 15 art=3638 id=3638 z=8 g=1
E 29 14 art=3638 id=3638 z=8 g=1
E 29 13 art=3638 id=3638 z=8 g=1
E 29 12 art=3638 id=3638 z=8 g=1
E 29 11 art=3638 id=3638 z=8 g=1
E 29 10 art=3638 id=3638 z=8 g=1
E 29 9 art=3638 id=3638 z=8 g=1
E 29 8 art=3638 id=3638 z=8 g=1
E 29 7 art=3638 id=3638 z=8 g=1
E 29 6 art=3638 id=3638 z=8 g=1
E 29 5 art=3638 id=3638 z=8 g=1
E 29 4 art=3638 id=3638 z=8 g=1
E 29 3 art=3638 id=3638 z=8 g=1
E 30.333 3 art=3638 id=3638 z=8 g=1
E 30.333 4 art=3638 id=3638 z=8 g=1
E 30.333 5 art=3638 id=3638 z=8 g=1
E 30.333 6 art=3638 id=3638 z=8 g=1
E 30.333 7 art=3638 id=3638 z=8 g=1
E 30.333 8 art=3638 id=3638 z=8 g=1
E 30.333 9 art=3638 id=3638 z=8 g=1
E 30.333 10 art=3638 id=3638 z=8 g=1
E 30.333 11 art=3638 id=3638 z=8 g=1
E 30.333 12 art=3638 id=3638 z=8 g=1
E 30.333 13 art=3638 id=3638 z=8 g=1
E 30.333 14 art=3638 id=3638 z=8 g=1
E 30.333 15 art=3638 id=3638 z=8 g=1
E 30.333 16 art=3638 id=3638 z=8 g=1
E 30.333 17 art=3638 id=3638 z=8 g=1
E 30.333 18 art=3638 id=3638 z=8 g=1
E 31.333 18 art=3638 id=3638 z=8 g=1
E 31.333 17 art=3638 id=3638 z=8 g=1
E 31.333 16 art=3638 id=3638 z=8 g=1
E 31.333 15 art=3638 id=3638 z=8 g=1
E 31.333 14 art=3638 id=3638 z=8 g=1
E 31.333 13 art=3638 id=3638 z=8 g=1
E 31.333 12 art=3638 id=3638 z=8 g=1
E 31.333 11 art=3638 id=3638 z=8 g=1
E 31.333 10 art=3638 id=3638 z=8 g=1
E 31.333 9 art=3638 id=3638 z=8 g=1
E 31.333 8 art=3638 id=3638 z=8 g=1
E 31.333 7 art=3638 id=3638 z=8 g=1
E 31.333 6 art=3638 id=3638 z=8 g=1
E 31.333 5 art=3638 id=3638 z=8 g=1
E 31.333 4 art=3638 id=3638 z=8 g=1
E 31.333 3 art=3638 id=3638 z=8 g=1
E 32.667 3 art=3638 id=3638 z=8 g=1
E 32.667 4 art=3638 id=3638 z=8 g=1
E 32.667 5 art=3638 id=3638 z=8 g=1
E 32.667 6 art=3638 id=3638 z=8 g=1
E 32.667 7 art=3638 id=3638 z=8 g=1
E 32.667 8 art=3638 id=3638 z=8 g=1
E 32.667 9 art=3638 id=3638 z=8 g=1
E 32.667 10 art=3638 id=3638 z=8 g=1
E 32.667 11 art=3638 id=3638 z=8 g=1
E 32.667 12 art=3638 id=3638 z=8 g=1
E 32.667 13 art=3638 id=3638 z=8 g=1
E 32.667 14 art=3638 id=3638 z=8 g=1
E 32.667 15 art=3638 id=3638 z=8 g=1
E 32.667 16 art=3638 id=3638 z=8 g=1
E 32.667 17 art=3638 id=3638 z=8 g=1
E 32.667 18 art=3638 id=3638 z=8 g=1
E 33.667 18 art=3638 id=3638 z=8 g=1
E 33.667 17 art=3638 id=3638 z=8 g=1
E 33.667 16 art=3638 id=3638 z=8 g=1
E 33.667 15 art=3638 id=3638 z=8 g=1
E 33.667 14 art=3638 id=3638 z=8 g=1
E 33.667 13 art=3638 id=3638 z=8 g=1
E 33.667 12 art=3638 id=3638 z=8 g=1
E 33.667 11 art=3638 id=3638 z=8 g=1
E 33.667 10 art=3638 id=3638 z=8 g=1
E 33.667 9 art=3638 id=3638 z=8 g=1
E 33.667 8 art=3638 id=3638 z=8 g=1
E 33.667 7 art=3638 id=3638 z=8 g=1
E 33.667 6 art=3638 id=3638 z=8 g=1
E 33.667 5 art=3638 id=3638 z=8 g=1
E 33.667 4 art=3638 id=3638 z=8 g=1
E 33.667 3 art=3638 id=3638 z=8 g=1
E 35 3 art=3638 id=3638 z=8 g=1
E 35 4 art=3638 id=3638 z=8 g=1
E 35 5 art=3638 id=3638 z=8 g=1
E 35 6 art=3638 id=3638 z=8 g=1
E 35 7 art=3638 id=3638 z=8 g=1
E 35 8 art=3638 id=3638 z=8 g=1
E 35 9 art=3638 id=3638 z=8 g=1
E 35 10 art=3638 id=3638 z=8 g=1
E 35 11 art=3638 id=3638 z=8 g=1
E 35 12 art=3638 id=3638 z=8 g=1
E 35 13 art=3638 id=3638 z=8 g=1
E 35 14 art=3638 id=3638 z=8 g=1
E 35 15 art=3638 id=3638 z=8 g=1
E 35 16 art=3638 id=3638 z=8 g=1
E 35 17 art=3638 id=3638 z=8 g=1
E 35 18 art=3638 id=3638 z=8 g=1
E 36 18 art=3638 id=3638 z=8 g=1
E 36 17 art=3638 id=3638 z=8 g=1
E 36 16 art=3638 id=3638 z=8 g=1
E 36 15 art=3638 id=3638 z=8 g=1
E 36 14 art=3638 id=3638 z=8 g=1
E 36 13 art=3638 id=3638 z=8 g=1
E 36 12 art=3638 id=3638 z=8 g=1
E 36 11 art=3638 id=3638 z=8 g=1
E 36 10 art=3638 id=3638 z=8 g=1
E 36 9 art=3638 id=3638 z=8 g=1
E 36 8 art=3638 id=3638 z=8 g=1
E 36 7 art=3638 id=3638 z=8 g=1
E 36 6 art=3638 id=3638 z=8 g=1
E 36 5 art=3638 id=3638 z=8 g=1
E 36 4 art=3638 id=3638 z=8 g=1
E 36 3 art=3638 id=3638 z=8 g=1
E 37.333 3 art=3638 id=3638 z=8 g=1
E 37.333 4 art=3638 id=3638 z=8 g=1
E 37.333 5 art=3638 id=3638 z=8 g=1
E 37.333 6 art=3638 id=3638 z=8 g=1
E 37.333 7 art=3638 id=3638 z=8 g=1
E 37.333 8 art=3638 id=3638 z=8 g=1
E 37.333 9 art=3638 id=3638 z=8 g=1
E 37.333 10 art=3638 id=3638 z=8 g=1
E 37.333 11 art=3638 id=3638 z=8 g=1
E 37.333 12 art=3638 id=3638 z=8 g=1
E 37.333 13 art=3638 id=3638 z=8 g=1
E 37.333 14 art=3638 id=3638 z=8 g=1
E 37.333 15 art=3638 id=3638 z=8 g=1
E 37.333 16 art=3638 id=3638 z=8 g=1
E 37.333 17 art=3638 id=3638 z=8 g=1
E 37.333 18 art=3638 id=3638 z=8 g=1
E 38.333 18 art=3638 id=3638 z=8 g=1
E 38.333 17 art=3638 id=3638 z=8 g=1
E 38.333 16 art=3638 id=3638 z=8 g=1
E 38.333 15 art=3638 id=3638 z=8 g=1
E 38.333 14 art=3638 id=3638 z=8 g=1
E 38.333 13 art=3638 id=3638 z=8 g=1
E 38.333 12 art=3638 id=3638 z=8 g=1
E 38.333 11 art=3638 id=3638 z=8 g=1
E 38.333 10 art=3638 id=3638 z=8 g=1
E 38.333 9 art=3638 id=3638 z=8 g=1
E 38.333 8 art=3638 id=3638 z=8 g=1
E 38.333 7 art=3638 id=3638 z=8 g=1
E 38.333 6 art=3638 id=3638 z=8 g=1
E 38.333 5 art=3638 id=3638 z=8 g=1
E 38.333 4 art=3638 id=3638 z=8 g=1
E 38.333 3 art=3638 id=3638 z=8 g=1
E 39.667 3 art=3638 id=3638 z=8 g=1
E 39.667 4 art=3638 id=3638 z=8 g=1
E 39.667 5 art=3638 id=3638 z=8 g=1
E 39.667 6 art=3638 id=3638 z=8 g=1
E 39.667 7 art=3638 id=3638 z=8 g=1
E 39.667 8 art=3638 id=3638 z=8 g=1
E 39.667 9 art=3638 id=3638 z=8 g=1
E 39.667 10 art=3638 id=3638 z=8 g=1
E 39.667 11 art=3638 id=3638 z=8 g=1
E 39.667 12 art=3638 id=3638 z=8 g=1
E 39.667 13 art=3638 id=3638 z=8 g=1
E 39.667 14 art=3638 id=3638 z=8 g=1
E 39.667 15 art=3638 id=3638 z=8 g=1
E 39.667 16 art=3638 id=3638 z=8 g=1
E 39.667 17 art=3638 id=3638 z=8 g=1
E 39.667 18 art=3638 id=3638 z=8 g=1
E 40.667 18 art=3638 id=3638 z=8 g=1
E 40.667 17 art=3638 id=3638 z=8 g=1
E 40.667 16 art=3638 id=3638 z=8 g=1
E 40.667 15 art=3638 id=3638 z=8 g=1
E 40.667 14 art=3638 id=3638 z=8 g=1
E 40.667 13 art=3638 id=3638 z=8 g=1
E 40.667 12 art=3638 id=3638 z=8 g=1
E 40.667 11 art=3638 id=3638 z=8 g=1
E 40.667 10 art=3638 id=3638 z=8 g=1
E 40.667 9 art=3638 id=3638 z=8 g=1
E 40.667 8 art=3638 id=3638 z=8 g=1
E 40.667 7 art=3638 id=3638 z=8 g=1
E 40.667 6 art=3638 id=3638 z=8 g=1
E 40.667 5 art=3638 id=3638 z=8 g=1
E 40.667 4 art=3638 id=3638 z=8 g=1
E 40.667 3 art=3638 id=3638 z=8 g=1
E 42 3 art=3638 id=3638 z=8 g=1
E 42 4 art=3638 id=3638 z=8 g=1
E 42 5 art=3638 id=3638 z=8 g=1
E 42 6 art=3638 id=3638 z=8 g=1
E 42 7 art=3638 id=3638 z=8 g=1
E 42 8 art=3638 id=3638 z=8 g=1
E 42 9 art=3638 id=3638 z=8 g=1
E 42 10 art=3638 id=3638 z=8 g=1
E 42 11 art=3638 id=3638 z=8 g=1
E 42 12 art=3638 id=3638 z=8 g=1
E 42 13 art=3638 id=3638 z=8 g=1
E 42 14 art=3638 id=3638 z=8 g=1
E 42 15 art=3638 id=3638 z=8 g=1
E 42 16 art=3638 id=3638 z=8 g=1
E 42 17 art=3638 id=3638 z=8 g=1
E 42 18 art=3638 id=3638 z=8 g=1
E 43 18 art=3638 id=3638 z=8 g=1
E 43 17 art=3638 id=3638 z=8 g=1
E 43 16 art=3638 id=3638 z=8 g=1
E 43 15 art=3638 id=3638 z=8 g=1
E 43 14 art=3638 id=3638 z=8 g=1
E 43 13 art=3638 id=3638 z=8 g=1
E 43 12 art=3638 id=3638 z=8 g=1
E 43 11 art=3638 id=3638 z=8 g=1
E 43 10 art=3638 id=3638 z=8 g=1
E 43 9 art=3638 id=3638 z=8 g=1
E 43 8 art=3638 id=3638 z=8 g=1
E 43 7 art=3638 id=3638 z=8 g=1
E 43 6 art=3638 id=3638 z=8 g=1
E 43 5 art=3638 id=3638 z=8 g=1
E 43 4 art=3638 id=3638 z=8 g=1
E 43 3 art=3638 id=3638 z=8 g=1
E 44.333 3 art=3638 id=3638 z=8 g=1
E 44.333 4 art=3638 id=3638 z=8 g=1
E 44.333 5 art=3638 id=3638 z=8 g=1
E 44.333 6 art=3638 id=3638 z=8 g=1
E 44.333 7 art=3638 id=3638 z=8 g=1
E 44.333 8 art=3638 id=3638 z=8 g=1
E 44.333 9 art=3638 id=3638 z=8 g=1
E 44.333 10 art=3638 id=3638 z=8 g=1
E 44.333 11 art=3638 id=3638 z=8 g=1
E 44.333 12 art=3638 id=3638 z=8 g=1
E 44.333 13 art=3638 id=3638 z=8 g=1
E 44.333 14 art=3638 id=3638 z=8 g=1
E 44.333 15 art=3638 id=3638 z=8 g=1
E 44.333 16 art=3638 id=3638 z=8 g=1
E 44.333 17 art=3638 id=3638 z=8 g=1
E 44.333 18 art=3638 id=3638 z=8 g=1
E 45.333 18 art=3638 id=3638 z=8 g=1
E 45.333 17 art=3638 id=3638 z=8 g=1
E 45.333 16 art=3638 id=3638 z=8 g=1
E 45.333 15 art=3638 id=3638 z=8 g=1
E 45.333 14 art=3638 id=3638 z=8 g=1
E 45.333 13 art=3638 id=3638 z=8 g=1
E 45.333 12 art=3638 id=3638 z=8 g=1
E 45.333 11 art=3638 id=3638 z=8 g=1
E 45.333 10 art=3638 id=3638 z=8 g=1
E 45.333 9 art=3638 id=3638 z=8 g=1
E 45.333 8 art=3638 id=3638 z=8 g=1
E 45.333 7 art=3638 id=3638 z=8 g=1
E 45.333 6 art=3638 id=3638 z=8 g=1
E 45.333 5 art=3638 id=3638 z=8 g=1
E 45.333 4 art=3638 id=3638 z=8 g=1
E 45.333 3 art=3638 id=3638 z=8 g=1
E 46.667 3 art=3638 id=3638 z=8 g=1
E 46.667 4 art=3638 id=3638 z=8 g=1
E 46.667 5 art=3638 id=3638 z=8 g=1
E 46.667 6 art=3638 id=3638 z=8 g=1
E 46.667 7 art=3638 id=3638 z=8 g=1
E 46.667 8 art=3638 id=3638 z=8 g=1
E 46.667 9 art=3638 id=3638 z=8 g=1
E 46.667 10 art=3638 id=3638 z=8 g=1
E 46.667 11 art=3638 id=3638 z=8 g=1
E 46.667 12 art=3638 id=3638 z=8 g=1
E 46.667 13 art=3638 id=3638 z=8 g=1
E 46.667 14 art=3638 id=3638 z=8 g=1
E 46.667 15 art=3638 id=3638 z=8 g=1
E 46.667 16 art=3638 id=3638 z=8 g=1
E 46.667 17 art=3638 id=3638 z=8 g=1
E 46.667 18 art=3638 id=3638 z=8 g=1
E 47.667 18 art=3638 id=3638 z=8 g=1
E 47.667 17 art=3638 id=3638 z=8 g=1
E 47.667 16 art=3638 id=3638 z=8 g=1
E 47.667 15 art=3638 id=3638 z=8 g=1
E 47.667 14 art=3638 id=3638 z=8 g=1
E 47.667 13 art=3638 id=3638 z=8 g=1
E 47.667 12 art=3638 id=3638 z=8 g=1
E 47.667 11 art=3638 id=3638 z=8 g=1
E 47.667 10 art=3638 id=3638 z=8 g=1
E 47.667 9 art=3638 id=3638 z=8 g=1
E 47.667 8 art=3638 id=3638 z=8 g=1
E 47.667 7 art=3638 id=3638 z=8 g=1
E 47.667 6 art=3638 id=3638 z=8 g=1
E 47.667 5 art=3638 id=3638 z=8 g=1
E 47.667 4 art=3638 id=3638 z=8 g=1
E 47.667 3 art=3638 id=3638 z=8 g=1
E 49 3 art=3638 id=3638 z=8 g=1
E 49 4 art=3638 id=3638 z=8 g=1
E 49 5 art=3638 id=3638 z=8 g=1
E 49 6 art=3638 id=3638 z=8 g=1
E 49 7 art=3638 id=3638 z=8 g=1
E 49 8 art=3638 id=3638 z=8 g=1
E 49 9 art=3638 id=3638 z=8 g=1
E 49 10 art=3638 id=3638 z=8 g=1
E 49 11 art=3638 id=3638 z=8 g=1
E 49 12 art=3638 id=3638 z=8 g=1
E 49 13 art=3638 id=3638 z=8 g=1
E 49 14 art=3638 id=3638 z=8 g=1
E 49 15 art=3638 id=3638 z=8 g=1
E 49 16 art=3638 id=3638 z=8 g=1
E 49 17 art=3638 id=3638 z=8 g=1
E 49 18 art=3638 id=3638 z=8 g=1
E 50 18 art=3638 id=3638 z=8 g=1
E 50 17 art=3638 id=3638 z=8 g=1
E 50 16 art=3638 id=3638 z=8 g=1
E 50 15 art=3638 id=3638 z=8 g=1
E 50 14 art=3638 id=3638 z=8 g=1
E 50 13 art=3638 id=3638 z=8 g=1
E 50 12 art=3638 id=3638 z=8 g=1
E 50 11 art=3638 id=3638 z=8 g=1
E 50 10 art=3638 id=3638 z=8 g=1
E 50 9 art=3638 id=3638 z=8 g=1
E 50 8 art=3638 id=3638 z=8 g=1
E 50 7 art=3638 id=3638 z=8 g=1
E 50 6 art=3638 id=3638 z=8 g=1
E 50 5 art=3638 id=3638 z=8 g=1
E 50 4 art=3638 id=3638 z=8 g=1
E 50 3 art=3638 id=3638 z=8 g=1
E 51.333 3 art=3638 id=3638 z=8 g=1
E 51.333 4 art=3638 id=3638 z=8 g=1
E 51.333 5 art=3638 id=3638 z=8 g=1
E 51.333 6 art=3638 id=3638 z=8 g=1
E 51.333 7 art=3638 id=3638 z=8 g=1
E 51.333 8 art=3638 id=3638 z=8 g=1
E 51.333 9 art=3638 id=3638 z=8 g=1
E 51.333 10 art=3638 id=3638 z=8 g=1
E 51.333 11 art=3638 id=3638 z=8 g=1
E 51.333 12 art=3638 id=3638 z=8 g=1
E 51.333 13 art=3638 id=3638 z=8 g=1
E 51.333 14 art=3638 id=3638 z=8 g=1
E 51.333 15 art=3638 id=3638 z=8 g=1
E 51.333 16 art=3638 id=3638 z=8 g=1
E 51.333 17 art=3638 id=3638 z=8 g=1
E 51.333 18 art=3638 id=3638 z=8 g=1
E 52.333 18 art=3638 id=3638 z=8 g=1
E 52.333 17 art=3638 id=3638 z=8 g=1
E 52.333 16 art=3638 id=3638 z=8 g=1
E 52.333 15 art=3638 id=3638 z=8 g=1
E 52.333 14 art=3638 id=3638 z=8 g=1
E 52.333 13 art=3638 id=3638 z=8 g=1
E 52.333 12 art=3638 id=3638 z=8 g=1
E 52.333 11 art=3638 id=3638 z=8 g=1
E 52.333 10 art=3638 id=3638 z=8 g=1
E 52.333 9 art=3638 id=3638 z=8 g=1
E 52.333 8 art=3638 id=3638 z=8 g=1
E 52.333 7 art=3638 id=3638 z=8 g=1
E 52.333 6 art=3638 id=3638 z=8 g=1
E 52.333 5 art=3638 id=3638 z=8 g=1
E 52.333 4 art=3638 id=3638 z=8 g=1
E 52.333 3 art=3638 id=3638 z=8 g=1
E 53.667 3 art=3638 id=3638 z=8 g=1
E 53.667 4 art=3638 id=3638 z=8 g=1
E 53.667 5 art=3638 id=3638 z=8 g=1
E 53.667 6 art=3638 id=3638 z=8 g=1
E 53.667 7 art=3638 id=3638 z=8 g=1
E 53.667 8 art=3638 id=3638 z=8 g=1
E 53.667 9 art=3638 id=3638 z=8 g=1
E 53.667 10 art=3638 id=3638 z=8 g=1
E 53.667 11 art=3638 id=3638 z=8 g=1
E 53.667 12 art=3638 id=3638 z=8 g=1
E 53.667 13 art=3638 id=3638 z=8 g=1
E 53.667 14 art=3638 id=3638 z=8 g=1
E 53.667 15 art=3638 id=3638 z=8 g=1
E 53.667 16 art=3638 id=3638 z=8 g=1
E 53.667 17 art=3638 id=3638 z=8 g=1
E 53.667 18 art=3638 id=3638 z=8 g=1
E 54.667 18 art=3638 id=3638 z=8 g=1
E 54.667 17 art=3638 id=3638 z=8 g=1
E 54.667 16 art=3638 id=3638 z=8 g=1
E 54.667 15 art=3638 id=3638 z=8 g=1
E 54.667 14 art=3638 id=3638 z=8 g=1
E 54.667 13 art=3638 id=3638 z=8 g=1
E 54.667 12 art=3638 id=3638 z=8 g=1
E 54.667 11 art=3638 id=3638 z=8 g=1
E 54.667 10 art=3638 id=3638 z=8 g=1
E 54.667 9 art=3638 id=3638 z=8 g=1
E 54.667 8 art=3638 id=3638 z=8 g=1
E 54.667 7 art=3638 id=3638 z=8 g=1
E 54.667 6 art=3638 id=3638 z=8 g=1
E 54.667 5 art=3638 id=3638 z=8 g=1
E 54.667 4 art=3638 id=3638 z=8 g=1
E 54.667 3 art=3638 id=3638 z=8 g=1
E 56 3 art=3638 id=3638 z=8 g=1
E 56 4 art=3638 id=3638 z=8 g=1
E 56 5 art=3638 id=3638 z=8 g=1
E 56 6 art=3638 id=3638 z=8 g=1
E 56 7 art=3638 id=3638 z=8 g=1
E 56 8 art=3638 id=3638 z=8 g=1
E 56 9 art=3638 id=3638 z=8 g=1
E 56 10 art=3638 id=3638 z=8 g=1
E 56 11 art=3638 id=3638 z=8 g=1
E 56 12 art=3638 id=3638 z=8 g=1
E 56 13 art=3638 id=3638 z=8 g=1
E 56 14 art=3638 id=3638 z=8 g=1
E 56 15 art=3638 id=3638 z=8 g=1
E 56 16 art=3638 id=3638 z=8 g=1
E 56 17 art=3638 id=3638 z=8 g=1
E 56 18 art=3638 id=3638 z=8 g=1
E 57 18 art=3638 id=3638 z=8 g=1
E 57 17 art=3638 id=3638 z=8 g=1
E 57 16 art=3638 id=3638 z=8 g=1
E 57 15 art=3638 id=3638 z=8 g=1
E 57 14 art=3638 id=3638 z=8 g=1
E 57 13 art=3638 id=3638 z=8 g=1
E 57 12 art=3638 id=3638 z=8 g=1
E 57 11 art=3638 id=3638 z=8 g=1
E 57 10 art=3638 id=3638 z=8 g=1
E 57 9 art=3638 id=3638 z=8 g=1
E 57 8 art=3638 id=3638 z=8 g=1
E 57 7 art=3638 id=3638 z=8 g=1
E 57 6 art=3638 id=3638 z=8 g=1
E 57 5 art=3638 id=3638 z=8 g=1
E 57 4 art=3638 id=3638 z=8 g=1
E 57 3 art=3638 id=3638 z=8 g=1
E 58.333 3 art=3638 id=3638 z=8 g=1
E 58.333 4 art=3638 id=3638 z=8 g=1
E 58.333 5 art=3638 id=3638 z=8 g=1
E 58.333 6 art=3638 id=3638 z=8 g=1
E 58.333 7 art=3638 id=3638 z=8 g=1
E 58.333 8 art=3638 id=3638 z=8 g=1
E 58.333 9 art=3638 id=3638 z=8 g=1
E 58.333 10 art=3638 id=3638 z=8 g=1
E 58.333 11 art=3638 id=3638 z=8 g=1
E 58.333 12 art=3638 id=3638 z=8 g=1
E 58.333 13 art=3638 id=3638 z=8 g=1
E 58.333 14 art=3638 id=3638 z=8 g=1
E 58.333 15 art=3638 id=3638 z=8 g=1
E 58.333 16 art=3638 id=3638 z=8 g=1
E 58.333 17 art=3638 id=3638 z=8 g=1
E 58.333 18 art=3638 id=3638 z=8 g=1
E 59.333 18 art=3638 id=3638 z=8 g=1
E 59.333 17 art=3638 id=3638 z=8 g=1
E 59.333 16 art=3638 id=3638 z=8 g=1
E 59.333 15 art=3638 id=3638 z=8 g=1
E 59.333 14 art=3638 id=3638 z=8 g=1
E 59.333 13 art=3638 id=3638 z=8 g=1
E 59.333 12 art=3638 id=3638 z=8 g=1
E 59.333 11 art=3638 id=3638 z=8 g=1
E 59.333 10 art=3638 id=3638 z=8 g=1
E 59.333 9 art=3638 id=3638 z=8 g=1
E 59.333 8 art=3638 id=3638 z=8 g=1
E 59.333 7 art=3638 id=3638 z=8 g=1
E 59.333 6 art=3638 id=3638 z=8 g=1
E 59.333 5 art=3638 id=3638 z=8 g=1
E 59.333 4 art=3638 id=3638 z=8 g=1
E 59.333 3 art=3638 id=3638 z=8 g=1
E 60.667 3 art=3638 id=3638 z=8 g=1
E 60.667 4 art=3638 id=3638 z=8 g=1
E 60.667 5 art=3638 id=3638 z=8 g=1
E 60.667 6 art=3638 id=3638 z=8 g=1
E 60.667 7 art=3638 id=3638 z=8 g=1
E 60.667 8 art=3638 id=3638 z=8 g=1
E 60.667 9 art=3638 id=3638 z=8 g=1
E 60.667 10 art=3638 id=3638 z=8 g=1
E 60.667 11 art=3638 id=3638 z=8 g=1
E 60.667 12 art=3638 id=3638 z=8 g=1
E 60.667 13 art=3638 id=3638 z=8 g=1
E 60.667 14 art=3638 id=3638 z=8 g=1
E 60.667 15 art=3638 id=3638 z=8 g=1
E 60.667 16 art=3638 id=3638 z=8 g=1
E 60.667 17 art=3638 id=3638 z=8 g=1
E 60.667 18 art=3638 id=3638 z=8 g=1
E 61.667 18 art=3638 id=3638 z=8 g=1
E 61.667 17 art=3638 id=3638 z=8 g=1
E 61.667 16 art=3638 id=3638 z=8 g=1
E 61.667 15 art=3638 id=3638 z=8 g=1
E 61.667 14 art=3638 id=3638 z=8 g=1
E 61.667 13 art=3638 id=3638 z=8 g=1
E 61.667 12 art=3638 id=3638 z=8 g=1
E 61.667 11 art=3638 id=3638 z=8 g=1
E 61.667 10 art=3638 id=3638 z=8 g=1
E 61.667 9 art=3638 id=3638 z=8 g=1
E 61.667 8 art=3638 id=3638 z=8 g=1
E 61.667 7 art=3638 id=3638 z=8 g=1
E 61.667 6 art=3638 id=3638 z=8 g=1
E 61.667 5 art=3638 id=3638 z=8 g=1
E 61.667 4 art=3638 id=3638 z=8 g=1
E 61.667 3 art=3638 id=3638 z=8 g=1
E 63 3 art=3638 id=3638 z=8 g=1
E 63 4 art=3638 id=3638 z=8 g=1
E 63 5 art=3638 id=3638 z=8 g=1
E 63 6 art=3638 id=3638 z=8 g=1
E 63 7 art=3638 id=3638 z=8 g=1
E 63 8 art=3638 id=3638 z=8 g=1
E 63 9 art=3638 id=3638 z=8 g=1
E 63 10 art=3638 id=3638 z=8 g=1
E 63 11 art=3638 id=3638 z=8 g=1
E 63 12 art=3638 id=3638 z=8 g=1
E 63 13 art=3638 id=3638 z=8 g=1
E 63 14 art=3638 id=3638 z=8 g=1
E 63 15 art=3638 id=3638 z=8 g=1
E 63 16 art=3638 id=3638 z=8 g=1
E 63 17 art=3638 id=3638 z=8 g=1
E 63 18 art=3638 id=3638 z=8 g=1
E 64 18 art=3638 id=3638 z=8 g=1
E 64 17 art=3638 id=3638 z=8 g=1
E 64 16 art=3638 id=3638 z=8 g=1
E 64 15 art=3638 id=3638 z=8 g=1
E 64 14 art=3638 id=3638 z=8 g=1
E 64 13 art=3638 id=3638 z=8 g=1
E 64 12 art=3638 id=3638 z=8 g=1
E 64 11 art=3638 id=3638 z=8 g=1
E 64 10 art=3638 id=3638 z=8 g=1
E 64 9 art=3638 id=3638 z=8 g=1
E 64 8 art=3638 id=3638 z=8 g=1
E 64 7 art=3638 id=3638 z=8 g=1
E 64 6 art=3638 id=3638 z=8 g=1
E 64 5 art=3638 id=3638 z=8 g=1
E 64 4 art=3638 id=3638 z=8 g=1
E 64 3 art=3638 id=3638 z=8 g=1
E 65.333 3 art=3638 id=3638 z=8 g=1
E 65.333 4 art=3638 id=3638 z=8 g=1
E 65.333 5 art=3638 id=3638 z=8 g=1
E 65.333 6 art=3638 id=3638 z=8 g=1
E 65.333 7 art=3638 id=3638 z=8 g=1
E 65.333 8 art=3638 id=3638 z=8 g=1
E 65.333 9 art=3638 id=3638 z=8 g=1
E 65.333 10 art=3638 id=3638 z=8 g=1
E 65.333 11 art=3638 id=3638 z=8 g=1
E 65.333 12 art=3638 id=3638 z=8 g=1
E 65.333 13 art=3638 id=3638 z=8 g=1
E 65.333 14 art=3638 id=3638 z=8 g=1
E 65.333 15 art=3638 id=3638 z=8 g=1
E 65.333 16 art=3638 id=3638 z=8 g=1
E 65.333 17 art=3638 id=3638 z=8 g=1
E 65.333 18 art=3638 id=3638 z=8 g=1
E 66.333 18 art=3638 id=3638 z=8 g=1
E 66.333 17 art=3638 id=3638 z=8 g=1
E 66.333 16 art=3638 id=3638 z=8 g=1
E 66.333 15 art=3638 id=3638 z=8 g=1
E 66.333 14 art=3638 id=3638 z=8 g=1
E 66.333 13 art=3638 id=3638 z=8 g=1
E 66.333 12 art=3638 id=3638 z=8 g=1
E 66.333 11 art=3638 id=3638 z=8 g=1
E 66.333 10 art=3638 id=3638 z=8 g=1
E 66.333 9 art=3638 id=3638 z=8 g=1
E 66.333 8 art=3638 id=3638 z=8 g=1
E 66.333 7 art=3638 id=3638 z=8 g=1
E 66.333 6 art=3638 id=3638 z=8 g=1
E 66.333 5 art=3638 id=3638 z=8 g=1
E 66.333 4 art=3638 id=3638 z=8 g=1
E 66.333 3 art=3638 id=3638 z=8 g=1
E 67.667 3 art=3638 id=3638 z=8 g=1
E 67.667 4 art=3638 id=3638 z=8 g=1
E 67.667 5 art=3638 id=3638 z=8 g=1
E 67.667 6 art=3638 id=3638 z=8 g=1
E 67.667 7 art=3638 id=3638 z=8 g=1
E 67.667 8 art=3638 id=3638 z=8 g=1
E 67.667 9 art=3638 id=3638 z=8 g=1
E 67.667 10 art=3638 id=3638 z=8 g=1
E 67.667 11 art=3638 id=3638 z=8 g=1
E 67.667 12 art=3638 id=3638 z=8 g=1
E 67.667 13 art=3638 id=3638 z=8 g=1
E 67.667 14 art=3638 id=3638 z=8 g=1
E 67.667 15 art=3638 id=3638 z=8 g=1
E 67.667 16 art=3638 id=3638 z=8 g=1
E 67.667 17 art=3638 id=3638 z=8 g=1
E 67.667 18 art=3638 id=3638 z=8 g=1
E 68.667 18 art=3638 id=3638 z=8 g=1
E 68.667 17 art=3638 id=3638 z=8 g=1
E 68.667 16 art=3638 id=3638 z=8 g=1
E 68.667 15 art=3638 id=3638 z=8 g=1
E 68.667 14 art=3638 id=3638 z=8 g=1
E 68.667 13 art=3638 id=3638 z=8 g=1
E 68.667 12 art=3638 id=3638 z=8 g=1
E 68.667 11 art=3638 id=3638 z=8 g=1
E 68.667 10 art=3638 id=3638 z=8 g=1
E 68.667 9 art=3638 id=3638 z=8 g=1
E 68.667 8 art=3638 id=3638 z=8 g=1
E 68.667 7 art=3638 id=3638 z=8 g=1
E 68.667 6 art=3638 id=3638 z=8 g=1
E 68.667 5 art=3638 id=3638 z=8 g=1
E 68.667 4 art=3638 id=3638 z=8 g=1
E 68.667 3 art=3638 id=3638 z=8 g=1
E 70 3 art=3638 id=3638 z=8 g=1
E 70 4 art=3638 id=3638 z=8 g=1
E 70 5 art=3638 id=3638 z=8 g=1
E 70 6 art=3638 id=3638 z=8 g=1
E 70 7 art=3638 id=3638 z=8 g=1
E 70 8 art=3638 id=3638 z=8 g=1
E 70 9 art=3638 id=3638 z=8 g=1
E 70 10 art=3638 id=3638 z=8 g=1
E 70 11 art=3638 id=3638 z=8 g=1
E 70 12 art=3638 id=3638 z=8 g=1
E 70 13 art=3638 id=3638 z=8 g=1
E 70 14 art=3638 id=3638 z=8 g=1
E 70 15 art=3638 id=3638 z=8 g=1
E 70 16 art=3638 id=3638 z=8 g=1
E 70 17 art=3638 id=3638 z=8 g=1
E 70 18 art=3638 id=3638 z=8 g=1
E 71 18 art=3638 id=3638 z=8 g=1
E 71 17 art=3638 id=3638 z=8 g=1
E 71 16 art=3638 id=3638 z=8 g=1
E 71 15 art=3638 id=3638 z=8 g=1
E 71 14 art=3638 id=3638 z=8 g=1
E 71 13 art=3638 id=3638 z=8 g=1
E 71 12 art=3638 id=3638 z=8 g=1
E 71 11 art=3638 id=3638 z=8 g=1
E 71 10 art=3638 id=3638 z=8 g=1
E 71 9 art=3638 id=3638 z=8 g=1
E 71 8 art=3638 id=3638 z=8 g=1
E 71 7 art=3638 id=3638 z=8 g=1
E 71 6 art=3638 id=3638 z=8 g=1
E 71 5 art=3638 id=3638 z=8 g=1
E 71 4 art=3638 id=3638 z=8 g=1
E 71 3 art=3638 id=3638 z=8 g=1
E 72.333 3 art=3638 id=3638 z=8 g=1
E 72.333 4 art=3638 id=3638 z=8 g=1
E 72.333 5 art=3638 id=3638 z=8 g=1
E 72.333 6 art=3638 id=3638 z=8 g=1
E 72.333 7 art=3638 id=3638 z=8 g=1
E 72.333 8 art=3638 id=3638 z=8 g=1
E 72.333 9 art=3638 id=3638 z=8 g=1
E 72.333 10 art=3638 id=3638 z=8 g=1
E 72.333 11 art=3638 id=3638 z=8 g=1
E 72.333 12 art=3638 id=3638 z=8 g=1
E 72.333 13 art=3638 id=3638 z=8 g=1
E 72.333 14 art=3638 id=3638 z=8 g=1
E 72.333 15 art=3638 id=3638 z=8 g=1
E 72.333 16 art=3638 id=3638 z=8 g=1
E 72.333 17 art=3638 id=3638 z=8 g=1
E 72.333 18 art=3638 id=3638 z=8 g=1
E 73.333 18 art=3638 id=3638 z=8 g=1
E 73.333 17 art=3638 id=3638 z=8 g=1
E 73.333 16 art=3638 id=3638 z=8 g=1
E 73.333 15 art=3638 id=3638 z=8 g=1
E 73.333 14 art=3638 id=3638 z=8 g=1
E 73.333 13 art=3638 id=3638 z=8 g=1
E 73.333 12 art=3638 id=3638 z=8 g=1
E 73.333 11 art=3638 id=3638 z=8 g=1
E 73.333 10 art=3638 id=3638 z=8 g=1
E 73.333 9 art=3638 id=3638 z=8 g=1
E 73.333 8 art=3638 id=3638 z=8 g=1
E 73.333 7 art=3638 id=3638 z=8 g=1
E 73.333 6 art=3638 id=3638 z=8 g=1
E 73.333 5 art=3638 id=3638 z=8 g=1
E 73.333 4 art=3638 id=3638 z=8 g=1
E 73.333 3 art=3638 id=3638 z=8 g=1
E 1 20 art=1007 inert=1 id=1007 z=2
E -9.5 18.133 art=3638 id=3638 z=8 g=1
E -9.5 17.133 art=3638 id=3638 z=8 g=1
E -9.5 16.133 art=3638 id=3638 z=8 g=1
E -9.5 15.133 art=3638 id=3638 z=8 g=1
E -9.5 14.133 art=3638 id=3638 z=8 g=1
E -9.5 13.133 art=3638 id=3638 z=8 g=1
E -9.5 12.133 art=3638 id=3638 z=8 g=1
E -9.5 11.133 art=3638 id=3638 z=8 g=1
E -9.5 10.133 art=3638 id=3638 z=8 g=1
E -8.167 10.133 art=3638 id=3638 z=8 g=1
E -8.167 11.133 art=3638 id=3638 z=8 g=1
E -8.167 12.133 art=3638 id=3638 z=8 g=1
E -8.167 13.133 art=3638 id=3638 z=8 g=1
E -8.167 14.133 art=3638 id=3638 z=8 g=1
E -8.167 15.133 art=3638 id=3638 z=8 g=1
E -8.167 16.133 art=3638 id=3638 z=8 g=1
E -8.167 17.133 art=3638 id=3638 z=8 g=1
E -8.167 18.133 art=3638 id=3638 z=8 g=1
E -7.167 18.133 art=3638 id=3638 z=8 g=1
E -7.167 17.133 art=3638 id=3638 z=8 g=1
E -7.167 16.133 art=3638 id=3638 z=8 g=1
E -7.167 15.133 art=3638 id=3638 z=8 g=1
E -7.167 14.133 art=3638 id=3638 z=8 g=1
E -7.167 13.133 art=3638 id=3638 z=8 g=1
E -7.167 12.133 art=3638 id=3638 z=8 g=1
E -7.167 11.133 art=3638 id=3638 z=8 g=1
E -7.167 10.133 art=3638 id=3638 z=8 g=1
E -5.833 10.133 art=3638 id=3638 z=8 g=1
E -5.833 11.133 art=3638 id=3638 z=8 g=1
E -5.833 12.133 art=3638 id=3638 z=8 g=1
E -5.833 13.133 art=3638 id=3638 z=8 g=1
E -5.833 14.133 art=3638 id=3638 z=8 g=1
E -5.833 15.133 art=3638 id=3638 z=8 g=1
E -5.833 16.133 art=3638 id=3638 z=8 g=1
E -5.833 17.133 art=3638 id=3638 z=8 g=1
E -5.833 18.133 art=3638 id=3638 z=8 g=1
E -4.833 18.133 art=3638 id=3638 z=8 g=1
E -4.833 17.133 art=3638 id=3638 z=8 g=1
E -4.833 16.133 art=3638 id=3638 z=8 g=1
E -4.833 15.133 art=3638 id=3638 z=8 g=1
E -4.833 14.133 art=3638 id=3638 z=8 g=1
E -4.833 13.133 art=3638 id=3638 z=8 g=1
E -4.833 12.133 art=3638 id=3638 z=8 g=1
E -4.833 11.133 art=3638 id=3638 z=8 g=1
E -4.833 10.133 art=3638 id=3638 z=8 g=1
E -3.5 10.133 art=3638 id=3638 z=8 g=1
E -3.5 11.133 art=3638 id=3638 z=8 g=1
E -3.5 12.133 art=3638 id=3638 z=8 g=1
E -3.5 13.133 art=3638 id=3638 z=8 g=1
E -3.5 14.133 art=3638 id=3638 z=8 g=1
E -3.5 15.133 art=3638 id=3638 z=8 g=1
E -3.5 16.133 art=3638 id=3638 z=8 g=1
E -3.5 17.133 art=3638 id=3638 z=8 g=1
E -3.5 18.133 art=3638 id=3638 z=8 g=1
E -2.5 18.133 art=3638 id=3638 z=8 g=1
E -2.5 17.133 art=3638 id=3638 z=8 g=1
E -2.5 16.133 art=3638 id=3638 z=8 g=1
E -2.5 15.133 art=3638 id=3638 z=8 g=1
E -2.5 14.133 art=3638 id=3638 z=8 g=1
E -2.5 13.133 art=3638 id=3638 z=8 g=1
E -2.5 12.133 art=3638 id=3638 z=8 g=1
E -2.5 11.133 art=3638 id=3638 z=8 g=1
E -2.5 10.133 art=3638 id=3638 z=8 g=1
E -1.167 10.133 art=3638 id=3638 z=8 g=1
E -1.167 11.133 art=3638 id=3638 z=8 g=1
E -1.167 12.133 art=3638 id=3638 z=8 g=1
E -1.167 13.133 art=3638 id=3638 z=8 g=1
E -1.167 14.133 art=3638 id=3638 z=8 g=1
E -1.167 15.133 art=3638 id=3638 z=8 g=1
E -1.167 16.133 art=3638 id=3638 z=8 g=1
E -1.167 17.133 art=3638 id=3638 z=8 g=1
E -1.167 18.133 art=3638 id=3638 z=8 g=1
E -9.5 8.833 art=3638 id=3638 z=8 g=1
E -9.5 7.833 art=3638 id=3638 z=8 g=1
E -9.5 6.833 art=3638 id=3638 z=8 g=1
E -9.5 5.833 art=3638 id=3638 z=8 g=1
E -9.5 4.833 art=3638 id=3638 z=8 g=1
E -9.5 3.833 art=3638 id=3638 z=8 g=1
E -9.5 2.833 art=3638 id=3638 z=8 g=1
E -9.5 1.833 art=3638 id=3638 z=8 g=1
E -9.5 0.833 art=3638 id=3638 z=8 g=1
E -8.167 0.833 art=3638 id=3638 z=8 g=1
E -8.167 1.833 art=3638 id=3638 z=8 g=1
E -8.167 2.833 art=3638 id=3638 z=8 g=1
E -8.167 3.833 art=3638 id=3638 z=8 g=1
E -8.167 4.833 art=3638 id=3638 z=8 g=1
E -8.167 5.833 art=3638 id=3638 z=8 g=1
E -8.167 6.833 art=3638 id=3638 z=8 g=1
E -8.167 7.833 art=3638 id=3638 z=8 g=1
E -8.167 8.833 art=3638 id=3638 z=8 g=1
E -7.167 8.833 art=3638 id=3638 z=8 g=1
E -7.167 7.833 art=3638 id=3638 z=8 g=1
E -7.167 6.833 art=3638 id=3638 z=8 g=1
E -7.167 5.833 art=3638 id=3638 z=8 g=1
E -7.167 4.833 art=3638 id=3638 z=8 g=1
E -7.167 3.833 art=3638 id=3638 z=8 g=1
E -7.167 2.833 art=3638 id=3638 z=8 g=1
E -7.167 1.833 art=3638 id=3638 z=8 g=1
E -7.167 0.833 art=3638 id=3638 z=8 g=1
E -5.833 0.833 art=3638 id=3638 z=8 g=1
E -5.833 1.833 art=3638 id=3638 z=8 g=1
E -5.833 2.833 art=3638 id=3638 z=8 g=1
E -5.833 3.833 art=3638 id=3638 z=8 g=1
E -5.833 4.833 art=3638 id=3638 z=8 g=1
E -5.833 5.833 art=3638 id=3638 z=8 g=1
E -5.833 6.833 art=3638 id=3638 z=8 g=1
E -5.833 7.833 art=3638 id=3638 z=8 g=1
E -5.833 8.833 art=3638 id=3638 z=8 g=1
E -4.833 8.833 art=3638 id=3638 z=8 g=1
E -4.833 7.833 art=3638 id=3638 z=8 g=1
E -4.833 6.833 art=3638 id=3638 z=8 g=1
E -4.833 5.833 art=3638 id=3638 z=8 g=1
E -4.833 4.833 art=3638 id=3638 z=8 g=1
E -4.833 3.833 art=3638 id=3638 z=8 g=1
E -4.833 2.833 art=3638 id=3638 z=8 g=1
E -4.833 1.833 art=3638 id=3638 z=8 g=1
E -4.833 0.833 art=3638 id=3638 z=8 g=1
E -3.5 0.833 art=3638 id=3638 z=8 g=1
E -3.5 1.833 art=3638 id=3638 z=8 g=1
E -3.5 2.833 art=3638 id=3638 z=8 g=1
E -3.5 3.833 art=3638 id=3638 z=8 g=1
E -3.5 4.833 art=3638 id=3638 z=8 g=1
E -3.5 5.833 art=3638 id=3638 z=8 g=1
E -3.5 6.833 art=3638 id=3638 z=8 g=1
E -3.5 7.833 art=3638 id=3638 z=8 g=1
E -3.5 8.833 art=3638 id=3638 z=8 g=1
E -2.5 8.833 art=3638 id=3638 z=8 g=1
E -2.5 7.833 art=3638 id=3638 z=8 g=1
E -2.5 6.833 art=3638 id=3638 z=8 g=1
E -2.5 5.833 art=3638 id=3638 z=8 g=1
E -2.5 4.833 art=3638 id=3638 z=8 g=1
E -2.5 3.833 art=3638 id=3638 z=8 g=1
E -2.5 2.833 art=3638 id=3638 z=8 g=1
E -2.5 1.833 art=3638 id=3638 z=8 g=1
E -2.5 0.833 art=3638 id=3638 z=8 g=1
E -1.167 0.833 art=3638 id=3638 z=8 g=1
E -1.167 1.833 art=3638 id=3638 z=8 g=1
E -1.167 2.833 art=3638 id=3638 z=8 g=1
E -1.167 3.833 art=3638 id=3638 z=8 g=1
E -1.167 4.833 art=3638 id=3638 z=8 g=1
E -1.167 5.833 art=3638 id=3638 z=8 g=1
E -1.167 6.833 art=3638 id=3638 z=8 g=1
E -1.167 7.833 art=3638 id=3638 z=8 g=1
E -1.167 8.833 art=3638 id=3638 z=8 g=1
P -16 -1 3652 1
`;

export const WATER_CHART = makeChart({
  name: "WATER",
  rows: 127,
  length: 3620,
  song: "/levels/WATER.mp3",
  start: { b: 0, r: 10 },
  segments: [
  { from: 0, to: 198, mode: 'cube', speed: 0, label: 'cube' },
  { from: 198, to: 263, mode: 'cube', speed: 1, label: 'cube' },
  { from: 263, to: 323, mode: 'ball', speed: 1, label: 'ball' },
  { from: 323, to: 421, mode: 'ufo', speed: 1, label: 'ufo' },
  { from: 421, to: 423, mode: 'cube', speed: 1, label: 'cube' },
  { from: 423, to: 439, mode: 'cube', speed: 0, label: 'cube' },
  { from: 439, to: 484, mode: 'spider', speed: 0, label: 'spider' },
  { from: 484, to: 489, mode: 'spider', speed: 0, label: 'spider' },
  { from: 489, to: 492, mode: 'ball', speed: 0, label: 'ball' },
  { from: 492, to: 512, mode: 'ball', speed: 0, label: 'ball' },
  { from: 512, to: 525, mode: 'ball', speed: 1, label: 'ball' },
  { from: 525, to: 606, mode: 'cube', speed: 1, label: 'cube' },
  { from: 606, to: 650, mode: 'ufo', speed: 1, label: 'ufo' },
  { from: 650, to: 657, mode: 'ufo', speed: 4, label: 'ufo' },
  { from: 657, to: 733, mode: 'cube', speed: 4, label: 'cube' },
  { from: 733, to: 767, mode: 'cube', speed: 2, label: 'cube' },
  { from: 767, to: 769, mode: 'cube', speed: 4, label: 'cube' },
  { from: 769, to: 824, mode: 'ufo', speed: 4, label: 'ufo' },
  { from: 824, to: 871, mode: 'ship', speed: 4, label: 'ship' },
  { from: 871, to: 873, mode: 'cube', speed: 4, label: 'cube' },
  { from: 873, to: 879, mode: 'cube', speed: 3, label: 'cube' },
  { from: 879, to: 968, mode: 'wave', speed: 3, label: 'wave' },
  { from: 968, to: 1054, mode: 'wave', speed: 4, label: 'wave' },
  { from: 1054, to: 1055, mode: 'cube', speed: 4, label: 'cube' },
  { from: 1055, to: 1060, mode: 'cube', speed: 2, label: 'cube' },
  { from: 1060, to: 1120, mode: 'robot', speed: 2, label: 'robot' },
  { from: 1120, to: 1121, mode: 'robot', speed: 2, label: 'robot' },
  { from: 1121, to: 1196, mode: 'ball', speed: 2, label: 'ball' },
  { from: 1196, to: 1268, mode: 'cube', speed: 2, label: 'cube' },
  { from: 1268, to: 1322, mode: 'spider', speed: 2, label: 'spider' },
  { from: 1322, to: 1325, mode: 'cube', speed: 2, label: 'cube' },
  { from: 1325, to: 1345, mode: 'cube', speed: 0, label: 'cube' },
  { from: 1345, to: 1351, mode: 'ship', speed: 0, label: 'ship' },
  { from: 1351, to: 1359, mode: 'ship', speed: 1, label: 'ship' },
  { from: 1359, to: 1368, mode: 'ship', speed: 2, label: 'ship' },
  { from: 1368, to: 1377, mode: 'ship', speed: 3, label: 'ship' },
  { from: 1377, to: 1393, mode: 'ship', speed: 4, label: 'ship' },
  { from: 1393, to: 1432, mode: 'cube', speed: 4, label: 'cube' },
  { from: 1432, to: 1450, mode: 'ship', speed: 4, label: 'ship' },
  { from: 1450, to: 1481, mode: 'spider', speed: 4, label: 'spider' },
  { from: 1481, to: 1483, mode: 'spider', speed: 4, label: 'spider' },
  { from: 1483, to: 1488, mode: 'cube', speed: 4, label: 'cube' },
  { from: 1488, to: 1504, mode: 'ship', speed: 4, label: 'ship' },
  { from: 1504, to: 1542, mode: 'ball', speed: 4, label: 'ball' },
  { from: 1542, to: 1556, mode: 'ship', speed: 4, label: 'ship' },
  { from: 1556, to: 1598, mode: 'wave', speed: 4, label: 'wave' },
  { from: 1598, to: 1614, mode: 'ship', speed: 4, label: 'ship' },
  { from: 1614, to: 1653, mode: 'cube', speed: 4, label: 'cube' },
  { from: 1653, to: 1668, mode: 'ship', speed: 4, label: 'ship' },
  { from: 1668, to: 1707, mode: 'spider', speed: 4, label: 'spider' },
  { from: 1707, to: 1721, mode: 'ship', speed: 4, label: 'ship' },
  { from: 1721, to: 1768, mode: 'ufo', speed: 4, label: 'ufo' },
  { from: 1768, to: 1785, mode: 'ufo', speed: 0, label: 'ufo' },
  { from: 1785, to: 1786, mode: 'cube', speed: 0, label: 'cube' },
  { from: 1786, to: 1935, mode: 'cube', speed: 2, label: 'cube' },
  { from: 1935, to: 2013, mode: 'ship', speed: 2, label: 'ship' },
  { from: 2013, to: 2055, mode: 'wave', speed: 2, label: 'wave' },
  { from: 2055, to: 2057, mode: 'cube', speed: 2, label: 'cube' },
  { from: 2057, to: 2258, mode: 'cube', speed: 0, label: 'cube' },
  { from: 2258, to: 2472, mode: 'spider', speed: 0, label: 'spider' },
  { from: 2472, to: 2473, mode: 'cube', speed: 0, label: 'cube' },
  { from: 2473, to: 2603, mode: 'cube', speed: 2, label: 'cube' },
  { from: 2603, to: 3005, mode: 'cube', speed: 4, label: 'cube' },
  { from: 3005, to: 3006, mode: 'ship', speed: 4, label: 'ship' },
  { from: 3006, to: 3034, mode: 'ship', speed: 0, label: 'ship' },
  { from: 3034, to: 3052, mode: 'cube', speed: 0, label: 'cube' },
  { from: 3052, to: 3233, mode: 'cube', speed: 3, label: 'cube' },
  { from: 3233, to: 3234, mode: 'ufo', speed: 3, label: 'ufo' },
  { from: 3234, to: 3348, mode: 'ufo', speed: 4, label: 'ufo' },
  { from: 3348, to: 3404, mode: 'wave', speed: 4, label: 'wave' },
  { from: 3404, to: 3424, mode: 'wave', speed: 0, label: 'wave' },
  { from: 3424, to: 3620, mode: 'cube', speed: 0, label: 'cube' },
  ],
}, TABLE);
