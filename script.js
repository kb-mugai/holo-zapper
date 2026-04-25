    (function() {
        'use strict';
    
        // --- 設定値 -------------------------------------------
        const config = { //0aOfficial：ホロライブ公式,0fOfficial：ホロEN公式,0dOfficial：DEV_IS公式,holoANは検証中
            GAS_URL: "https://script.google.com/macros/s/AKfycbwS7RwwL7n15B8LNEu3AK9P9pmghhVK2cKJ6S-PTR2M2eYAyiPztbCIKs1jM5Ob6uT_bA/exec",
            ALLOWED_GENS: ["0aOfficial","holoAN","0fOfficial","0dOfficial","0th Gen", "1st Gen", "2nd Gen", "Gamers", "3rd Gen", "4th Gen", "5th Gen", "6th Gen", "Secret Society holoX", "DEV_IS ReGLOSS", "DEV_IS FLOW GLOW"],
            MEMBER_ONLY_REGEX: /メン限|メンバー限定|Member Only|Membership/i,
            LIVE_THRESHOLD_MS: 12 * 60 * 60 * 1000,
            UPDATE_INTERVAL_MS: 2 * 60 * 1000,
            TRUNCATE_LIMIT: 40,
            CH_NAME_TRUNCATE_LIMIT: 10,
            HOUR_SLOT_HEIGHT: 60,
            CH_COL_WIDTH: 100
        };
    
        // --- アプリケーションの状態 -----------------------------
        const state = {
            cachedData: null,
            orderedIds: [],
            channels: {},
            currentVideoId: "",
            isFirstPlay: true,
        };
    
        // --- DOM要素キャッシュ ----------------------------------
        const dom = {
            playerSection: document.getElementById('player-section'),
            videoIframe: document.getElementById('video-iframe'),
            chatIframe: document.getElementById('chat-iframe'),
            currentChName: document.getElementById('current-ch-name'),
            memberGuard: document.getElementById('member-guard'),
            guardTitle: document.getElementById('guard-title'),
            epgStickyHeader: document.getElementById('epg-sticky-header'),
            epgGridBody: document.getElementById('epg-grid-body'),
            epgTimesList: document.getElementById('epg-times-list'),
            epgDate: document.getElementById('epg-date'),
            btnWatch: document.getElementById('btn-watch'),
            btnEpg: document.getElementById('btn-epg'),
           videoLoader: document.getElementById('video-loader'),
        };
    
        // --- ユーティリティ関数 ---------------------------------
        const utils = {
            truncate: (str, len) => {
                if (!str) return "";
                return str.length <= len ? str : str.substr(0, len) + "...";
            },
            isMemberOnlyStream: (title) => config.MEMBER_ONLY_REGEX.test(title),
            isLive: (stream, now = new Date(), threshold = config.LIVE_THRESHOLD_MS) => {
                if (!stream) return false;
                if (stream.status === 'live') return true;
                const st = new Date(stream.start_actual || stream.start_scheduled);
                return (now >= st && (now - st) < threshold);
            },
            getStreamStyleClass: (stream) => {
                if (!stream) return '';
                if (utils.isMemberOnlyStream(stream.title)) return 'member';
                const titleL = stream.title.toLowerCase();
                if (stream.topic_id === '3d_stream' || titleL.includes('3d') || titleL.includes('３ｄ') || titleL.includes('VRC') || (titleL.includes('アコースティック') && (titleL.includes('ライブ') || titleL.includes('live')))) {
                    return 'live3d';
                }
                if (stream.topic_id === 'singing' || titleL.includes('歌枠') || titleL.includes('sing') || titleL.includes('karaoke') || titleL.includes('弾き語り')) {
                    return 'singing';
                }
                return '';
            }
        };
    
        // --- API関連 ------------------------------------------
const api = {
    loadEPG: async () => {
        try {
            console.log("Fetching EPG data...");
            
            // 1. 通信開始のマーク（必要に応じてローディング表示などを追加）
            // 古いデータとの混同を避けるため、コンソールで追跡
            const fetchStartTime = Date.now();

            const res = await fetch(config.GAS_URL);
            
            // 2. HTTPエラーのチェック（200 OK以外を弾く）
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }

            const freshData = await res.json();
            
            // 3. データの検証
            if (!freshData || !Array.isArray(freshData)) {
                console.warn("Invalid data format received from GAS");
                return;
            }

            if (freshData.length === 0) {
                console.warn("Received empty stream list");
                // データが空の場合は、あえて画面をクリアするか、前の状態を維持するか判断
                // ここでは「最新の空の状態」を反映させるためにrenderを呼びます
            }

            // 4. ステートの更新と描画の実行
            // GASから返ってきた最新のJSONを確実にstateにセット
            state.cachedData = freshData;
            
            console.log(`Data received. Count: ${freshData.length} (${Date.now() - fetchStartTime}ms)`);
            
            // 描画実行（render内でDOMは一旦全クリアされる仕組みになっています）
            epg.render(state.cachedData);

        } catch(e) { 
            console.error("EPG Load Error (Network or Parse):", e); 
            // 失敗した場合は、ユーザーにわかるようコンソール以外に通知を出すことも検討
        }
    }
};
    
// --- UI関連 -------------------------------------------
        const ui = {
            setMode: (m) => {
                document.body.className = 'mode-' + m;
                dom.btnWatch.classList.toggle('active', m === 'watch');
                dom.btnEpg.classList.toggle('active', m === 'epg');
            },
            closeMemberGuard: () => { 
                dom.memberGuard.style.display = 'none'; 
            },
            // ★修正：判定を「含む」に変更し、画像があっても検知できるように
            updateActiveChannel: (name) => {
                const targetShortName = name.substring(0, config.CH_NAME_TRUNCATE_LIMIT).trim();
                document.querySelectorAll('.ch-name-box').forEach(el => {
                    el.classList.remove('active-ch');
                    if (el.textContent.includes(targetShortName)) {
                        el.classList.add('active-ch');
                    }
                });
            },
            handleMobileGuard: (e) => {
                if (dom.playerSection.classList.contains('needs-first-tap')) {
                    dom.playerSection.classList.remove('needs-first-tap');
                    const iframe = dom.videoIframe;
                    if (iframe && iframe.contentWindow) {
                        iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                    }
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        };
        
// --- プレイヤー関連 -------------------------------------
        // --- プレイヤー関連 -------------------------------------
const player = {
    play: (id, name, title, member) => {
        if (!id) return;
        state.currentVideoId = id;

        // ローダー（クルクル）を表示
        if (dom.videoLoader) dom.videoLoader.classList.remove('hidden-loader');

        const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        dom.playerSection.classList.toggle('needs-first-tap', isMobileDevice);

        // ★修正：iframe読み込み完了時の処理
        dom.videoIframe.onload = () => {
            console.log("Video Iframe loaded:", id);
            
            // ローダー（クルクル）を消す
            if (dom.videoLoader) {
                dom.videoLoader.classList.add('hidden-loader');
            }

            // メン限の場合、YouTube側が「再生不可」を返して読み込み完了になるため
            // ここでガードを再表示（維持）させる
            if (member) {
                dom.memberGuard.style.display = 'flex';
            }
        };

        dom.videoIframe.src = `https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&rel=0&enablejsapi=1`;
        dom.chatIframe.src = `https://www.youtube.com/live_chat?v=${id}&embed_domain=${window.location.hostname}`;
        
        dom.currentChName.innerText = name;
        ui.updateActiveChannel(name);                

        // ガードの初期表示判定
        if (member) {
            dom.guardTitle.innerText = title;
            dom.memberGuard.style.display = 'flex';
        } else {
            ui.closeMemberGuard();
        }

        // ★修正：5秒後の強制非表示処理
        setTimeout(() => {
            // メン限でない時だけ、ローダーを強制的に消す
            // （メン限時は onload 側で制御するため、ここでは何もしない）
            if (!member && dom.videoLoader && !dom.videoLoader.classList.contains('hidden-loader')) {
                dom.videoLoader.classList.add('hidden-loader');
            }
        }, 5000);

    },
    // ... changeChannel, openYouTube はそのまま ...

            changeChannel: (dir) => {
                const now = new Date();
                // 1. 現在ライブ中のチャンネルを「今の並び順」で抽出
                // state.orderedIds は render 時に決まった並び順を保持している
                const liveChList = state.orderedIds
                    .map(id => state.channels[id])
                    .filter(ch => ch.streams.some(s => utils.isLive(s, now)));

                if (liveChList.length === 0) return;

                // 2. 「現在再生中のvideoId」を持っているチャンネルがリストのどこにいるか探す
                let idx = liveChList.findIndex(ch => 
                    ch.streams.some(s => s.id === state.currentVideoId)
                );

                // 3. インデックスの計算
                if (idx === -1) {
                    // 見つからない場合は0番目（リストの先頭）へ
                    idx = 0;
                } else {
                    // 方向（dir）を加えてループさせる
                    idx = (idx + dir + liveChList.length) % liveChList.length;
                }

                const targetCh = liveChList[idx];
                // 4. そのチャンネルの「今ライブ中の配信」を探して再生
                const targetStream = targetCh.streams.find(s => utils.isLive(s, now));
                
                if (targetStream) {
                    player.play(targetStream.id, targetCh.info.name, targetStream.title, utils.isMemberOnlyStream(targetStream.title));
                }
            },

            openYouTube: () => { 
                if (state.currentVideoId) window.open(`https://www.youtube.com/watch?v=${state.currentVideoId}`, '_blank'); 
            }
        };
    
            // --- EPG（番組表）関連 ----------------------------------
            const epg = {
                prepareChannelData: (data) => {
                    state.channels = {};
                    data.forEach(s => {
                        if (s.channel.org !== "Hololive") return;
                        const sub = (s.channel.suborg || "").toLowerCase();
                        if (sub.includes("holostars") || sub.includes("english") || sub.includes("indonesia")) return;
                        const genIndex = config.ALLOWED_GENS.findIndex(g => new RegExp(g.toLowerCase()).test(sub));
                        if (genIndex !== -1) {
                            if (!state.channels[s.channel.id]) {
                                state.channels[s.channel.id] = { info: s.channel, streams: [], genScore: genIndex };
                            }
                            state.channels[s.channel.id].streams.push(s);
                        }
                    });
                },
        
                calculateTimeAxis: (gridStartTime) => {
                    let maxEndDate = new Date(gridStartTime);
                    Object.values(state.channels).forEach(ch => ch.streams.forEach(s => {
                        const streamDate = new Date(s.start_actual || s.start_scheduled);
                        if (streamDate > maxEndDate) maxEndDate = streamDate;
                    }));
        
                    const hourMap = {};
                    Object.values(state.channels).forEach(ch => ch.streams.forEach(s => {
                        const st = new Date(s.start_actual || s.start_scheduled);
                        const et = new Date(st.getTime() + 60 * 60 * 1000); // 1h duration
                        let loopTime = new Date(st);
                        loopTime.setMinutes(0, 0, 0);
                        while (loopTime < et) {
                            const hourDiff = loopTime - gridStartTime;
                            if (hourDiff >= 0) {
                                const hourIndex = Math.floor(hourDiff / (1000 * 60 * 60));
                                hourMap[hourIndex] = true;
                            }
                            loopTime.setHours(loopTime.getHours() + 1);
                        }
                    }));
                    
                    const displayEndDate = new Date(maxEndDate);
                    displayEndDate.setHours(displayEndDate.getHours() + 1, 0, 0, 0);
                    const totalHours = Math.ceil((displayEndDate - gridStartTime) / (1000 * 60 * 60));
                    
                    return { hourMap, totalHours };
                },
        
                        renderTimeAxis: (timeAxis, gridStartTime) => {
                            const gridFragment = document.createDocumentFragment();
                            const timeFragment = document.createDocumentFragment();

                            let currentY = 0;
                            const minuteToY = [];
                            let lastDateValue = -1;
                            let isFirstSlotAfterDateChange = false;
                
                            for (let i = 0; i < timeAxis.totalHours; i++) {
                                const loopDate = new Date(gridStartTime);
                                loopDate.setHours(gridStartTime.getHours() + i);
                                const hour = loopDate.getHours();
                                const currentDateValue = loopDate.getDate();
                
                                if (lastDateValue !== -1 && lastDateValue !== currentDateValue) isFirstSlotAfterDateChange = true;
                
                                if (timeAxis.hourMap[i]) {
                                    const isEvenDay = currentDateValue % 2 === 0;
                                    
                                    if (isEvenDay) {
                                        const bg = document.createElement('div');
                                        bg.className = 'grid-background even-day';
                                        bg.style.top = `${currentY}px`;
                                        bg.style.height = `${config.HOUR_SLOT_HEIGHT}px`;
                                        gridFragment.appendChild(bg);
                                    }
                
                                    const timeSlotDiv = document.createElement('div');
                                    timeSlotDiv.className = 'time-slot';
                                    if (isEvenDay) timeSlotDiv.classList.add('even-day');
                
                                    if (i === 0 || hour === 0 || isFirstSlotAfterDateChange) {
                                        const dateText = `${loopDate.getMonth() + 1}/${currentDateValue}`;
                                        const timeText = (hour === 0) ? `0:00` : `${hour}:00`;
                                        timeSlotDiv.innerHTML = `<div class="time-slot-date">${dateText}</div><div>${timeText}</div>`;
                                        timeSlotDiv.classList.add('time-slot-date-change');
                                        timeSlotDiv.classList.add(isEvenDay ? 'even-day-label' : 'odd-day-label');
                                        isFirstSlotAfterDateChange = false;
                                    } else {
                                        timeSlotDiv.innerText = `${hour}:00`;
                                    }
                                    timeFragment.appendChild(timeSlotDiv);
                
                                    for (let m = 0; m < 60; m++) { minuteToY.push(currentY + m); }
                                    currentY += config.HOUR_SLOT_HEIGHT;
                                } else {
                                    for (let m = 0; m < 60; m++) { minuteToY.push(-1); }
                                }
                                lastDateValue = currentDateValue;
                            }
                            dom.epgGridBody.appendChild(gridFragment);
                            dom.epgTimesList.appendChild(timeFragment);

                            dom.epgGridBody.style.height = `${currentY}px`;
                            return minuteToY;
                        },
                
                        sortAndOrderChannels: (now) => {
                            state.orderedIds = Object.keys(state.channels).sort((a, b) => {
                                const liveA = state.channels[a].streams.some(s => utils.isLive(s, now));
                                const liveB = state.channels[b].streams.some(s => utils.isLive(s, now));
                                if (liveA !== liveB) return liveB - liveA;
                                return state.channels[a].genScore - state.channels[b].genScore;
                            });
                        },
                
                        renderChannelHeaders: (now) => {
                            dom.epgGridBody.style.width = `${state.orderedIds.length * config.CH_COL_WIDTH}px`;

                            const fragment = document.createDocumentFragment();
                
                            state.orderedIds.forEach((chId) => {
                                const ch = state.channels[chId];
                                const col = document.createElement('div');
                                col.className = 'ch-col-header';
                
                                const nameBox = document.createElement('div');
                                nameBox.className = 'ch-name-box';
                                if (ch.info.name.includes(dom.currentChName.innerText.trim()) && dom.currentChName.innerText !== "") {
    nameBox.classList.add('active-ch');
}
                                nameBox.innerHTML = `<img class="ch-col-header-img" src="${ch.info.photo}">${utils.truncate(ch.info.name, config.CH_NAME_TRUNCATE_LIMIT)}`;
                                
                                const liveStream = ch.streams.find(s => utils.isLive(s, now));
                
                                const nowBox = document.createElement('div');
                                let nowBoxClass = 'now-stream-box', isMember = false, displayTitle = '---', prefix = '';
                
                                if (liveStream) {
                                    isMember = utils.isMemberOnlyStream(liveStream.title);
                                    const styleClass = utils.getStreamStyleClass(liveStream);
                                    if (styleClass) nowBoxClass += ' ' + styleClass;
                                    if (isMember) prefix = '🔒 ';
                                    displayTitle = utils.truncate(liveStream.title, config.TRUNCATE_LIMIT);
                                    nowBox.onclick = () => player.play(liveStream.id, ch.info.name, liveStream.title, isMember);
                                } else {
                                    nowBoxClass += ' empty';
                                }
                                nowBox.className = nowBoxClass;
                                nowBox.innerHTML = prefix + displayTitle;
                                col.appendChild(nameBox); col.appendChild(nowBox);
                                fragment.appendChild(col);
                            });
                            dom.epgStickyHeader.appendChild(fragment);
                        },
                
                        renderStreamCards: (minuteToY, gridStartTime, now) => {
                            const fragment = document.createDocumentFragment();
                            
                            state.orderedIds.forEach((chId, idx) => {
                                const ch = state.channels[chId];
                                const chX = idx * config.CH_COL_WIDTH;
                                const liveStream = ch.streams.find(s => utils.isLive(s, now));
                
                                ch.streams.forEach(s => {
                                    if (liveStream && s.id === liveStream.id) return; // "NOW"枠にあるものは描画しない
                                    const st = new Date(s.start_actual || s.start_scheduled);
                                    const diffMin = Math.floor((st - gridStartTime) / (1000 * 60));
                                    const topPos = (diffMin >= 0 && diffMin < minuteToY.length) ? minuteToY[diffMin] : -1;
                                    
                                    if (topPos !== -1) {
                                        const card = document.createElement('div');
                                        card.className = 'stream-card';
                                        const mem = utils.isMemberOnlyStream(s.title);
                                        const styleClass = utils.getStreamStyleClass(s);
                                        if (styleClass) card.classList.add(styleClass);
                
                                        card.style.left = `${chX}px`;
                                        card.style.top = `${topPos}px`;
                
                                        const dateS = `${st.getMonth()+1}/${st.getDate()} ${st.getHours()}:${st.getMinutes().toString().padStart(2,'0')}`;
                                        card.innerHTML = `<div class="stream-card-date">${dateS}</div><div class="stream-card-title">${utils.truncate(s.title, config.TRUNCATE_LIMIT)}</div>`;
                                        card.onclick = () => player.play(s.id, ch.info.name, s.title, mem);
                                        fragment.appendChild(card);
                                    }
                                });
                            });
                            dom.epgGridBody.appendChild(fragment);
                        },        
                triggerInitialPlay: (now) => {
                    if (state.isFirstPlay && state.orderedIds.length > 0) {
                        const firstId = state.orderedIds[0];
                        const threeHours = 3 * 60 * 60 * 1000;
                        const firstStream = state.channels[firstId].streams.find(s => utils.isLive(s, now, threeHours)) || state.channels[firstId].streams[0];
                        if (firstStream) {
                            player.play(firstStream.id, state.channels[firstId].info.name, firstStream.title, utils.isMemberOnlyStream(firstStream.title));
                        }
                        state.isFirstPlay = false;
                    }
                },
        
render: (data) => {
        // ★重要: 描画の冒頭で既存のDOMを全て確実にクリアする
        // これにより、古いデータが残ることは物理的にあり得なくなります
        dom.epgStickyHeader.innerHTML = ''; 
        dom.epgGridBody.innerHTML = ''; 
        dom.epgTimesList.innerHTML = '';
        
        // データが空ならここで終了
        if (!data || data.length === 0) {
            dom.epgGridBody.innerHTML = '<div style="padding:20px; color:white;">ライブ予定が見つかりませんでした</div>';
            return;
        }

        const now = new Date();
        dom.epgDate.innerText = `${now.getMonth()+1}/${now.getDate()}`;
        
        const gridStartTime = new Date(now);
        gridStartTime.setMinutes(0, 0, 0);

        // 各工程を実行
        epg.prepareChannelData(data);
        const timeAxis = epg.calculateTimeAxis(gridStartTime);
        const minuteToY = epg.renderTimeAxis(timeAxis, gridStartTime);
        
        epg.sortAndOrderChannels(now);
        epg.renderChannelHeaders(now);
        epg.renderStreamCards(minuteToY, gridStartTime, now);
        
        // 初回プレイまたはチャンネルが変わっていない場合の整合性チェック
        epg.triggerInitialPlay(now);
        
        console.log("EPG Render complete with fresh data.");
    }
};
        // --- 初期化処理 ---------------------------------------
        function init() {
            // イベントリスナーを設定
            document.addEventListener('DOMContentLoaded', () => {
                dom.playerSection.addEventListener('click', ui.handleMobileGuard, true);
                dom.playerSection.addEventListener('touchstart', ui.handleMobileGuard, { passive: false });
            });
    
            window.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowLeft') player.changeChannel(-1);
                if (e.key === 'ArrowRight') player.changeChannel(1);
            });
    
            // ★ここを修正：playerオブジェクトを丸ごと公開する
            window.player = player; 
            window.setMode = ui.setMode;
            window.openYouTube = player.openYouTube;
            window.closeGuard = ui.closeMemberGuard;
    
            // EPGを読み込み、定期更新を開始
            api.loadEPG();
            setInterval(api.loadEPG, config.UPDATE_INTERVAL_MS);
        }
    
        init();
    
    })();
