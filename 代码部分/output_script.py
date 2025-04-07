from collections import defaultdict

# intent_map = {'添加组件': '0', '删除组件': '1', '提高顺序': '2', '降低顺序': '3'}
# location_map = {'客 厅': 'A', '卧 室': 'B', '厨 房': 'C'}
# furniture_map = {'灯': '0', '空 调': '1', '监 控': '2', '窗 帘': '3'}

def process_res(clf_res, ner_res, intent_map=None, location_map=None, furniture_map=None, trans=True):
    # 处理意图数据
    clf_dict = {'intent':clf_res[0]['label']}
    # 处理实体数据
    ner_dict = defaultdict(list)  # 让字典的值默认是列表
    loc_list = []
    fun_list = []
    for r in ner_res:
        if r['entity_group'] == 'LOC':
            loc_list.append(r['word'])
        elif r['entity_group'] == 'FUR':
            fun_list.append(r['word'])
        elif r['entity_group'] == 'PUN':
            for l in loc_list:
                ner_dict[l].extend(fun_list)  # 累积而不是覆盖
            loc_list.clear()
            fun_list.clear()

    clf_dict['slot'] = ner_dict
    joint_res = clf_dict

    trans_res = ''
    for l, fs in joint_res['slot'].items():
        trans_res += location_map[l] + ' '
        for f in fs:
            trans_res += furniture_map[f] +' '
    if trans:
        return trans_res
    
    joint_res['intent'] = intent_map[joint_res['intent']]
    joint_res['slot'] = trans_res

    return joint_res

# clf = [{'label': '添加组件', 'score': 0.46285390853881836}]
# ner = [{'entity_group': 'LOC',
#   'score': 0.7689786,
#   'word': '卧 室',
#   'start': 3,
#   'end': 5},
#  {'entity_group': 'LOC',
#   'score': 0.7940897,
#   'word': '客 厅',
#   'start': 6,
#   'end': 8},
#  {'entity_group': 'FUR',
#   'score': 0.66714185,
#   'word': '灯',
#   'start': 15,
#   'end': 16},
#  {'entity_group': 'FUR',
#   'score': 0.7467905,
#   'word': '空 调',
#   'start': 19,
#   'end': 21},
#  {'entity_group': 'PUN',
#   'score': 0.9446352,
#   'word': '，',
#   'start': 21,
#   'end': 22},
#  {'entity_group': 'LOC',
#   'score': 0.80338347,
#   'word': '客 厅',
#   'start': 28,
#   'end': 30},
#  {'entity_group': 'FUR',
#   'score': 0.5455193,
#   'word': '监 控',
#   'start': 34,
#   'end': 36},
#  {'entity_group': 'PUN',
#   'score': 0.93825346,
#   'word': '，',
#   'start': 36,
#   'end': 37},
#  {'entity_group': 'LOC',
#   'score': 0.7723365,
#   'word': '卧 室',
#   'start': 37,
#   'end': 39},
#  {'entity_group': 'FUR',
#   'score': 0.58189905,
#   'word': '窗 帘',
#   'start': 47,
#   'end': 49},
#  {'entity_group': 'PUN',
#   'score': 0.9404259,
#   'word': '，',
#   'start': 49,
#   'end': 50},
#  {'entity_group': 'PUN',
#   'score': 0.9438631,
#   'word': '。',
#   'start': 70,
#   'end': 71}]
    
# res = process_res(clf, ner, intent_map, location_map, furniture_map, trans=False)
# print(res)
