import { createRouter, createWebHistory } from 'vue-router'
import { resolveHistoryBase } from '../lib/router-base.js'
import { ROUTE_NAMES, PAGE_TITLE_KEYS } from '../lib/activity-pages.js'
import { t } from '../lib/i18n/activity-locale.js'
import ActivityCenterView from '../views/ActivityCenterView.vue'
import TopupStatusView from '../views/TopupStatusView.vue'

const scrollPositions = new Map()

const router = createRouter({
  history: createWebHistory(resolveHistoryBase()),
  routes: [
    {
      path: '/',
      redirect: (to) => ({ path: '/activity-center', query: to.query, hash: to.hash }),
    },
    {
      path: '/index.html',
      redirect: (to) => ({ path: '/activity-center', query: to.query, hash: to.hash }),
    },
    {
      path: '/activity-center',
      name: ROUTE_NAMES.ACTIVITY_CENTER,
      meta: { titleKey: PAGE_TITLE_KEYS[ROUTE_NAMES.ACTIVITY_CENTER] },
      component: ActivityCenterView,
    },
    {
      path: '/activity-rules',
      name: ROUTE_NAMES.ACTIVITY_RULES,
      meta: { titleKey: PAGE_TITLE_KEYS[ROUTE_NAMES.ACTIVITY_RULES] },
      component: () => import('../views/ActivityRulesView.vue'),
    },
    {
      path: '/gold-coins-exchange',
      name: ROUTE_NAMES.GOLD_COINS_EXCHANGE,
      meta: { titleKey: PAGE_TITLE_KEYS[ROUTE_NAMES.GOLD_COINS_EXCHANGE] },
      component: () => import('../views/GoldCoinsExchangeView.vue'),
    },
    {
      path: '/topup-status',
      name: ROUTE_NAMES.TOPUP_STATUS,
      meta: { titleKey: PAGE_TITLE_KEYS[ROUTE_NAMES.TOPUP_STATUS] },
      component: TopupStatusView,
    },
    {
      path: '/feedback',
      name: ROUTE_NAMES.FEEDBACK,
      meta: { titleKey: PAGE_TITLE_KEYS[ROUTE_NAMES.FEEDBACK] },
      component: () => import('../views/FeedbackView.vue'),
    },
    {
      path: '/feedback/success',
      name: ROUTE_NAMES.FEEDBACK_SUCCESS,
      meta: { titleKey: PAGE_TITLE_KEYS[ROUTE_NAMES.FEEDBACK_SUCCESS] },
      component: () => import('../views/FeedbackSuccessView.vue'),
    },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (from.name) {
      scrollPositions.set(from.name, {
        left: window.scrollX || document.documentElement.scrollLeft || 0,
        top: window.scrollY || document.documentElement.scrollTop || 0,
      })
    }

    if (savedPosition) {
      return savedPosition
    }

    const cached = to.name ? scrollPositions.get(to.name) : null
    if (cached) {
      return { left: cached.left, top: cached.top }
    }

    return { left: 0, top: 0 }
  },
})

router.afterEach((to) => {
  const titleKey = to.meta?.titleKey
  if (typeof titleKey === 'string' && titleKey) {
    document.title = t(titleKey)
  }
})

export default router
