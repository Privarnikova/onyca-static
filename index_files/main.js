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
	 * Хедер: статичен на первом экране, при скролле вниз скрывается,
	 * при скролле вверх — появляется (ТЗ, п. 03-01).
	 */
	function initHeaderScroll() {
		var header = document.querySelector( '[data-site-header]' );
		if ( ! header ) {
			return;
		}

		var lastScrollY = window.scrollY;
		var headerHeight = header.offsetHeight;

		window.addEventListener(
			'scroll',
			function () {
				var currentScrollY = window.scrollY;

				if ( currentScrollY <= headerHeight ) {
					header.classList.remove( 'is-hidden' );
				} else if ( currentScrollY > lastScrollY ) {
					header.classList.add( 'is-hidden' );
				} else if ( currentScrollY < lastScrollY ) {
					header.classList.remove( 'is-hidden' );
				}

				lastScrollY = currentScrollY;
			},
			{ passive: true }
		);
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
		 * Баннер cookie перекрывал бы открытую панель (он fixed внизу
		 * экрана), поэтому на время открытого меню его прячем и возвращаем
		 * при закрытии — если посетитель ещё не нажал «Принять».
		 */
		function toggleCookieBanner( menuOpen ) {
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
		var form = document.querySelector( '.contact-form' );

		if ( ! form ) {
			return;
		}

		var consentError = form.querySelector( '[data-consent-error]' );

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
				textarea.style.height = textarea.scrollHeight + 'px';
			};

			textarea.addEventListener( 'input', resize );
			window.addEventListener( 'resize', resize );
			resize();
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
			var email = form.querySelector( '[name="contact_email"]' );

			return {
				tags: ! form.querySelector( '.tab-pill.is-selected' ),
				// Точный разбор адреса тут не нужен: письмо всё равно
				// проверяется на сервере, здесь — только форма записи.
				email: ! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( email.value.trim() ),
				budget: ! form.querySelector( '[name="contact_budget"]:checked' ),
				consent: ! form.querySelector( '[name="contact_consent"]' ).checked
			};
		}

		function validate() {
			var state = checks();
			var consentControl = form.querySelector( '[name="contact_consent"]' );

			mark( group( 'tags' ), state.tags );
			mark( group( 'email' ), state.email );
			mark( group( 'budget' ), state.budget );
			mark( group( 'consent' ), state.consent );

			consentControl.classList.toggle( 'is-required-error', state.consent );
			consentError.hidden = ! state.consent;

			return ! ( state.tags || state.email || state.budget || state.consent );
		}

		form.addEventListener( 'submit', function ( event ) {
			if ( ! validate() ) {
				event.preventDefault();
			}
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
	 * Зона, в которой курсор уже притягивает, — половина кнопки плюс 60px.
	 */
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
				var cx = rect.left + rect.width / 2;
				var cy = rect.top + rect.height / 2;
				var dx = pointer.x - cx;
				var dy = pointer.y - cy;
				var reach = Math.max( rect.width, rect.height ) / 2 + 60;
				var distance = Math.sqrt( dx * dx + dy * dy );

				if ( distance > reach ) {
					item.el.style.transform = '';
					item.text.style.transform = '';
					return;
				}

				/*
				 * Сдвиг пропорционален смещению курсора от центра: у самой
				 * кнопки он около нуля, к границе зоны доходит до strength.
				 * Резкость на границе снимает transition на самой кнопке —
				 * она возвращается плавно, а не прыжком.
				 */
				var shiftX = ( dx / reach ) * item.strength;
				var shiftY = ( dy / reach ) * item.strength;

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

	document.addEventListener( 'DOMContentLoaded', function () {
		initHeaderScroll();
		initBurgerMenu();
		initFilterTabs();
		initTabPills();
		initCookieBanner();
		initMagneticButtons();
		initContactForm();
		initMoscowClock();
	} );
} )();
