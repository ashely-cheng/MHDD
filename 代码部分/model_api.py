import output_script
import torch
from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification, AutoModelForTokenClassification, pipeline


# 挂载模型和分词器
tokenizerForclf = AutoTokenizer.from_pretrained("./clf_model")
modelForclf = AutoModelForSequenceClassification.from_pretrained("./clf_model")

tokenizerForner = AutoTokenizer.from_pretrained("./ner_model")
modelForner = AutoModelForTokenClassification.from_pretrained("./ner_model")


# 创建管道
device = 0 if torch.cuda.is_available() else -1

clf_pipe = pipeline("text-classification", model=modelForclf, tokenizer=tokenizerForclf, device=device)

ner_pipe = pipeline("token-classification", model=modelForner, tokenizer=tokenizerForner, device=device, aggregation_strategy="simple")


# 定义接口
## 映射表
intent_map = {'添加组件': '0', '删除组件': '1', '提高顺序': '2', '降低顺序': '3'}
location_map = {'客 厅': 'A', '卧 室': 'B', '厨 房': 'C'}
furniture_map = {'灯': '0', '空 调': '1', '监 控': '2', '窗 帘': '3'}

app = FastAPI()

## 定义请求体
class RequestData(BaseModel):
    text: str

## 定义一个 POST 请求的接口
@app.post("/predict")
async def predict(request: RequestData):
    # 对输入文本进行编码
    clf_res = clf_pipe(request.text)
    ner_res = ner_pipe(request.text)
    
    # intent_map, location_map, furniture_map默认值为None, trans默认值为True。
    # trans为True时返回不含意图分析的字符串，为False时返回json
    res = output_script.process_res(clf_res, ner_res, intent_map=intent_map, location_map=location_map, furniture_map=furniture_map, trans=False)

    return {"prediction": res}

# 打开anaconda prompt，进入虚拟环境中，cd /d 进入文件所在文件夹
# 运行命令（在命令行中）: uvicorn model_api:app --host 0.0.0.0 --port 8000 --reload
# 测试语句“在我家卧室和客厅里都有一个智能空调和智能灯，除此之外我家客厅还有一个自动窗帘，卧室里放了我家的智能扫地机器人，请帮我根据上述描述来创建一个智能家居页面。”