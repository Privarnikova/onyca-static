/**
 * Onyca Digital — базовая функциональная логика (Этап 0-1).
 *
 * Анимационный слой (магнитные кнопки, шоурил, marquee логотипов и т.д. —
 * ТЗ, раздел 03) сюда сознательно не включён: он идёт вторым проходом
 * (см. PLAN.md, этап 5), после того как страницы работают функционально,
 * и часть решений там прямо помечена «обсудить» с заказчиком.
 */

( function () {
	'use strict';

	/**
	 * Хедер: при скролле вниз скрывается, при скролле вверх появляется
	 * (ТЗ, п. 03-01).
	 *
	 * На первом экране шапка ведёт себя иначе — она полностью статична:
	 * стоит на месте и не реагирует на прокрутку ни вниз, ни вверх.
	 * Прятаться и выпадать она начинает только после первого экрана.
	 *
	 * Позиционирование при этом не меняется: шапка всё время липкая, а
	 * переключение position давало бы скачок вёрстки на пороге.
	 */
	function initHeaderScroll() {
		var header = document.querySelector( '[data-site-header]' );
		if ( ! header ) {
			return;
		}

		var firstScreen = document.querySelector( '[data-first-screen]' );
		var lastScrollY = window.scrollY;
		var headerHeight = header.offsetHeight;

		/*
		 * Пока эта отметка не пройдена, шапка просто стоит на месте.
		 * Отметка — низ первого экрана: он должен уйти за верхнюю кромку
		 * окна целиком.
		 */
		function staticUntil() {
			if ( ! firstScreen ) {
				return 0;
			}

			return firstScreen.offsetTop + firstScreen.offsetHeight;
		}

		function update() {
			var currentScrollY = window.scrollY;
			var isStatic = currentScrollY < staticUntil();

			header.classList.toggle( 'is-static', isStatic );

			if ( isStatic ) {
				header.classList.remove( 'is-hidden' );
			} else if ( currentScrollY <= headerHeight ) {
				header.classList.remove( 'is-hidden' );
			} else if ( currentScrollY > lastScrollY ) {
				header.classList.add( 'is-hidden' );
			} else if ( currentScrollY < lastScrollY ) {
				header.classList.remove( 'is-hidden' );
			}

			lastScrollY = currentScrollY;
		}

		update();
		window.addEventListener( 'scroll', update, { passive: true } );
		window.addEventListener( 'resize', update );
	}

	/**
	 * Бургер-меню — открытие/закрытие.
	 */
	function initBurgerMenu() {
		var toggle = document.querySelector( '[data-burger-toggle]' );
		var menu = document.getElementById( 'burger-menu' );

		if ( ! toggle || ! menu ) {
			return;
		}

		/**
		 * Высота панели — до низа вьюпорта от её РЕАЛЬНОЙ позиции (не
		 * фиксированные 100vh: панель начинается на top:100% от шапки,
		 * а не от 0, и если шапка ещё не «прилипла» (например, в админке
		 * до скролла её сдвигает вниз wp-adminbar), 100vh уводит низ
		 * панели ЗА пределы вьюпорта — Telegram/email оказывались
		 * недостижимы даже через прокрутку самой панели). Пересчитывается
		 * при открытии и при resize, пока меню открыто.
		 */
		function setMenuHeight() {
			var top = menu.getBoundingClientRect().top;
			menu.style.height = ( window.innerHeight - top ) + 'px';
		}

		/**
		 * Блокировка скролла, пока меню открыто. Через overflow на <html>, а
		 * НЕ через body{position:fixed}: fixed делает body позиционированным
		 * предком, и панель WP admin bar (ниже 783px она position:absolute)
		 * начинает ездить вместе с body, а её компенсация
		 * html.wp-toolbar{padding-top} перестаёт действовать — шапку с лого и
		 * крестиком накрывало чёрной панелью. С overflow страница остаётся в
		 * потоке: админ-бар, шапка и панель стоят там же, где и до открытия.
		 * Позицию прокрутки overflow сохраняет сам, восстанавливать её после
		 * закрытия не нужно.
		 */
		function lockScroll() {
			var scrollbar = window.innerWidth - document.documentElement.clientWidth;

			document.documentElement.style.overflow = 'hidden';

			// Чтобы контент не дёрнулся вбок на ширину исчезнувшего скроллбара.
			if ( scrollbar > 0 ) {
				document.documentElement.style.paddingRight = scrollbar + 'px';
			}
		}

		function unlockScroll() {
			document.documentElement.style.overflow = '';
			document.documentElement.style.paddingRight = '';
		}

		/*
		 * Баннер cookie и кнопка «Обсудить проект» перекрывали бы открытую
		 * панель (оба fixed внизу экрана), поэтому на время открытого меню
		 * их прячем и возвращаем при закрытии — баннер только если
		 * посетитель ещё не нажал «Принять».
		 */
		function toggleCookieBanner( menuOpen ) {
			var discuss = document.querySelector( '[data-discuss-button]' );

			if ( discuss ) {
				discuss.hidden = menuOpen;
			}

			var banner = document.querySelector( '[data-cookie-banner]' );

			if ( ! banner || banner.dataset.accepted === '1' ) {
				return;
			}

			banner.hidden = menuOpen;
		}

		function closeMenu() {
			toggle.setAttribute( 'aria-expanded', 'false' );
			menu.hidden = true;
			unlockScroll();
			toggleCookieBanner( false );
		}

		toggle.addEventListener( 'click', function () {
			var isOpen = toggle.getAttribute( 'aria-expanded' ) === 'true';

			if ( isOpen ) {
				closeMenu();
				return;
			}

			toggle.setAttribute( 'aria-expanded', 'true' );
			menu.hidden = false;
			lockScroll();
			setMenuHeight();
			toggleCookieBanner( true );
		} );

		window.addEventListener( 'resize', function () {
			if ( toggle.getAttribute( 'aria-expanded' ) !== 'true' ) {
				return;
			}

			/*
			 * Выше 1200 бургера нет — там десктопная шапка с полным меню.
			 * Если растянуть окно с открытой панелью, её стили (они целиком
			 * внутри @media max-width:1200) отваливаются, и панель остаётся
			 * висеть поверх страницы голым списком, а скролл — заблокирован.
			 * Поэтому на выходе из планшетного диапазона меню закрываем.
			 */
			if ( window.matchMedia( '(min-width: 1201px)' ).matches ) {
				closeMenu();
				return;
			}

			setMenuHeight();
		} );

		menu.querySelectorAll( '.menu-item-has-children > a' ).forEach( function ( link ) {
			link.addEventListener( 'click', function ( e ) {
				e.preventDefault();

				var item = link.closest( '.menu-item-has-children' );
				var sub = item.querySelector( '.sub-menu' );

				if ( ! sub ) {
					item.classList.toggle( 'is-open' );
					return;
				}

				if ( item.classList.contains( 'is-open' ) ) {
					item.classList.remove( 'is-open' );
					sub.style.maxHeight = '';
					return;
				}

				/*
				 * Итоговую высоту снимаем «вхолостую»: на миг применяем
				 * открытое состояние с выключенной анимацией, запоминаем
				 * scrollHeight (в него входит и padding-top) и тут же
				 * возвращаем всё назад. Иначе одно из двух: либо отступ не
				 * попадает в замер и последний пункт («Все услуги»)
				 * обрезается, либо он применяется мгновенно и список
				 * прыгает на 24px до начала анимации.
				 *
				 * Фиксированного значения тут быть не может: в CSS раньше
				 * стояли 400px при списке ~140, и анимация две трети
				 * времени шла вхолостую.
				 */
				sub.style.transition = 'none';
				sub.style.maxHeight = 'none';
				item.classList.add( 'is-open' );

				var target = sub.scrollHeight;

				item.classList.remove( 'is-open' );
				sub.style.maxHeight = '0px';
				void sub.offsetHeight;
				sub.style.transition = '';

				// Теперь по-настоящему: и высота, и отступ едут вместе
				item.classList.add( 'is-open' );
				sub.style.maxHeight = target + 'px';
			} );
		} );
	}

	/**
	 * Табы-фильтры на архивах блога/проектов (ТЗ, п. 05-01, 05-02).
	 * Работают через query-параметры (?topic=, ?industry=, ?project_service=),
	 * серверная логика — inc/query-filters.php. Несколько тегов внутри одной
	 * группы можно выбрать одновременно (переключение toggle), клик
	 * перезагружает страницу с обновлёнными параметрами.
	 */
	function initFilterTabs() {
		var groups = document.querySelectorAll( '[data-filter-group]' );

		if ( ! groups.length ) {
			return;
		}

		groups.forEach( function ( group ) {
			var paramName = group.getAttribute( 'data-filter-group' );
			var url = new URL( window.location.href );
			var activeSlugs = ( url.searchParams.get( paramName ) || '' )
				.split( ',' )
				.filter( Boolean );

			group.querySelectorAll( '.filter-tab' ).forEach( function ( tab ) {
				var slug =
					tab.getAttribute( 'data-topic-slug' ) ||
					tab.getAttribute( 'data-industry-slug' ) ||
					tab.getAttribute( 'data-service-slug' );

				if ( activeSlugs.indexOf( slug ) !== -1 ) {
					tab.classList.add( 'is-active' );
				}

				tab.addEventListener( 'click', function () {
					var nextUrl = new URL( window.location.href );
					var slugs = ( nextUrl.searchParams.get( paramName ) || '' )
						.split( ',' )
						.filter( Boolean );

					var index = slugs.indexOf( slug );
					if ( index === -1 ) {
						slugs.push( slug );
					} else {
						slugs.splice( index, 1 );
					}

					if ( slugs.length ) {
						nextUrl.searchParams.set( paramName, slugs.join( ',' ) );
					} else {
						nextUrl.searchParams.delete( paramName );
					}

					window.location.href = nextUrl.toString();
				} );
			} );
		} );
	}

	/**
	 * Пилюли-табы «Ваш проект» в форме на Контактах (.tab-pill, см.
	 * components/tabs.css) — локальный toggle-выбор, несколько сразу,
	 * без перезагрузки страницы (это поле формы, не фильтр архива, как
	 * initFilterTabs выше — тут не нужны query-параметры). Что делать с
	 * выбором при отправке — часть этапа «Формы и интеграции».
	 */
	/**
	 * Валидация формы на Контактах. Состояние «Ошибка» — Figma (1920
	 * 1236:1915 и одноимённые узлы на 1600/1200/700/360): обязательны тег
	 * проекта, email, бюджет и согласие. Подписи этих групп краснеют, у
	 * согласия дополнительно краснеет контрол и появляется сообщение.
	 *
	 * Проверка своя, а не браузерная (форма с novalidate): встроенная
	 * показала бы свой пузырь и не дала бы состояние из макета.
	 */
	function initContactForm() {
		/*
		 * Форм на странице может быть несколько: своя на Контактах и по
		 * одной в каждой панели поп-апа. Раньше обработчик вешался только
		 * на первую, и форма в поп-апе не проверялась вовсе.
		 */
		document.querySelectorAll( '.contact-form' ).forEach( setupForm );
	}

	/**
	 * Прокрутка к первому незаполненному полю — общее правило для всех
	 * форм сайта: после неудачной отправки посетитель должен видеть, что
	 * именно просят исправить, а не искать красное сам.
	 *
	 * Если поле и так на экране, ничего не двигаем — иначе страница
	 * дёргается на ровном месте.
	 */
	function scrollToFirstError( form ) {
		var first = form.querySelector( '.is-error' );

		if ( ! first ) {
			return;
		}

		var box = first.getBoundingClientRect();
		var visible = box.top >= 0 && box.bottom <= window.innerHeight;

		if ( visible ) {
			return;
		}

		first.scrollIntoView( { block: 'center', behavior: 'smooth' } );
	}

	function setupForm( form ) {
		var consentError = form.querySelector( '[data-consent-error]' );
		/* У формы вакансии нет ни тегов услуг, ни бюджета */
		var isCareer = form.classList.contains( 'contact-form--career' );

		/*
		 * «Расскажите о проекте» растёт по содержимому: пустое поле в одну
		 * строку, как соседние, дальше высота по фактическому тексту (в
		 * макете заполненное поле втрое выше обычного). Считаем по
		 * scrollHeight, сбрасывая высоту перед замером, иначе она только
		 * растёт и никогда не уменьшается.
		 */
		var textarea = form.querySelector( 'textarea' );

		if ( textarea ) {
			var resize = function () {
				textarea.style.height = 'auto';

				/*
				 * У скрытого элемента scrollHeight равен нулю — так было
				 * с полем внутри закрытого поп-апа, и оно схлопывалось,
				 * а подпись ложилась на линию. Мерить нечего: убираем
				 * свою высоту, поле остаётся в одну строку по CSS, как
				 * обычный input, и пересчитается, когда его покажут.
				 */
				if ( ! textarea.scrollHeight ) {
					textarea.style.height = '';
					return;
				}

				textarea.style.height = textarea.scrollHeight + 'px';
			};

			textarea.addEventListener( 'input', resize );
			window.addEventListener( 'resize', resize );
			resize();

			/*
			 * У скрытого элемента scrollHeight равен нулю, поэтому в
			 * поп-апе поле схлопывалось и подпись ложилась прямо на
			 * линию. Пересчитываем высоту, когда панель показали.
			 */
			form.addEventListener( 'onyca:shown', resize );
		}

		function group( name ) {
			return form.querySelector( '[data-required-group="' + name + '"]' );
		}

		function mark( el, hasError ) {
			if ( ! el ) {
				return hasError;
			}

			el.classList.toggle( 'is-error', hasError );

			return hasError;
		}

		function checks() {
			var email = form.querySelector( 'input[type="email"]' );

			return {
				tags: ! isCareer && ! form.querySelector( '.tab-pill.is-selected' ),
				// Точный разбор адреса тут не нужен: письмо всё равно
				// проверяется на сервере, здесь — только форма записи.
				email: ! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( email.value.trim() ),
				budget: ! isCareer && ! form.querySelector( '[name="contact_budget"]:checked' ),
				consent: ! form.querySelector( 'input[type="checkbox"]' ).checked
			};
		}

		function validate() {
			var state = checks();
			var consentControl = form.querySelector( 'input[type="checkbox"]' );

			mark( group( 'tags' ), state.tags );
			mark( group( 'email' ), state.email );
			mark( group( 'budget' ), state.budget );
			mark( group( 'consent' ), state.consent );

			consentControl.classList.toggle( 'is-required-error', state.consent );
			consentError.hidden = ! state.consent;

			return ! ( state.tags || state.email || state.budget || state.consent );
		}

		form.addEventListener( 'submit', function ( event ) {
			/*
			 * Отправки на сервер пока нет (этап «Формы и интеграции»),
			 * поэтому событие останавливаем всегда: прошла проверка —
			 * показываем экран «Заявка отправлена». Когда появится
			 * реальная отправка, экран успеха/ошибки будет выбираться по
			 * ответу сервера — здесь же, в этом обработчике.
			 */
			event.preventDefault();

			if ( validate() ) {
				showFormResult( 'success', form );
				return;
			}

			scrollToFirstError( form );
		} );

		/*
		 * Пока ошибка показана, снимаем её сразу, как только поле
		 * исправили, — иначе красное остаётся висеть до следующей отправки.
		 */
		form.addEventListener( 'input', function () {
			if ( form.querySelector( '.is-error' ) ) {
				validate();
			}
		} );

		form.addEventListener( 'change', function () {
			if ( form.querySelector( '.is-error' ) ) {
				validate();
			}
		} );

		form.addEventListener( 'click', function ( event ) {
			if ( event.target.closest( '.tab-pill' ) && form.querySelector( '.is-error' ) ) {
				validate();
			}
		} );
	}

	/**
	 * Кнопки ЦД (ТЗ п. 02, тип 1): притягиваются к курсору и заливаются
	 * при наведении. Референс поведения — кнопка Telegram на EikoDigital.
	 *
	 * Разметку достраиваем здесь, а не в шаблонах: кнопке нужен слой
	 * заливки и обёртка текста, и делать это в каждом месте вывода значило
	 * бы дублировать её в разметке. Так любая новая .btn--cta получает
	 * эффект сама.
	 *
	 * Сила притяжения: сама кнопка тянется на 25px, текст внутри — на 15,
	 * из-за разницы кнопка выглядит «тянущейся», а не едущей целиком.
	 *
	 * Зона притяжения — ореол ровно в 32px вокруг кнопки, одинаковый у
	 * всех ЦД-кнопок и одинаковой толщины по всему периметру. Раньше она
	 * считалась кругом по большей стороне (половина плюс 60px), и у
	 * широкой кнопки «Отправить» радиус доходил до 360px: она начинала
	 * тянуться, когда курсор был ещё у поля «Расскажите о проекте».
	 */
	var MAGNET_REACH = 32;

	/**
	 * Сдвиг, который сейчас реально применён к элементу. В matrix(...)
	 * последние две цифры — перенос по x и y; во время перехода это
	 * промежуточные значения, они-то и нужны.
	 */
	function currentShift( element ) {
		var transform = getComputedStyle( element ).transform;

		if ( ! transform || transform === 'none' ) {
			return { x: 0, y: 0 };
		}

		var values = transform.match( /matrix\(([^)]+)\)/ );

		if ( ! values ) {
			return { x: 0, y: 0 };
		}

		var parts = values[ 1 ].split( ',' );

		return {
			x: parseFloat( parts[ 4 ] ) || 0,
			y: parseFloat( parts[ 5 ] ) || 0
		};
	}
	function initMagneticButtons() {
		var buttons = document.querySelectorAll( '.btn--cta' );

		if ( ! buttons.length ) {
			return;
		}

		// Тач и «уменьшить движение» — без магнита: там тянуть нечем и незачем.
		var enabled = window.matchMedia( '(hover: hover)' ).matches &&
			! window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

		var items = [];

		buttons.forEach( function ( btn ) {
			if ( ! btn.querySelector( '.btn__fill' ) ) {
				var fill = document.createElement( 'span' );
				fill.className = 'btn__fill';
				fill.setAttribute( 'aria-hidden', 'true' );

				var text = document.createElement( 'span' );
				text.className = 'btn__text';
				while ( btn.firstChild ) {
					text.appendChild( btn.firstChild );
				}

				btn.appendChild( fill );
				btn.appendChild( text );
			}

			items.push( {
				el: btn,
				text: btn.querySelector( '.btn__text' ),
				strength: 25,
				textStrength: 15
			} );
		} );

		if ( ! enabled ) {
			return;
		}

		var ticking = false;
		var pointer = { x: 0, y: 0 };

		function update() {
			ticking = false;

			items.forEach( function ( item ) {
				var rect = item.el.getBoundingClientRect();
				var halfWidth = rect.width / 2;
				var halfHeight = rect.height / 2;
				/*
				 * Центр берём БЕЗ текущего сдвига: притянутая кнопка стоит
				 * ближе к курсору, и если считать зону по её новому месту,
				 * зона тянется следом — кнопка залипает притянутой далеко
				 * за ореолом.
				 *
				 * Сдвиг снимаем именно с ФАКТИЧЕСКОГО transform, а не с
				 * последнего заданного значения: между ними идёт переход
				 * (transition), и пока он не закончился, эти числа разные —
				 * от их расхождения кнопка при входе в зону дёргалась.
				 */
				var applied = currentShift( item.el );
				var cx = rect.left + halfWidth - applied.x;
				var cy = rect.top + halfHeight - applied.y;
				var dx = pointer.x - cx;
				var dy = pointer.y - cy;

				/*
				 * Насколько курсор вышел за края кнопки по каждой оси.
				 * Внутри кнопки оба значения нулевые, снаружи растут — и
				 * зоной оказывается сама кнопка, расширенная на ореол, а
				 * не круг вокруг её центра.
				 */
				var outsideX = Math.max( 0, Math.abs( dx ) - halfWidth );
				var outsideY = Math.max( 0, Math.abs( dy ) - halfHeight );

				if ( outsideX > MAGNET_REACH || outsideY > MAGNET_REACH ) {
					item.el.style.transform = '';
					item.text.style.transform = '';
					return;
				}

				/*
				 * Сдвиг пропорционален смещению курсора от центра: в центре
				 * кнопки он около нуля, у границы зоны доходит до strength.
				 * Резкость на границе снимает transition на самой кнопке —
				 * она возвращается плавно, а не прыжком.
				 */
				var shiftX = ( dx / ( halfWidth + MAGNET_REACH ) ) * item.strength;
				var shiftY = ( dy / ( halfHeight + MAGNET_REACH ) ) * item.strength;

				item.el.style.transform = 'translate(' + shiftX + 'px, ' + shiftY + 'px)';
				item.text.style.transform = 'translate(' +
					( shiftX * item.textStrength / item.strength ) + 'px, ' +
					( shiftY * item.textStrength / item.strength ) + 'px)';
			} );
		}

		window.addEventListener( 'mousemove', function ( event ) {
			pointer.x = event.clientX;
			pointer.y = event.clientY;

			if ( ! ticking ) {
				ticking = true;
				window.requestAnimationFrame( update );
			}
		} );

		// При скролле кнопка уезжает из-под курсора — пересчитываем.
		window.addEventListener( 'scroll', function () {
			if ( ! ticking ) {
				ticking = true;
				window.requestAnimationFrame( update );
			}
		}, { passive: true } );
	}

	/**
	 * Баннер о cookie (ТЗ, п. 01). Показываем, пока посетитель не нажал
	 * «Принять»; отметку держим в localStorage, поэтому решение переживает
	 * перезагрузку и переходы по страницам.
	 *
	 * Хранилище может быть недоступно (приватный режим, запрет на данные
	 * сайта) — тогда баннер просто покажется снова, но ошибка наружу не
	 * уйдёт и остальные скрипты не сломаются.
	 */
	function initCookieBanner() {
		var banner = document.querySelector( '[data-cookie-banner]' );

		if ( ! banner ) {
			return;
		}

		var KEY = 'onyca-cookie-accepted';
		var accepted = false;

		try {
			accepted = window.localStorage.getItem( KEY ) === '1';
		} catch ( e ) {}

		// Дубль в cookie: в приватном режиме Safari localStorage бросает
		// исключение на запись, и решение иначе не пережило бы перезагрузку.
		if ( ! accepted ) {
			accepted = document.cookie.indexOf( KEY + '=1' ) !== -1;
		}

		if ( accepted ) {
			/*
			 * Скрываем явно, а не полагаемся на атрибут в разметке: в
			 * статической копии сайта баннер сохраняется уже раскрытым
			 * (страница снимается после выполнения скриптов), и там его
			 * скрыть некому.
			 *
			 * Метку ставим здесь же: после перезагрузки dataset пуст, и
			 * бургер-меню, закрываясь, возвращало принятый баннер на экран.
			 */
			banner.hidden = true;
			banner.classList.add( 'is-hidden' );
			banner.dataset.accepted = '1';
			return;
		}

		banner.hidden = false;
		banner.classList.remove( 'is-hidden' );

		var button = banner.querySelector( '[data-cookie-accept]' );

		if ( ! button ) {
			return;
		}

		function accept() {
			banner.hidden = true;
			banner.classList.add( 'is-hidden' );
			// Метка в DOM: по ней бургер понимает, что возвращать баннер не нужно.
			banner.dataset.accepted = '1';

			try {
				window.localStorage.setItem( KEY, '1' );
			} catch ( e ) {}

			document.cookie = KEY + '=1; path=/; max-age=' + ( 60 * 60 * 24 * 365 ) + '; SameSite=Lax';
		}

		button.addEventListener( 'click', accept );

		/*
		 * touchend вдобавок к click: в Safari на iOS click у кнопки внутри
		 * position: fixed иногда не доходит. Повторный вызов безвреден —
		 * accept идемпотентен.
		 */
		button.addEventListener( 'touchend', function ( event ) {
			event.preventDefault();
			accept();
		} );
	}

	function initTabPills() {
		var pills = document.querySelectorAll( '.tab-pill' );

		pills.forEach( function ( pill ) {
			pill.addEventListener( 'click', function () {
				pill.classList.toggle( 'is-selected' );
			} );
		} );
	}

	/**
	 * Виджет времени на странице «Контакты» — день недели, часы и статус
	 * «работаем/отдыхаем» (будни, 10:00–19:00 МСК) пересчитываются на
	 * клиенте каждые 30 секунд, а не только при перезагрузке страницы.
	 */
	function initMoscowClock() {
		var dayEl = document.querySelector( '[data-msk-day]' );
		var clockEl = document.querySelector( '[data-msk-clock]' );
		var statusEl = document.querySelector( '[data-msk-status]' );

		if ( ! dayEl && ! clockEl && ! statusEl ) {
			return;
		}

		function render() {
			var now = new Date();
			var moscowNow = new Date(
				now.toLocaleString( 'en-US', { timeZone: 'Europe/Moscow' } )
			);
			var dayOfWeek = moscowNow.getDay(); // 0 (вс) .. 6 (сб)
			var hours = moscowNow.getHours();
			var isWorking = dayOfWeek >= 1 && dayOfWeek <= 5 && hours >= 10 && hours < 19;

			if ( dayEl ) {
				var dayName = new Intl.DateTimeFormat( 'ru-RU', {
					weekday: 'long',
					timeZone: 'Europe/Moscow',
				} ).format( now );
				dayEl.textContent = dayName.charAt( 0 ).toUpperCase() + dayName.slice( 1 );
			}

			if ( clockEl ) {
				var minutes = moscowNow.getMinutes();
				clockEl.textContent =
					String( hours ).padStart( 2, '0' ) + ':' + String( minutes ).padStart( 2, '0' );
			}

			if ( statusEl ) {
				statusEl.textContent = isWorking ? 'Сейчас работаем' : 'Сейчас отдыхаем';
			}
		}

		render();
		setInterval( render, 1000 * 30 );
	}

	/**
	 * Инверсия текста на карточке проекта.
	 *
	 * Обложка у каждого проекта своя: на светлом снимке название должно
	 * быть тёмным, на тёмном — светлым, иначе текст пропадает. Считаем
	 * среднюю яркость того угла обложки, где в макете (975:2423) стоят
	 * название и метки — примерно 27% ширины и 23% высоты от левого
	 * верхнего края — и при тёмном угле ставим карточке .is-on-dark,
	 * дальше цвета зеркалит components/card-project.css.
	 *
	 * Картинка обрезается по object-fit: cover, поэтому доля берётся от
	 * исходного снимка приблизительно — для решения «светлый или тёмный»
	 * этой точности достаточно.
	 */
	function initCoverContrast() {
		var cards = document.querySelectorAll( '[data-cover-contrast]' );

		if ( ! cards.length ) {
			return;
		}

		cards.forEach( function ( card ) {
			var image = card.querySelector( 'img' );

			if ( ! image ) {
				return;
			}

			function measure() {
				if ( ! image.naturalWidth || ! image.naturalHeight ) {
					return;
				}

				var areaWidth = Math.max( 1, Math.round( image.naturalWidth * 0.27 ) );
				var areaHeight = Math.max( 1, Math.round( image.naturalHeight * 0.23 ) );

				var canvas = document.createElement( 'canvas' );
				canvas.width = 20;
				canvas.height = 10;

				var context = canvas.getContext( '2d' );

				if ( ! context ) {
					return;
				}

				try {
					context.drawImage( image, 0, 0, areaWidth, areaHeight, 0, 0, canvas.width, canvas.height );

					var pixels = context.getImageData( 0, 0, canvas.width, canvas.height ).data;
					var sum = 0;

					for ( var i = 0; i < pixels.length; i += 4 ) {
						/* Яркость по восприятию: зелёный весит больше синего */
						sum += 0.2126 * pixels[ i ] + 0.7152 * pixels[ i + 1 ] + 0.0722 * pixels[ i + 2 ];
					}

					var average = sum / ( pixels.length / 4 );

					/* 140 из 255 — середина с запасом в сторону тёмного:
					   белый текст на среднем сером читается лучше чёрного */
					card.classList.toggle( 'is-on-dark', average < 140 );
				} catch ( error ) {
					/*
					 * Обложка с другого домена закрывает canvas от чтения.
					 * Оставляем светлый вариант макета — он же вариант по
					 * умолчанию, когда обложки нет вовсе.
					 */
				}
			}

			if ( image.complete ) {
				measure();
			} else {
				image.addEventListener( 'load', measure );
			}
		} );
	}

	/**
	 * Поп-апы: «Обсудить проект», «Написать по вакансии» и экран
	 * результата отправки (макеты 1293:4021, 2271:7900, 1845:3990,
	 * 2271:8502).
	 *
	 * Панели лежат в разметке все сразу, показывается одна — поэтому
	 * после отправки формы, открытой в поп-апе, содержимое ЗАМЕНЯЕТСЯ
	 * экраном результата, а не открывается второй поп-ап поверх первого.
	 *
	 * Наружу отдаём showFormResult: им пользуется обработчик форм — и
	 * тех, что стоят прямо на странице (тогда поп-ап открывается сразу
	 * на результате), и тех, что уже внутри поп-апа.
	 */
	var popupApi = null;

	function initPopup() {
		var popup = document.querySelector( '[data-popup]' );

		if ( ! popup ) {
			return;
		}

		var panes = popup.querySelectorAll( '[data-popup-pane]' );
		var note = popup.querySelector( '[data-popup-note]' );
		/* С какой формы пришли — чтобы «Попробовать снова» вернул её */
		var lastFormPane = null;

		function lockScroll() {
			var scrollbar = window.innerWidth - document.documentElement.clientWidth;

			document.documentElement.style.overflow = 'hidden';

			if ( scrollbar > 0 ) {
				document.documentElement.style.paddingRight = scrollbar + 'px';
			}
		}

		function unlockScroll() {
			document.documentElement.style.overflow = '';
			document.documentElement.style.paddingRight = '';
		}

		/*
		 * Формы в показанной панели пересчитывают то, что нельзя
		 * измерить у скрытого элемента (высоту textarea с текстом).
		 * Зовём это только когда поп-ап уже видим — иначе меряется
		 * скрытый элемент и толку от пересчёта нет.
		 */
		function notify( name ) {
			if ( popup.hidden ) {
				return;
			}

			var pane = popup.querySelector( '[data-popup-pane="' + name + '"]' );

			if ( ! pane ) {
				return;
			}

			pane.querySelectorAll( 'form' ).forEach( function ( form ) {
				form.dispatchEvent( new Event( 'onyca:shown' ) );
			} );
		}

		function show( name ) {
			panes.forEach( function ( pane ) {
				pane.hidden = pane.dataset.popupPane !== name;
			} );

			notify( name );

			/* Подписи «Не любите заполнять формы?» на экранах результата нет */
			if ( note ) {
				note.hidden = name === 'success' || name === 'error';
			}

			if ( name === 'project' || name === 'career' ) {
				lastFormPane = name;
			}
		}

		function open( name ) {
			show( name );
			popup.hidden = false;
			lockScroll();
			popup.scrollTop = 0;
			notify( name );
		}

		function close() {
			popup.hidden = true;
			unlockScroll();
		}

		document.addEventListener( 'click', function ( event ) {
			var opener = event.target.closest( '[data-popup-open]' );

			if ( opener ) {
				event.preventDefault();
				open( opener.dataset.popupOpen );
				return;
			}

			if ( event.target.closest( '[data-popup-close]' ) ) {
				event.preventDefault();
				close();
				return;
			}

			if ( event.target.closest( '[data-popup-retry]' ) ) {
				event.preventDefault();

				/* Форма была на странице — возвращаться в поп-апе не к чему */
				if ( lastFormPane ) {
					show( lastFormPane );
				} else {
					close();
				}
			}
		} );

		document.addEventListener( 'keydown', function ( event ) {
			if ( event.key === 'Escape' && ! popup.hidden ) {
				close();
			}
		} );

		popupApi = {
			open: open,
			close: close,
			show: show,
			contains: function ( node ) {
				return popup.contains( node );
			}
		};
	}

	/**
	 * Результат отправки. Форма со страницы открывает поп-ап на нужном
	 * экране, форма из поп-апа — просто меняет панель.
	 */
	function showFormResult( status, form ) {
		if ( ! popupApi ) {
			return;
		}

		if ( popupApi.contains( form ) ) {
			popupApi.show( status );
			return;
		}

		popupApi.open( status );
	}

	/**
	 * Плавающая кнопка «Обсудить проект» (макеты 933:555 и 975:2657).
	 *
	 * Два состояния помимо обычного:
	 *   — до появления кнопка уведена под кромку экрана. На главной она
	 *     выезжает, когда прокручен первый экран (так же сделано у
	 *     Лебедева, referenceвый пример из ТЗ); на остальных страницах
	 *     видна сразу;
	 *   — доехав до подвала, перестаёт быть приклеенной к экрану и
	 *     останавливается в нём на одном уровне с логотипом, справа от
	 *     него (макет подвала «С кнопкой» 975:2657: логотип и кнопка оба
	 *     на 78 от верха). С 440px и уже кнопка стоит по центру и в подвале
	 *     останавливается под блоком бренда (макет 360 — 2570:1970:
	 *     бренд заканчивается на 117, кнопка на 141).
	 *
	 * Первого экрана на главной пока нет: пока он не свёрстан, порогом
	 * служит высота окна, а когда появится — размечается атрибутом
	 * data-first-screen, и порог берётся по нему (см. PLAN.md).
	 */
	function initDiscussButton() {
		var wrap = document.querySelector( '[data-discuss-button]' );

		if ( ! wrap ) {
			return;
		}

		var footer = document.querySelector( '.site-footer' );
		var pending = false;

		function threshold() {
			if ( ! document.body.classList.contains( 'home' ) ) {
				return 0;
			}

			var firstScreen = document.querySelector( '[data-first-screen]' );

			if ( ! firstScreen ) {
				return window.innerHeight;
			}

			/*
			 * Кнопка выезжает, когда первый экран ушёл целиком, а не как
			 * только начали крутить: отсчитываем от НИЗА блока, иначе она
			 * появлялась ещё на разворачивающемся шоуриле.
			 */
			return firstScreen.offsetTop + firstScreen.offsetHeight;
		}

		function bottomOffset() {
			var value = getComputedStyle( wrap ).getPropertyValue( '--discuss-bottom' );

			return parseFloat( value ) || 0;
		}

		/* Где кнопка останавливается — в координатах документа */
		function dockTop() {
			var brand = footer.querySelector( '.site-footer__brand' );

			if ( ! brand ) {
				return footer.offsetTop;
			}

			var rect = brand.getBoundingClientRect();
			var top = rect.top + window.scrollY;

			/* По центру (440 и уже) кнопка идёт под брендом, иначе — вровень
			   с логотипом, то есть с верхом блока бренда */
			if ( window.matchMedia( '(max-width: 440px)' ).matches ) {
				return top + rect.height + 24;
			}

			return top;
		}

		function update() {
			pending = false;

			var scrolled = window.scrollY;

			wrap.classList.toggle( 'is-visible', scrolled >= threshold() );

			if ( ! footer ) {
				return;
			}

			var stopAt = dockTop();
			/* Где кнопка оказалась бы, оставаясь приклеенной к экрану */
			var floatingTop = scrolled + window.innerHeight - bottomOffset() - wrap.offsetHeight;

			if ( floatingTop >= stopAt ) {
				wrap.style.top = stopAt + 'px';
				wrap.classList.add( 'is-docked' );
			} else {
				wrap.classList.remove( 'is-docked' );
				wrap.style.top = '';
			}
		}

		function schedule() {
			if ( pending ) {
				return;
			}

			pending = true;
			window.requestAnimationFrame( update );
		}

		update();
		window.addEventListener( 'scroll', schedule, { passive: true } );
		window.addEventListener( 'resize', schedule );
	}

	/**
	 * Первый экран главной: шоурил разрастается по мере прокрутки.
	 *
	 * По кадрам макета (975:2391 → 975:2398 → 975:2405) он идёт от
	 * 910×445 до 1840×901: правый и нижний края стоят на месте, а
	 * пропорции не меняются — значит это увеличение от правого нижнего
	 * угла в 1840/910 раз.
	 *
	 * Референс из ТЗ — kotelov.com, поведение снято замером. Там две
	 * фазы:
	 *   1) рост — ширина видео идёт от 58vw−58px до 100vw−60px и упирается
	 *      в предел быстро, от небольшой прокрутки, при этом видео всё
	 *      время остаётся в кадре целиком;
	 * Прокрутку страницы анимация не задерживает: ничего не прилипает,
	 * страница едет как обычно — видео просто растёт быстрее и успевает
	 * раскрыться на первых сотнях пикселей. Растёт оно от правого края
	 * симметрично: вверх и вниз одинаково, поэтому всё это время
	 * остаётся в кадре.
	 *
	 * Рост заканчивается раньше, чем видео упрётся в шапку. Дальше оно
	 * какое-то время едет вместе с окном — сдвигается вниз ровно на
	 * пройденную прокрутку, — и всё это время видно целиком, от шапки
	 * донизу. Страница при этом не стоит: текст первого экрана уезжает
	 * как обычно, придерживается только видео.
	 *
	 * На весь возможный сдвиг секция получает поле снизу, чтобы до
	 * специализаций осталось 188px.
	 *
	 * Значения не прыгают за курсором прокрутки, а догоняют его — они
	 * сглажены.
	 */
	function initHeroShowreel() {
		var hero = document.querySelector( '[data-first-screen]' );

		if ( ! hero ) {
			return;
		}

		var showreel = hero.querySelector( '.home-hero__showreel' );

		if ( ! showreel || window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches ) {
			return;
		}

		var MAX_SCALE = 1840 / 910;
		/*
		 * Доля высоты первого экрана, за которую видео успевает
		 * раскрыться. Берём меньше половины: к этому моменту оно ещё не
		 * дошло до шапки, и дальше уже можно показывать его целиком.
		 */
		var GROW_PART = 0.35;
		/* Отступ под шапкой, на котором держится раскрытое видео */
		var GAP_UNDER_HEADER = 16;
		/* Сколько пикселей прокрутки видео едет вместе с окном */
		var HOLD_LENGTH = 250;

		/*
		 * Сверху видео должно начинаться сразу под шапкой. Её нижний край
		 * берём по факту: у залогиненного пользователя выше ещё висит
		 * админ-панель, и при отсчёте от нуля окна верх видео уходил под
		 * неё — было видно только обрезанное начало.
		 */
		function topGap() {
			var header = document.querySelector( '[data-site-header]' );

			if ( ! header ) {
				return GAP_UNDER_HEADER;
			}

			return header.getBoundingClientRect().bottom + GAP_UNDER_HEADER;
		}

		var scale = 1;
		var shift = 0;
		var targetScale = 1;
		var targetShift = 0;
		var running = false;

		function measure() {
			/* Путь прокрутки, за который видео раскрывается полностью */
			var growth = hero.offsetHeight * GROW_PART;

			if ( growth <= 0 ) {
				return;
			}

			/* Считаем от первого пикселя прокрутки страницы */
			var scrolled = window.scrollY;

			targetScale = 1 + ( Math.min( scrolled, growth ) / growth ) * ( MAX_SCALE - 1 );

			/*
			 * Где окажется верх раскрытого видео в документе: растёт оно
			 * симметрично, значит середина остаётся на месте.
			 */
			var box = showreel.getBoundingClientRect();
			var middle = box.top + window.scrollY + box.height / 2 - shift;
			var openTop = middle - showreel.offsetHeight * MAX_SCALE / 2;

			/*
			 * Как только верх подошёл к шапке, видео едет вместе с окном:
			 * сдвиг равен пройденной с этого места прокрутке. Так оно
			 * какое-то время стоит на экране целиком.
			 */
			targetShift = Math.min(
				Math.max( scrolled - ( openTop - topGap() ), 0 ),
				HOLD_LENGTH
			);

			/*
			 * Видео растёт в обе стороны и потом едет вниз — вместе это
			 * выход за низ своего блока. На него секция получает отступ
			 * снизу, иначе видео наезжает на специализации, между
			 * которыми должно оставаться поле в 188px.
			 */
			hero.style.setProperty(
				'--showreel-overflow',
				( showreel.offsetHeight * ( MAX_SCALE - 1 ) / 2 + HOLD_LENGTH ) + 'px'
			);

			if ( ! running ) {
				running = true;
				window.requestAnimationFrame( frame );
			}
		}

		function frame() {
			/* 0.12 — насколько значения догоняют цель за кадр */
			scale += ( targetScale - scale ) * 0.12;
			shift += ( targetShift - shift ) * 0.12;

			showreel.style.setProperty( '--showreel-scale', scale );
			showreel.style.setProperty( '--showreel-shift', shift + 'px' );

			/* Разошлись меньше чем на десятую долю пикселя — можно встать */
			if ( Math.abs( targetScale - scale ) < 0.0005 && Math.abs( targetShift - shift ) < 0.1 ) {
				scale = targetScale;
				shift = targetShift;
				showreel.style.setProperty( '--showreel-scale', scale );
				showreel.style.setProperty( '--showreel-shift', shift + 'px' );
				running = false;
				return;
			}

			window.requestAnimationFrame( frame );
		}

		measure();
		window.addEventListener( 'scroll', measure, { passive: true } );
		window.addEventListener( 'resize', measure );
	}

	/**
	 * Специализации на главной: при наведении строка остаётся чёрной,
	 * остальные уходят в серый, а рядом появляется баннер.
	 *
	 * Баннер стоит на своём месте по сетке (макет 1774:3970: колонки
	 * 3–4, 600×294, поднят на 127 над строкой) — за курсором он не
	 * следует, поэтому здесь только переключение классов, вся геометрия
	 * в components/front-page.css.
	 */
	function initServicesHover() {
		var list = document.querySelector( '[data-services]' );

		if ( ! list ) {
			return;
		}

		/* Ниже 1200 и на тач-экранах эффектов наведения в проекте нет */
		if ( ! window.matchMedia( '(hover: hover) and (min-width: 1200px)' ).matches ) {
			return;
		}

		var items = list.querySelectorAll( '.home-services__item' );

		items.forEach( function ( item ) {
			item.addEventListener( 'mouseenter', function () {
				list.classList.add( 'is-hovered' );

				items.forEach( function ( other ) {
					other.classList.toggle( 'is-active', other === item );
				} );
			} );

			item.addEventListener( 'mouseleave', function () {
				item.classList.remove( 'is-active' );

				if ( ! list.querySelector( '.is-active' ) ) {
					list.classList.remove( 'is-hovered' );
				}
			} );
		} );
	}

	/**
	 * Лента логотипов клиентов: едет сама по себе, а направление задаёт
	 * прокрутка страницы — вниз двигает влево, вверх вправо (референс из
	 * ТЗ). Лента продублирована в разметке, поэтому сдвиг зациклен по
	 * ширине одной копии.
	 */
	function initClientLogos() {
		var track = document.querySelector( '[data-client-logos]' );

		if ( ! track ) {
			return;
		}

		if ( window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches ) {
			return;
		}

		var row = track.querySelector( '.client-logos__row' );
		var offset = 0;
		var direction = -1;
		var lastScroll = window.scrollY;
		/* Пикселей за кадр: базовая скорость и добавка от прокрутки */
		var speed = 0.6;
		var boost = 0;

		window.addEventListener( 'scroll', function () {
			var delta = window.scrollY - lastScroll;

			if ( delta !== 0 ) {
				direction = delta > 0 ? -1 : 1;
				boost = Math.min( Math.abs( delta ) * 0.35, 12 );
			}

			lastScroll = window.scrollY;
		}, { passive: true } );

		function frame() {
			var width = row.offsetWidth;

			offset += direction * ( speed + boost );
			boost *= 0.92;

			/* Зацикливаем по ширине одной копии — стык не виден */
			if ( width ) {
				if ( offset <= -width ) {
					offset += width;
				}

				if ( offset > 0 ) {
					offset -= width;
				}
			}

			track.style.transform = 'translateX(' + offset + 'px)';
			window.requestAnimationFrame( frame );
		}

		window.requestAnimationFrame( frame );
	}

	document.addEventListener( 'DOMContentLoaded', function () {
		initHeaderScroll();
		initBurgerMenu();
		initFilterTabs();
		initTabPills();
		initCookieBanner();
		initMagneticButtons();
		initPopup();
		initContactForm();
		initMoscowClock();
		initCoverContrast();
		initDiscussButton();
		initHeroShowreel();
		initServicesHover();
		initClientLogos();
	} );
} )();
