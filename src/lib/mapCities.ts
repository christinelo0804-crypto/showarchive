// 自动生成：node scripts/generate-map-data.mjs（要增删城市请改脚本里的 CITY_ROWS 后重跑）

export interface MapCity {
  /** 中文名，用于地图与清单展示 */
  name: string
  /** 经度（东经为正） */
  lon: number
  /** 纬度（北纬为正） */
  lat: number
  /** 其它写法：英文名、别称；匹配时与中文名一起参与 */
  aliases: string[]
}

export const MAP_CITIES: MapCity[] = [
  {
    "name": "北京",
    "lon": 116.4,
    "lat": 39.9,
    "aliases": [
      "Beijing",
      "Peking",
      "北京市"
    ]
  },
  {
    "name": "上海",
    "lon": 121.47,
    "lat": 31.23,
    "aliases": [
      "Shanghai",
      "上海市"
    ]
  },
  {
    "name": "广州",
    "lon": 113.26,
    "lat": 23.13,
    "aliases": [
      "Guangzhou",
      "Canton",
      "广州市"
    ]
  },
  {
    "name": "深圳",
    "lon": 114.06,
    "lat": 22.54,
    "aliases": [
      "Shenzhen",
      "深圳市"
    ]
  },
  {
    "name": "成都",
    "lon": 104.07,
    "lat": 30.67,
    "aliases": [
      "Chengdu",
      "成都市"
    ]
  },
  {
    "name": "重庆",
    "lon": 106.55,
    "lat": 29.56,
    "aliases": [
      "Chongqing",
      "重庆市"
    ]
  },
  {
    "name": "杭州",
    "lon": 120.15,
    "lat": 30.27,
    "aliases": [
      "Hangzhou",
      "杭州市"
    ]
  },
  {
    "name": "南京",
    "lon": 118.79,
    "lat": 32.06,
    "aliases": [
      "Nanjing",
      "南京市"
    ]
  },
  {
    "name": "武汉",
    "lon": 114.3,
    "lat": 30.59,
    "aliases": [
      "Wuhan",
      "武汉市"
    ]
  },
  {
    "name": "西安",
    "lon": 108.94,
    "lat": 34.34,
    "aliases": [
      "Xi'an",
      "Xian",
      "西安市"
    ]
  },
  {
    "name": "天津",
    "lon": 117.2,
    "lat": 39.13,
    "aliases": [
      "Tianjin",
      "天津市"
    ]
  },
  {
    "name": "苏州",
    "lon": 120.62,
    "lat": 31.3,
    "aliases": [
      "Suzhou",
      "苏州市"
    ]
  },
  {
    "name": "长沙",
    "lon": 112.98,
    "lat": 28.19,
    "aliases": [
      "Changsha",
      "长沙市"
    ]
  },
  {
    "name": "郑州",
    "lon": 113.63,
    "lat": 34.75,
    "aliases": [
      "Zhengzhou",
      "郑州市"
    ]
  },
  {
    "name": "青岛",
    "lon": 120.38,
    "lat": 36.07,
    "aliases": [
      "Qingdao",
      "青岛市"
    ]
  },
  {
    "name": "厦门",
    "lon": 118.09,
    "lat": 24.48,
    "aliases": [
      "Xiamen",
      "厦门市"
    ]
  },
  {
    "name": "昆明",
    "lon": 102.83,
    "lat": 24.88,
    "aliases": [
      "Kunming",
      "昆明市"
    ]
  },
  {
    "name": "沈阳",
    "lon": 123.43,
    "lat": 41.8,
    "aliases": [
      "Shenyang",
      "沈阳市"
    ]
  },
  {
    "name": "哈尔滨",
    "lon": 126.53,
    "lat": 45.8,
    "aliases": [
      "Harbin",
      "哈尔滨市"
    ]
  },
  {
    "name": "大连",
    "lon": 121.61,
    "lat": 38.91,
    "aliases": [
      "Dalian",
      "大连市"
    ]
  },
  {
    "name": "佛山",
    "lon": 113.12,
    "lat": 23.02,
    "aliases": [
      "Foshan",
      "佛山市"
    ]
  },
  {
    "name": "东莞",
    "lon": 113.75,
    "lat": 23.02,
    "aliases": [
      "Dongguan",
      "东莞市"
    ]
  },
  {
    "name": "珠海",
    "lon": 113.55,
    "lat": 22.27,
    "aliases": [
      "Zhuhai",
      "珠海市"
    ]
  },
  {
    "name": "南宁",
    "lon": 108.37,
    "lat": 22.82,
    "aliases": [
      "Nanning",
      "南宁市"
    ]
  },
  {
    "name": "香港",
    "lon": 114.17,
    "lat": 22.32,
    "aliases": [
      "Hong Kong",
      "HongKong",
      "香港市"
    ]
  },
  {
    "name": "澳门",
    "lon": 113.54,
    "lat": 22.2,
    "aliases": [
      "Macau",
      "Macao",
      "澳门市"
    ]
  },
  {
    "name": "台北",
    "lon": 121.56,
    "lat": 25.03,
    "aliases": [
      "Taipei",
      "台北市"
    ]
  },
  {
    "name": "高雄",
    "lon": 120.3,
    "lat": 22.63,
    "aliases": [
      "Kaohsiung",
      "高雄市"
    ]
  },
  {
    "name": "东京",
    "lon": 139.69,
    "lat": 35.69,
    "aliases": [
      "Tokyo",
      "东京市"
    ]
  },
  {
    "name": "横滨",
    "lon": 139.64,
    "lat": 35.44,
    "aliases": [
      "Yokohama",
      "横滨市"
    ]
  },
  {
    "name": "大阪",
    "lon": 135.5,
    "lat": 34.69,
    "aliases": [
      "Osaka",
      "大阪市"
    ]
  },
  {
    "name": "名古屋",
    "lon": 136.91,
    "lat": 35.18,
    "aliases": [
      "Nagoya",
      "名古屋市"
    ]
  },
  {
    "name": "京都",
    "lon": 135.77,
    "lat": 35.01,
    "aliases": [
      "Kyoto",
      "京都市"
    ]
  },
  {
    "name": "首尔",
    "lon": 126.98,
    "lat": 37.57,
    "aliases": [
      "Seoul",
      "首尔市"
    ]
  },
  {
    "name": "釜山",
    "lon": 129.08,
    "lat": 35.18,
    "aliases": [
      "Busan",
      "Pusan",
      "釜山市"
    ]
  },
  {
    "name": "新加坡",
    "lon": 103.82,
    "lat": 1.35,
    "aliases": [
      "Singapore",
      "新加坡市"
    ]
  },
  {
    "name": "曼谷",
    "lon": 100.5,
    "lat": 13.75,
    "aliases": [
      "Bangkok",
      "曼谷市"
    ]
  },
  {
    "name": "吉隆坡",
    "lon": 101.69,
    "lat": 3.14,
    "aliases": [
      "Kuala Lumpur",
      "KualaLumpur",
      "KL",
      "吉隆坡市"
    ]
  },
  {
    "name": "雅加达",
    "lon": 106.85,
    "lat": -6.21,
    "aliases": [
      "Jakarta",
      "雅加达市"
    ]
  },
  {
    "name": "布拉格",
    "lon": 14.42,
    "lat": 50.09,
    "aliases": [
      "Prague",
      "Praha",
      "布拉格市"
    ]
  },
  {
    "name": "伦敦",
    "lon": -0.13,
    "lat": 51.51,
    "aliases": [
      "London",
      "伦敦市"
    ]
  },
  {
    "name": "巴黎",
    "lon": 2.35,
    "lat": 48.86,
    "aliases": [
      "Paris",
      "巴黎市"
    ]
  },
  {
    "name": "柏林",
    "lon": 13.4,
    "lat": 52.52,
    "aliases": [
      "Berlin",
      "柏林市"
    ]
  },
  {
    "name": "慕尼黑",
    "lon": 11.58,
    "lat": 48.14,
    "aliases": [
      "Munich",
      "Muenchen",
      "慕尼黑市"
    ]
  },
  {
    "name": "维也纳",
    "lon": 16.37,
    "lat": 48.21,
    "aliases": [
      "Vienna",
      "Wien",
      "维也纳市"
    ]
  },
  {
    "name": "苏黎世",
    "lon": 8.54,
    "lat": 47.38,
    "aliases": [
      "Zurich",
      "苏黎世市"
    ]
  },
  {
    "name": "阿姆斯特丹",
    "lon": 4.9,
    "lat": 52.37,
    "aliases": [
      "Amsterdam",
      "阿姆斯特丹市"
    ]
  },
  {
    "name": "米兰",
    "lon": 9.19,
    "lat": 45.46,
    "aliases": [
      "Milan",
      "Milano",
      "米兰市"
    ]
  },
  {
    "name": "罗马",
    "lon": 12.5,
    "lat": 41.9,
    "aliases": [
      "Rome",
      "Roma",
      "罗马市"
    ]
  },
  {
    "name": "马德里",
    "lon": -3.7,
    "lat": 40.42,
    "aliases": [
      "Madrid",
      "马德里市"
    ]
  },
  {
    "name": "巴塞罗那",
    "lon": 2.17,
    "lat": 41.39,
    "aliases": [
      "Barcelona",
      "巴塞罗那市"
    ]
  },
  {
    "name": "纽约",
    "lon": -74.01,
    "lat": 40.71,
    "aliases": [
      "New York",
      "NewYork",
      "NYC",
      "纽约市"
    ]
  },
  {
    "name": "洛杉矶",
    "lon": -118.24,
    "lat": 34.05,
    "aliases": [
      "Los Angeles",
      "LosAngeles",
      "LA",
      "洛杉矶市"
    ]
  },
  {
    "name": "旧金山",
    "lon": -122.42,
    "lat": 37.77,
    "aliases": [
      "San Francisco",
      "SanFrancisco",
      "SF",
      "旧金山市"
    ]
  },
  {
    "name": "芝加哥",
    "lon": -87.63,
    "lat": 41.88,
    "aliases": [
      "Chicago",
      "芝加哥市"
    ]
  },
  {
    "name": "多伦多",
    "lon": -79.38,
    "lat": 43.65,
    "aliases": [
      "Toronto",
      "多伦多市"
    ]
  },
  {
    "name": "悉尼",
    "lon": 151.21,
    "lat": -33.87,
    "aliases": [
      "Sydney",
      "悉尼市"
    ]
  },
  {
    "name": "奥克兰",
    "lon": 174.76,
    "lat": -36.85,
    "aliases": [
      "Auckland",
      "奥克兰市"
    ]
  }
]
