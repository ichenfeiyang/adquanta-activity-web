import { createRouter, createWebHistory } from 'vue-router'
import { resolveHistoryBase } from '../lib/router-base.js'
import ActivityCenterView from '../views/ActivityCenterView.vue'

const PAGE_TITLES = {
  'activity-center': 'Activity Center',
  'gold-coins-exchange': 'Gold Coins Redeem',
  'topup-status': 'Top-up Status',
}

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
      name: 'activity-center',
      meta: { title: PAGE_TITLES['activity-center'] },
      component: ActivityCenterView,
    },
    {
      path: '/gold-coins-exchange',
      name: 'gold-coins-exchange',
      meta: { title: PAGE_TITLES['gold-coins-exchange'] },
      component: () => import('../views/GoldCoinsExchangeView.vue'),
    },
    {
      path: '/topup-status',
      name: 'topup-status',
      meta: { title: PAGE_TITLES['topup-status'] },
      component: () => import('../views/TopupStatusView.vue'),
    },
  ],
})

router.afterEach((to) => {
  const title = to.meta?.title
  if (typeof title === 'string' && title) {
    document.title = title
  }
})

export default router
