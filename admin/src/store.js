import { createStore, combineReducers } from 'redux'
import { authReducer } from './store/reducers/auth'

const initialState = {
  sidebarShow: true,
  sidebarUnfoldable: false,
  theme: 'light',
}

const changeState = (state = initialState, { type, ...rest }) => {
  switch (type) {
    case 'set':
      return { ...state, ...rest }
    default:
      return state
  }
}

const rootReducer = combineReducers({
  nav: changeState,
  auth: authReducer,
})

const store = createStore(rootReducer)
export default store
